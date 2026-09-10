# Security Architecture

## Authentication
- JWT access tokens (15 min expiry)
- JWT refresh tokens (7 day expiry)
- Secure password hashing with bcrypt (12 rounds)
- Refresh token rotation on each use

## Authorization
- Role-Based Access Control (RBAC)
- 5 roles: SUPER_ADMIN, MAIN_ADMIN, SECTION_ADMIN, FLOW_ADMIN, EMPLOYEE
- Section-level permission enforcement
- Flow-level permission enforcement
- Employee scope restriction

## Account Security
- Maximum 3 failed login attempts
- Account lockout for 30 minutes
- Security audit logging for all login events
- Session invalidation on logout

## API Security
- Rate limiting on all endpoints
- Helmet.js for secure headers
- CORS configuration
- Input validation with Zod
- JWT authentication on all protected routes

## Data Privacy
- Employee photographs stored securely
- GPS data access restricted to authorized users
- Audit logs are append-only
- Configurable data retention policies
- No plain-text passwords stored

## Session Security
- Refresh tokens stored server-side
- Session expiration enforcement
- Device session tracking
- Back button handling via session management

## Best Practices
- Environment variables for all secrets
- No credentials in source code
- Structured logging without sensitive data
- Input sanitization on all endpoints
- CSRF protection via same-site cookies
