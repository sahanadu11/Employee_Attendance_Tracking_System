-- ============================================================
-- AERO-OPS Attendance Telemetry — Supabase (PostgreSQL) schema
-- Full migration target for the MongoDB data layer.
-- Run in Supabase SQL editor in order: 001 → 002.
-- ============================================================

-- ---------- ENUMS ----------
CREATE TYPE user_role AS ENUM ('SUPER_ADMIN','MAIN_ADMIN','SECTION_ADMIN','FLOW_ADMIN','EMPLOYEE');
CREATE TYPE attendance_status AS ENUM ('EARLY','ON_TIME','GRACE_PERIOD','LATE','MISSED','INVALID','BLOCKED','GPS_FAILURE','SECURITY_LOCK');
CREATE TYPE gps_status AS ENUM ('INSIDE','OUTSIDE','UNAVAILABLE','INACCURATE','PERMISSION_DENIED');
CREATE TYPE verification_result AS ENUM ('VERIFIED','FAILED','NOT_REQUIRED','UNAVAILABLE');
CREATE TYPE employment_status AS ENUM ('ACTIVE','INACTIVE','ARCHIVED','SUSPENDED');
CREATE TYPE flow_status AS ENUM ('ACTIVE','INACTIVE');
CREATE TYPE security_event_type AS ENUM ('FAILED_LOGIN','LOCKOUT','UNAUTHORIZED_ACCESS','INVALID_EVENT','GPS_SUSPICIOUS','ADMIN_CHANGE','SESSION_ACTIVITY');
CREATE TYPE notification_type AS ENUM ('LATE','OUTSIDE_GEOFENCE','GPS_FAILURE','ACCOUNT_LOCK','MISSED_EVENT','ATTENDANCE_EXCEPTION','ADMIN_ACTION','SYSTEM_WARNING');
CREATE TYPE audit_result AS ENUM ('SUCCESS','FAILURE','PARTIAL');

-- ---------- CORE ORG TABLES ----------
CREATE TABLE sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  grace_period_minutes INT NOT NULL DEFAULT 15,
  late_threshold_minutes INT NOT NULL DEFAULT 30,
  early_login_allowance_minutes INT NOT NULL DEFAULT 15,
  break_policy JSONB NOT NULL DEFAULT '{}',
  lunch_policy JSONB NOT NULL DEFAULT '{}',
  tea_break_policy JSONB NOT NULL DEFAULT '{}',
  sign_out_policy JSONB NOT NULL DEFAULT '{}',
  gps_policy JSONB NOT NULL DEFAULT '{"requireGps": true, "requireAccuracy": 50, "geofenceRadius": 100}',
  schedule_days TEXT[] NOT NULL DEFAULT '{MON,TUE,WED,THU,FRI}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE flows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE RESTRICT,
  attendance_sequence TEXT[] NOT NULL DEFAULT '{LOGIN,LUNCH_OUT,LUNCH_IN,TEA_OUT,TEA_IN,SIGN_OUT}',
  location_policy JSONB NOT NULL DEFAULT '{"requireGeofence": true, "geofenceRadius": 100, "maxAccuracy": 50, "checkOnEveryEvent": true}',
  status flow_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE office_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  geofence_radius_m INT NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- USERS / EMPLOYEES ----------
CREATE TABLE app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,                -- bcrypt, cost 12
  role user_role NOT NULL,
  failed_attempts INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  refresh_token TEXT,
  section_id UUID REFERENCES sections(id),    -- scope for SECTION_ADMIN
  flow_id UUID REFERENCES flows(id),          -- scope for FLOW_ADMIN
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_app_users_email_active ON app_users (email, is_active);
CREATE INDEX idx_app_users_locked ON app_users (locked_until) WHERE locked_until IS NOT NULL;

CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code TEXT NOT NULL UNIQUE,          -- business id e.g. EMP-10024
  full_name TEXT NOT NULL,
  photo_url TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  department TEXT NOT NULL,
  job_title TEXT NOT NULL,
  joining_date DATE NOT NULL,
  employment_status employment_status NOT NULL DEFAULT 'ACTIVE',
  is_active BOOLEAN NOT NULL DEFAULT true,
  section_id UUID NOT NULL REFERENCES sections(id),
  flow_id UUID NOT NULL REFERENCES flows(id),
  shift_id UUID NOT NULL REFERENCES shifts(id),
  office_location_id UUID REFERENCES office_locations(id),
  attendance_policy JSONB,
  event_flow_config JSONB,
  emergency_contact JSONB,
  user_id UUID UNIQUE REFERENCES app_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_employees_section ON employees (section_id);
CREATE INDEX idx_employees_flow ON employees (flow_id);
CREATE INDEX idx_employees_shift ON employees (shift_id);
CREATE INDEX idx_employees_status ON employees (employment_status);
CREATE INDEX idx_employees_name_trgm ON employees USING gin (full_name gin_trgm_ops);

-- ---------- EVENT ENGINE ----------
CREATE TABLE attendance_event_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,                    -- LOGIN | LUNCH_OUT | ... | CUSTOM
  sequence_number INT NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT false,
  requires_photo BOOLEAN NOT NULL DEFAULT false,
  requires_gps BOOLEAN NOT NULL DEFAULT false,
  requires_face_verification BOOLEAN NOT NULL DEFAULT false,
  allowed_window_minutes INT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_event_types_seq ON attendance_event_types (sequence_number);

-- ---------- ATTENDANCE ----------
CREATE TABLE attendance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  event_type_id UUID NOT NULL REFERENCES attendance_event_types(id),
  shift_id UUID REFERENCES shifts(id),
  flow_id UUID REFERENCES flows(id),
  section_id UUID REFERENCES sections(id),
  scheduled_time TIMESTAMPTZ,
  actual_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  status attendance_status NOT NULL,
  late_duration_minutes INT,
  early_duration_minutes INT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  gps_accuracy_m DOUBLE PRECISION,
  gps_status gps_status NOT NULL DEFAULT 'UNAVAILABLE',
  photo_url TEXT,
  face_verification verification_result,
  notes TEXT,
  idempotency_key TEXT UNIQUE,                 -- duplicate-submission protection
  device_info JSONB,
  is_admin_override BOOLEAN NOT NULL DEFAULT false,
  override_by UUID REFERENCES app_users(id),
  override_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_att_events_emp_time ON attendance_events (employee_id, actual_time DESC);
CREATE INDEX idx_att_events_time ON attendance_events (actual_time DESC);
CREATE INDEX idx_att_events_section_time ON attendance_events (section_id, actual_time DESC);
CREATE INDEX idx_att_events_flow_time ON attendance_events (flow_id, actual_time DESC);
CREATE INDEX idx_att_events_status ON attendance_events (status);

CREATE TABLE break_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  event_type_id UUID REFERENCES attendance_event_types(id),
  shift_id UUID REFERENCES shifts(id),
  flow_id UUID REFERENCES flows(id),
  section_id UUID REFERENCES sections(id),
  break_start TIMESTAMPTZ NOT NULL,
  break_end TIMESTAMPTZ,
  total_duration_minutes INT,
  allowed_duration_minutes INT NOT NULL,
  excess_duration_minutes INT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  gps_accuracy_m DOUBLE PRECISION,
  photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_breaks_emp_start ON break_records (employee_id, break_start DESC);

CREATE TABLE employee_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy_m DOUBLE PRECISION NOT NULL DEFAULT 0,
  inside_geofence BOOLEAN,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_emp_locations_emp_time ON employee_locations (employee_id, timestamp DESC);

-- ---------- SECURITY / GOVERNANCE ----------
CREATE TABLE security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  event_type security_event_type NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sec_events_type_time ON security_events (event_type, timestamp DESC);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  user_role user_role,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  old_value JSONB,
  new_value JSONB,
  details TEXT,
  ip_address INET,
  user_agent TEXT,
  result audit_result NOT NULL DEFAULT 'SUCCESS',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_time ON audit_logs (timestamp DESC);
CREATE INDEX idx_audit_action ON audit_logs (action);

-- Audit log immutability (append-only)
CREATE RULE audit_logs_no_update AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE audit_logs_no_delete AS ON DELETE TO audit_logs DO INSTEAD NOTHING;

CREATE TABLE device_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  refresh_token TEXT,
  device_info JSONB NOT NULL DEFAULT '{}',
  ip_address INET,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sessions_user_active ON device_sessions (user_id, is_active);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_time ON notifications (user_id, timestamp DESC);

CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- ROLE SCOPING (RLS helper) ----------
CREATE OR REPLACE FUNCTION current_user_role() RETURNS user_role AS $$
  SELECT role FROM app_users WHERE id = auth.uid();
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION current_scope_section_ids() RETURNS SETOF UUID AS $$
  SELECT CASE
    WHEN (SELECT role FROM app_users WHERE id = auth.uid()) IN ('SUPER_ADMIN','MAIN_ADMIN')
      THEN (SELECT id FROM sections)
    ELSE (SELECT section_id FROM app_users WHERE id = auth.uid())
  END;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
