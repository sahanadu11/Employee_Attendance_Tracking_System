# MongoDB Schema (live)

> Source of truth for the running system. Models live in `backend/models/`.

## Collections overview

```
users ──────────┐
sections ───────┤
flows ──────────┼──→ employees ──→ attendance_events ──→ break_records
shifts ─────────┘        │
attendance_event_types ──┘
office_locations ──→ employee_locations
security_events / audit_logs / notifications / device_sessions / system_settings
```

## users
| Field | Type | Notes |
|---|---|---|
| email | string, unique, index | login identity |
| passwordHash | string | bcrypt, cost 12 |
| role | enum | SUPER_ADMIN, MAIN_ADMIN, SECTION_ADMIN, FLOW_ADMIN, EMPLOYEE |
| employeeId | string, index | link to employees.employeeId (string, not _id) |
| sectionId / flowId | ObjectId ref | scope for section/flow admins |
| failedAttempts | number | brute-force counter |
| lockedUntil | date | temporary lock expiry |
| refreshToken | string | rotating refresh token |
| isActive, lastLoginAt | bool / date | |

Indexes: `{email:1, isActive:1}`, `{employeeId:1}`

## employees
employeeId (unique, uppercased), fullName, photo (data-URI or storage URL), phone,
email, department, sectionId→sections, flowId→flows, shiftId→shifts, jobTitle,
joiningDate, employmentStatus (ACTIVE|INACTIVE|ARCHIVED|SUSPENDED),
attendancePolicyId, gpsPolicyId, officeLocationId, isActive, eventFlowConfig[],
emergencyContact{}.

Indexes: sectionId, flowId, shiftId, employmentStatus, `{isActive:1, sectionId:1}`,
text index on fullName/employeeId/email.

## attendance_events
employeeId→employees, eventTypeId→attendance_event_types, shiftId, flowId, sectionId,
scheduledTime, actualTime, status (EARLY|ON_TIME|GRACE_PERIOD|LATE|MISSED|INVALID|
BLOCKED|GPS_FAILURE|SECURITY_LOCK), lateDurationMinutes, earlyDurationMinutes,
latitude, longitude, gpsAccuracy, gpsStatus (INSIDE|OUTSIDE|UNAVAILABLE|INACCURATE|
PERMISSION_DENIED), photoUrl, faceVerificationResult (VERIFIED|FAILED|NOT_REQUIRED|
UNAVAILABLE), notes, isIdempotentKey (unique where present), deviceInfo{}, isAdminOverride,
overrideBy→users, overrideReason, isVerified.

Indexes: `{employeeId:1, actualTime:-1}`, `{employeeId:1, eventTypeId:1, actualTime:-1}`,
actualTime:-1, `{isIdempotentKey:1}` (unique, sparse), status, `{sectionId:1, actualTime:-1}`,
`{flowId:1, actualTime:-1}`.

**Duplicate prevention:** the unique partial index on `isIdempotentKey` makes
double-tap / retry / resubmission safe — the second write is rejected by the
database itself.

## break_records
employeeId, eventTypeId, shiftId, flowId, sectionId, breakStart, breakEnd?,
totalDurationMinutes?, allowedDurationMinutes, excessDurationMinutes?, latitude,
longitude, gpsAccuracy, photoUrl, timestamp.

## attendance_event_types
name, code (LOGIN, LUNCH_OUT, LUNCH_IN, TEA_OUT, TEA_IN, SIGN_OUT, ADDITIONAL_1…),
eventType, sequenceNumber, required, requiresPhoto, requiresGps,
requiresFaceVerification, allowedWindowMinutes, isActive.
Unlimited custom events can be added — nothing is hard-coded.

## sections / flows / shifts
- **sections**: name, code, adminIds→users, isActive.
- **flows**: name, code, sectionId, employeeIds, shiftIds, attendanceSequence[]
  (ordered event codes), locationPolicy{}, adminIds→users, status.
- **shifts**: name, code, startTime "HH:mm", endTime, gracePeriodMinutes,
  lateThresholdMinutes, earlyLoginAllowanceMinutes, breakPolicy{}, lunchPolicy{},
  teaBreakPolicy{}, signOutPolicy{}, gpsPolicy{requireGps, requireAccuracy,
  geofenceRadius}, sectionIds[], flowIds[], employeeIds[], scheduleDays[], isActive.
  Six defaults seeded (SH1–SH6) but fully data-driven.

## office_locations / employee_locations
- **office_locations**: name, latitude, longitude, geofenceRadius, isActive.
- **employee_locations**: employeeId, latitude, longitude, accuracy, timestamp,
  insideGeofence — periodic movement history.

## security_events (append-only)
userId, eventType (FAILED_LOGIN|LOCKOUT|UNAUTHORIZED_ACCESS|INVALID_EVENT|
GPS_SUSPICIOUS|ADMIN_CHANGE|SESSION_ACTIVITY), description, metadata{}, timestamp,
ipAddress, userAgent, isResolved.

## audit_logs (append-only)
userId, userRole, action, entity, entityId, oldValue{}, newValue{}, details,
ipAddress, userAgent, timestamp, result.

## notifications
userId, type (LATE|OUTSIDE_GEOFENCE|GPS_FAILURE|ACCOUNT_LOCK|MISSED_EVENT|
ATTENDANCE_EXCEPTION|ADMIN_ACTION|SYSTEM_WARNING), title, message, isRead,
metadata{}, timestamp.

## device_sessions
userId, employeeId, refreshToken, deviceInfo{userAgent, platform, browser},
ipAddress, isActive, lastActivityAt, expiresAt.

## system_settings
key (unique), value (mixed), description. Keys: MAX_LOGIN_ATTEMPTS,
LOCKOUT_DURATION_MINUTES, LIVE_DISPLAY_DURATION_SECONDS, GPS_ACCURACY_THRESHOLD,
GEOFENCE_DEFAULT_RADIUS, GPS_UPDATE_INTERVAL_MS.
