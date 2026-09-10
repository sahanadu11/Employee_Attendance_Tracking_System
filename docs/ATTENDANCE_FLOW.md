# Attendance Flow

```mermaid
sequenceDiagram
    Employee->>+Frontend: Open PWA
    Frontend->>+Auth: Login
    Auth-->>-Frontend: JWT Tokens
    Frontend->>+Server: Validate Session
    Server-->>-Frontend: Session Valid
    Frontend->>+Browser: Request GPS Permission
    Browser-->>-Frontend: Location Data
    Frontend->>+Server: Submit Attendance Event
    Server->>+Geofence: Validate Location
    Geofence-->>-Server: Inside/Outside
    Server->>+Face: Verify Photo (if configured)
    Face-->>-Server: Verification Result
    Server->>+Late Engine: Calculate Status
    Late Engine-->>-Server: ON_TIME/LATE/GRACE
    Server->>+Database: Save Attendance Event
    Database-->>-Server: Event Saved
    Server->>+WebSocket: Emit Realtime Event
    WebSocket->>+Admin Dashboard: Update Live Feed
    WebSocket->>+Employee Timeline: Update Timeline
    Server->>+Audit Log: Record Event
    Server-->>-Frontend: Success Response
    Frontend->>+Employee: Display Result
    Server->>+Next Event: Advance State Machine
```

## Event State Machine
```
NOT_STARTED → LOGIN_PENDING → LOGGED_IN → LUNCH_OUT → LUNCH_IN → TEA_OUT → TEA_IN → SIGN_OUT → COMPLETED
```

Each transition requires the previous event to be completed. Invalid transitions return a clear error message.
