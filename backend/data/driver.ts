import { Pool, QueryResult } from 'pg';
import { logger } from '../utils/logger';

/**
 * Data driver selection.
 *
 *  - 'supabase'  → all application data is stored in Supabase Postgres.
 *                  Enabled when DATABASE_URL (or SUPABASE_DB_URL) is set,
 *                  or forced with DATA_DRIVER=supabase.
 *  - 'mongo'     → legacy development driver (MongoDB, with an automatic
 *                  in-memory server in dev). Used for zero-setup local runs
 *                  and the jest suite.
 *
 * The driver exposes the same Model API either way, so services/controllers
 * never need to know which one is active.
 */

export type DataDriver = 'supabase' | 'mongo';

export function resolveDriver(): DataDriver {
  const forced = (process.env.DATA_DRIVER || '').trim().toLowerCase();
  if (['supabase', 'postgres', 'postgresql', 'pg'].includes(forced)) return 'supabase';
  if (['mongo', 'mongodb'].includes(forced)) return 'mongo';
  if (process.env.DATABASE_URL || process.env.SUPABASE_DB_URL) return 'supabase';
  return 'mongo';
}

export const DATA_DRIVER: DataDriver = resolveDriver();

export const DATABASE_URL: string =
  process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';

let pool: Pool | null = null;

/** Shared pg pool (Supabase driver only). */
export function getPool(): Pool {
  if (!pool) {
    if (!DATABASE_URL) {
      throw new Error(
        'Supabase driver selected but DATABASE_URL is not configured. ' +
          'Set DATABASE_URL to the Supabase Postgres connection string.'
      );
    }
    const needsSsl = /supabase\.(co|com|net)/i.test(DATABASE_URL) || process.env.PGSSLMODE === 'require';
    pool = new Pool({
      connectionString: DATABASE_URL,
      max: parseInt(process.env.PGPOOL_MAX || '10', 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    });
    pool.on('error', (err) => logger.error(`[supabase-driver] pg pool error: ${err.message}`));
    logger.info(`[supabase-driver] pg pool created (max ${process.env.PGPOOL_MAX || 10})`);
  }
  return pool;
}

/** Run a parameterised statement against Supabase Postgres. */
export async function query<T extends import('pg').QueryResultRow = any>(
  sql: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  return (getPool().query as any)(sql, params) as Promise<QueryResult<T>>;
}

/** Application-side id generation — avoids reliance on DB-side defaults. */
export function newId(): string {
  return globalThis.crypto.randomUUID();
}

export async function pingDatabase(): Promise<void> {
  const res = await query('SELECT 1 AS ok');
  if (res.rows[0]?.ok !== 1) throw new Error('Supabase ping failed');
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end().catch(() => undefined);
    pool = null;
    logger.info('[supabase-driver] pg pool closed');
  }
}

/** Postgres unique-violation code, surfaced to callers like mongo's 11000. */
export const PG_UNIQUE_VIOLATION = '23505';

export function isUniqueViolation(err: any): boolean {
  return err && (err.code === PG_UNIQUE_VIOLATION || err.code === 11000);
}
