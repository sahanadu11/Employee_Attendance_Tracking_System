# API Documentation

## Base URL
`http://localhost:5000/api/v1`

## Authentication

### POST /auth/login
Login with email and password.
```json
{ "email": "admin@attendance.com", "password": "Admin123!" }
```
Response: `{ accessToken, refreshToken, user }`

### POST /auth/register
Register a new user (admin only).

### POST /auth/refresh-token
Refresh access token.

### POST /auth/logout
Logout and invalidate session.

## Employees

### GET /employees
Get employees (paginated, filterable).
Query params: `page`, `limit`, `search`, `sectionId`, `flowId`, `status`

### POST /employees
Create new employee (SUPER_ADMIN, MAIN_ADMIN only).

### PUT /employees/:employeeId
Update employee.

### PATCH /employees/:employeeId/status
Toggle employee active/inactive.

### GET /employees/:employeeId/timeline
Get employee attendance timeline.

## Attendance

### POST /attendance
Submit attendance event.
Body: `{ eventTypeId, latitude, longitude, gpsAccuracy, photoUrl, faceVerificationResult, isIdempotentKey }`

### GET /attendance/history
Get attendance history with filters.

### GET /attendance/stats
Get today's attendance statistics.

## Sections

### GET /sections
Get all sections.

### POST /sections
Create section.

### GET /sections/:sectionId/dashboard
Get section dashboard.

## Flows

### GET /flows
Get all flows.

### POST /flows
Create flow.

## Shifts

### GET /shifts
Get all shifts.

### POST /shifts
Create shift.

## Reports

### GET /reports/daily
Generate daily report.

### GET /reports/monthly
Generate monthly report.

### GET /reports/summary
Generate summary report.

## GPS

### POST /gps/validate
Validate GPS location.
Body: `{ latitude, longitude, accuracy }`

### GET /gps/offices
Get office locations.

### GET /gps/:employeeId
Get employee locations.

## Security

### GET /security/failed-logins
Get failed login attempts.

### GET /security/locked-accounts
Get locked accounts.

### GET /security/dashboard
Get security dashboard stats.

### POST /security/:userId/unlock
Unlock an account.

## Audit

### GET /audit
Get audit logs.

## Admin

### GET /admin/stats
Get dashboard statistics.

### GET /admin/live-events
Get live attendance events.

### PUT /admin/attendance/:eventId/override
Admin override attendance.

## Settings

### GET /settings
Get system settings.

### PUT /settings
Update settings.

## Event Types

### GET /event-types
Get attendance event types.

### POST /event-types
Create event type (admin only).

## Breaks

### POST /breaks
Start a break.

### PUT /breaks/:breakRecordId/end
End a break.
