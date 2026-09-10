import { allTables, TableDef } from './tableMap';
import { quoteIdent } from './sqlgen';
import { DATA_DRIVER, query, pingDatabase } from './driver';
import { logger } from '../utils/logger';

/**
 * Generates idempotent Supabase (Postgres) DDL from the registered table
 * definitions and can apply it on boot, so a fresh Supabase project becomes
 * runnable with zero manual SQL (AUTO_SCHEMA=true, the default in dev).
 *
 * The same DDL is exported for reference: database/supabase/schema.sql.
 */

function columnDdl(def: TableDef): string[] {
  const lines: string[] = [];
  for (const col of def.columns) {
    if (col.name === '_id') {
      lines.push(`"_id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text`);
      continue;
    }
    let line = `${quoteIdent(col.name)} ${col.sqlType}`;
    if (col.unique && !col.sparseUnique) line += ' UNIQUE';
    if (col.name === 'createdAt' || col.name === 'updatedAt') line += ' DEFAULT now()';
    lines.push(line);
  }
  return lines;
}

export function generateSchemaSql(tables: TableDef[] = allTables()): string {
  const parts: string[] = [
    `-- ============================================================`,
    `-- AttendX — Supabase (PostgreSQL) runtime schema`,
    `-- Auto-generated from backend/models by backend/data/schema.ts.`,
    `-- Applied automatically on boot when AUTO_SCHEMA=true.`,
    `-- Identifiers are quoted camelCase to mirror the app data model.`,
    `-- ============================================================`,
    ``,
  ];
  for (const def of tables) {
    parts.push(`CREATE TABLE IF NOT EXISTS ${quoteIdent(def.table)} (`);
    parts.push('  ' + columnDdl(def).join(',\n  '));
    parts.push(');');
    for (const idx of def.indexes) {
      const cols = idx.columns.map(quoteIdent).join(', ');
      const name = `${def.table}_${idx.columns.join('_').toLowerCase()}${idx.unique ? '_uq' : '_idx'}`;
      if (idx.unique) {
        parts.push(
          `CREATE UNIQUE INDEX IF NOT EXISTS ${quoteIdent(name)} ON ${quoteIdent(def.table)} (${cols})${idx.sparse ? ` WHERE ${quoteIdent(idx.columns[0])} IS NOT NULL` : ''};`
        );
      } else {
        parts.push(`CREATE INDEX IF NOT EXISTS ${quoteIdent(name)} ON ${quoteIdent(def.table)} (${cols});`);
      }
    }
    // Sparse uniques declared at column level (e.g. isIdempotentKey)
    for (const col of def.columns) {
      if (col.unique && col.sparseUnique) {
        const name = `${def.table}_${col.name.toLowerCase()}_uq`;
        parts.push(
          `CREATE UNIQUE INDEX IF NOT EXISTS ${quoteIdent(name)} ON ${quoteIdent(def.table)} (${quoteIdent(col.name)}) WHERE ${quoteIdent(col.name)} IS NOT NULL;`
        );
      }
    }
    parts.push('');
  }
  return parts.join('\n');
}

/** Connect (ping) and, when AUTO_SCHEMA is not disabled, apply the DDL. */
export async function connectSupabase(): Promise<void> {
  await pingDatabase();
  logger.info('[supabase-driver] connected to Supabase Postgres');
  if ((process.env.AUTO_SCHEMA || 'true').toLowerCase() === 'false') {
    logger.info('[supabase-driver] AUTO_SCHEMA disabled — expecting tables to exist');
    return;
  }
  const ddl = generateSchemaSql();
  await query(ddl);
  logger.info('[supabase-driver] schema ensured (CREATE TABLE IF NOT EXISTS)');
}

export async function disconnectSupabase(): Promise<void> {
  const { closePool } = await import('./driver');
  if (DATA_DRIVER === 'supabase') await closePool();
}
