# Database

This folder owns everything schema-related. The live system uses **MongoDB**;
a complete **Supabase (PostgreSQL)** schema is provided for future migration.

```
database/
├── mongodb/
│   ├── SCHEMA.md            ← live Mongo collections, fields, indexes (source of truth today)
│   └── seed.ts              ← canonical seed dataset definition (used by backend)
└── supabase/
    ├── 001_initial_schema.sql  ← full Postgres schema (tables, enums, indexes, RLS)
    ├── 002_seed_data.sql       ← reference seed rows (6 shifts, 6 flows, event types, office)
    └── MIGRATION_NOTES.md      ← Mongo → Supabase mapping + cutover checklist
```

## Which database is active?

| Layer     | Status     | Where |
|-----------|-----------|-------|
| MongoDB   | **ACTIVE** | `backend/config/database.ts`, `backend/models/*` |
| Supabase  | Ready      | `database/supabase/*.sql` (not yet wired into the backend) |

The backend talks to MongoDB through Mongoose. Switching to Supabase means
replacing the `backend/models/*` data-access layer with the generated
Postgres client (or Prisma) — the service layer (`backend/services/*`) is
data-access agnostic and will not need rewriting.
