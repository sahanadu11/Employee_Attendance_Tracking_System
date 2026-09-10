# AERO-OPS Attendance Telemetry

Production employee attendance platform: face/photo attendance events, six configurable
shifts, six flows, GPS geofencing with accuracy policy, section/flow-scoped RBAC,
realtime dashboards, security lockouts, audit ledger, and an installable PWA.

## Repository layout (three folders)

```
backend/    Node.js + Express + TypeScript API, Mongoose models, Socket.IO, jobs, seed
frontend/   React + TypeScript PWA (AERO-OPS mission-control dashboards)
database/   MongoDB schema docs + full Supabase/PostgreSQL migration schema
docs/       Architecture, API, deployment, security documentation
docker/     Dockerfile, docker-compose, entrypoint
```

- `database/` owns the schema: live MongoDB collections (`database/mongodb/SCHEMA.md`)
  and the ready-to-run Supabase schema (`database/supabase/`).
- `shared/` code that the backend needs lives in `backend/shared/` (constants + types).

## Quick start

```bash
# 1. Install
npm install                      # root tooling
cd backend  && npm install
cd frontend && npm install

# 2. Configure
cp .env.example backend/.env     # then edit values

# 3. Seed MongoDB (6 shifts, 6 flows, 24 employees, admins, sample events)
cd backend && npm run seed

# 4. Run (two terminals)
cd backend  && npm run dev       # API on :5000
cd frontend && npm start         # PWA on :3000
```

## Demo credentials (seeded — change in production)

| Role          | Email                      | Password       |
|---------------|----------------------------|----------------|
| SUPER_ADMIN   | admin@attendance.com       | Admin123!      |
| MAIN_ADMIN    | mainadmin@attendance.com   | Admin123!      |
| SECTION_ADMIN | sectiona@attendance.com    | Password123!   |
| FLOW_ADMIN    | flow1@attendance.com       | Password123!   |
| EMPLOYEE      | see seeded employees       | Employee123!   |

## Verification commands

```bash
npm run typecheck        # tsc --noEmit for backend + frontend
npm test                 # backend jest suite
npm run build            # production builds (backend dist + frontend build)
```

## Dashboards

Command Center (KPIs, live photo flash, event stream, geofence radar, lockouts),
Live Monitor, Photo Monitor, Sections, Flows (lattice + per-flow roster), Shifts
(all-six overview + detail), Attendance, Late, Breaks, GPS Tracking, Geofence,
Event Engine, Reports, Security, Audit Ledger, Notifications, Sessions, System
Health, Settings — all role-scoped server-side and fed by real MongoDB
aggregations over `/api/v1/dashboard/*` with Socket.IO live updates.
