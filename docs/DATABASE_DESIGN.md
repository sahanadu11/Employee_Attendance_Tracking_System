# Database Design

## Models

### User
- Stores authentication credentials, roles, and session data
- Fields: email, passwordHash, role, sectionId, flowId, failedAttempts, lockedUntil

### Employee
- Stores employee records with department, section, flow, shift assignments
- Fields: employeeId, fullName, photo, phone, email, sectionId, flowId, shiftId

### Section
- Organization units with assigned admins and flows
- Fields: name, code, adminIds, flowIds

### Flow
- Work flow definitions within sections
- Fields: name, code, sectionId, employeeIds, attendanceSequence, locationPolicy

### Shift
- Configurable shift schedules
- Fields: name, code, startTime, endTime, gracePeriod, lateThreshold, policies

### AttendanceEventType
- Configurable event definitions (login, lunch, tea, sign-out)
- Fields: name, code, eventType, sequenceNumber, requirements

### AttendanceEvent
- Individual attendance records
- Fields: employeeId, eventTypeId, status, scheduledTime, actualTime, gpsData

### BreakRecord
- Break tracking records
- Fields: employeeId, eventTypeId, breakStart, breakEnd, duration

### OfficeLocation
- Geofence definitions
- Fields: name, latitude, longitude, geofenceRadius

### EmployeeLocation
- Historical location tracking
- Fields: employeeId, latitude, longitude, accuracy, timestamp

### AuditLog
- Append-only audit trail
- Fields: userId, action, entity, oldValue, newValue, timestamp

### SecurityEvent
- Security incident records
- Fields: userId, eventType, description, timestamp

### Notification
- User notifications
- Fields: userId, type, title, message, isRead

### DeviceSession
- Active device sessions
- Fields: userId, refreshToken, deviceInfo, expiresAt

### SystemSetting
- Configuration settings
- Fields: key, value

## Indexes
- Users: email (unique), employeeId, role, isActive
- Employees: employeeId (unique), sectionId, flowId, employmentStatus
- AttendanceEvents: employeeId+actualTime, isIdempotentKey (unique), status
- AuditLogs: userId+timestamp, entity+entityId+timestamp
- EmployeeLocations: employeeId+timestamp, timestamp
- SecurityEvents: userId+timestamp, eventType+timestamp

## Relationships
- User ↔ Employee (one-to-one via employeeId)
- Section → Flows (one-to-many)
- Flow → Employees (one-to-many)
- Shift → Employees (many-to-many)
- Employee → AttendanceEvents (one-to-many)
- Employee → BreakRecords (one-to-many)
- OfficeLocation → EmployeeLocations (one-to-many)
