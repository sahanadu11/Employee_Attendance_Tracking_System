# MongoDB → Supabase Migration Notes

## Field mapping

| MongoDB | Supabase | Notes |
|---|---|---|
| `_id` (ObjectId) | `id UUID` | generated in Postgres |
| `employeeId` string on users | `employees.user_id` FK | proper relational link replaces string join |
| mixed `$in` scope queries | RLS policies + `current_scope_section_ids()` | section/flow scoping enforced at DB level |
| `isIdempotentKey` unique partial index | `attendance_events.idempotency_key UNIQUE` | same duplicate protection |
| append-only audit via convention | `CREATE RULE ... DO INSTEAD NOTHING` | immutability enforced by database |
| `deviceInfo` sub-document | `JSONB` | schema-flexible parity |
| Mongoose population | Postgres JOINs / views | services stay unchanged, data layer swapped |

## Cutover checklist

1. Run `001_initial_schema.sql` then `002_seed_data.sql` in Supabase.
2. Add `pg_trgm` extension for the name search index (`CREATE EXTENSION pg_trgm;`).
3. Enable RLS on all tables; policies use `current_user_role()` /
   `current_scope_section_ids()` so section admins can only SELECT their rows.
4. Write a one-off ETL: export Mongo collections to JSON
   (`mongoexport`), transform ObjectIds → UUIDs preserving a mapping table,
   bulk-load with `COPY`.
5. Swap `backend/models/*` implementations to the Postgres client
   (Prisma recommended — the schema above maps 1:1 to Prisma models).
   The service layer (`backend/services/*`) is data-access agnostic.
6. Re-run the full API test suite (`backend/tests/`) against the new layer.
7. Dual-write (Mongo + Supabase) for one release cycle before switching reads.
