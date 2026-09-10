# Deployment Guide

## Production Deployment

### Prerequisites
- Docker and Docker Compose
- MongoDB (or use Docker)

### Docker Deployment
```bash
# Build and run
docker-compose up -d --build

# Scale the application
docker-compose up -d --build --scale app=3
```

### Manual Deployment
```bash
# Install dependencies
npm install
cd backend && npm install && npm run build
cd client && npm install && npm run build

# Seed database
cd backend && SEED=true npm start

# Start server
cd backend && npm start

# Start client (served by Express)
cd client && npm run build
```

### Environment Variables
Copy `.env.example` to `.env` and configure:
- MONGODB_URI: MongoDB connection string
- JWT_SECRET: Strong secret key
- JWT_REFRESH_SECRET: Strong refresh secret
- PORT: Server port (default 5000)
- FRONTEND_URL: Frontend URL
- NODE_ENV: production

### Monitoring
- Health endpoint: GET /api/v1/health
- Audit logs: GET /api/v1/audit
- Server logs: ./backend/logs/

### Scaling
- Use Docker Compose with multiple app instances
- MongoDB replica set for high availability
- Redis for session caching (optional)
