# GPS Validation Flow

```mermaid
flowchart TD
    A[Employee Opens Attendance] --> B{GPS Available?}
    B -->|No| C[Show GPS Unavailable]
    B -->|Yes| D[Request Location Permission]
    D --> E{Permission Granted?}
    E -->|No| F[Show Permission Denied]
    E -->|Yes| G[Get Current Location]
    G --> H[Calculate Distance to Office]
    H --> I{Inside Geofence?}
    I -->|No| J[Show Outside Office Error]
    I -->|Yes| K{Accuracy Acceptable?}
    K -->|No| L[Show Accuracy Warning]
    K -->|Yes| M[Location Verified]
    M --> N[Attendance Can Be Submitted]
    J --> O[Record GPS Rejection]
    L --> P[Record GPS Issue]
```

## Accuracy Validation
- Compare GPS accuracy against configured threshold
- If accuracy > threshold, mark as INACCURATE
- Distance from office center vs geofence radius
- Both conditions must be met for VERIFIED status
