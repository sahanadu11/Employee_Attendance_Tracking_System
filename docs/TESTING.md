# Testing Guide

## Running Tests

### Unit Tests
```bash
cd backend && npm run test:unit
```

### Integration Tests
```bash
cd backend && npm run test:integration
```

### All Tests
```bash
cd backend && npm test
```

## Test Coverage

### Authentication Tests
- Login with valid/invalid credentials
- Token refresh
- Logout
- Account lockout after 3 failed attempts

### Authorization Tests
- Role-based access control
- Section admin scope
- Flow admin scope
- Employee self-access

### Attendance Tests
- Late calculation (various thresholds)
- On-time calculation
- Grace period
- Early arrival
- Event sequence validation
- Duplicate prevention (idempotency)

### GPS Tests
- Inside geofence validation
- Outside geofence rejection
- Accuracy threshold validation
- GPS unavailable handling

### Break Tests
- Lunch break duration calculation
- Tea break duration calculation
- Break exceed detection

### Report Tests
- Daily report generation
- Monthly report generation
- Summary report generation

### E2E Tests
- Full login → attendance → break → signout flow
- GPS rejection scenario
- Admin monitoring
- Section admin access control
- Account lock flow
