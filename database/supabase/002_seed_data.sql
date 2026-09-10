-- ============================================================
-- Reference seed data (matches backend seed) — run after 001.
-- ============================================================

INSERT INTO system_settings (key, value, description) VALUES
  ('MAX_LOGIN_ATTEMPTS', '3', 'Failed password attempts before account lock'),
  ('LOCKOUT_DURATION_MINUTES', '30', 'Account lock duration in minutes'),
  ('LIVE_DISPLAY_DURATION_SECONDS', '90', 'Live event photo flash duration on dashboards'),
  ('GPS_ACCURACY_THRESHOLD', '50', 'Maximum acceptable GPS accuracy in meters'),
  ('GEOFENCE_DEFAULT_RADIUS', '100', 'Default office geofence radius in meters'),
  ('GPS_UPDATE_INTERVAL_MS', '30000', 'Periodic location update interval');

INSERT INTO office_locations (name, latitude, longitude, geofence_radius_m) VALUES
  ('HQ-Alpha', 28.6139, 77.2090, 100);

INSERT INTO shifts (name, code, start_time, end_time, grace_period_minutes, late_threshold_minutes) VALUES
  ('Shift 1 - Early Morning', 'SH1', '05:00', '09:00', 10, 15),
  ('Shift 2 - Morning',       'SH2', '07:00', '11:00', 10, 15),
  ('Shift 3 - Late Morning',  'SH3', '09:00', '13:00', 15, 30),
  ('Shift 4 - Afternoon',     'SH4', '12:00', '16:00', 15, 30),
  ('Shift 5 - Evening',       'SH5', '14:00', '18:00', 15, 30),
  ('Shift 6 - Night',         'SH6', '18:00', '22:00', 15, 30);

INSERT INTO sections (name, code) VALUES
  ('Section A — Aero Systems',   'SEC-A'),
  ('Section B — Propulsion',     'SEC-B'),
  ('Section C — Mission Control','SEC-C');

-- Flows mapped round-robin across sections
INSERT INTO flows (name, code, section_id)
SELECT f.name, f.code, s.id
FROM (VALUES
  ('Flow 1','FL1',0), ('Flow 2','FL2',1), ('Flow 3','FL3',2),
  ('Flow 4','FL4',0), ('Flow 5','FL5',1), ('Flow 6','FL6',2)
) AS f(name, code, sec_idx)
JOIN LATERAL (SELECT id FROM sections ORDER BY created_at OFFSET f.sec_idx LIMIT 1) s ON true;

INSERT INTO attendance_event_types (name, code, event_type, sequence_number, is_required, requires_photo, requires_gps) VALUES
  ('First Face / Login', 'LOGIN',      'LOGIN',      1, true,  true, true),
  ('Lunch Out',          'LUNCH_OUT',  'LUNCH_OUT',  2, false, true, true),
  ('Lunch In',           'LUNCH_IN',   'LUNCH_IN',   3, false, true, true),
  ('Tea Break Out',      'TEA_OUT',    'TEA_OUT',    4, false, true, true),
  ('Tea Break In',       'TEA_IN',     'TEA_IN',     5, false, true, true),
  ('Final Sign Out',     'SIGN_OUT',   'SIGN_OUT',   6, true,  true, true),
  ('Additional Event 1', 'ADDITIONAL_1','CUSTOM',    7, false, false, false),
  ('Additional Event 2', 'ADDITIONAL_2','CUSTOM',    8, false, false, false);
