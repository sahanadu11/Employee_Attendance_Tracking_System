import mongoose, { Schema } from 'mongoose';

/**
 * Table definitions for the Supabase driver, derived directly from the
 * mongoose schemas that already exist in backend/models. Introspecting the
 * schemas keeps one source of truth: adding a field to a schema is all it
 * takes for both drivers (and the generated SQL) to support it.
 *
 * Column naming: quoted camelCase identifiers, identical to the mongoose
 * field names, so no name mapping can drift. `_id` is stored as `_id`.
 */

export type SqlType = 'TEXT' | 'DOUBLE PRECISION' | 'BOOLEAN' | 'TIMESTAMPTZ' | 'JSONB' | 'BIGINT';

export interface ColumnDef {
  name: string;
  sqlType: SqlType;
  ref?: string;
  unique?: boolean;
  sparseUnique?: boolean;
}

export interface IndexDef {
  columns: string[];
  unique?: boolean;
  sparse?: boolean;
}

export interface TableDef {
  model: string;
  table: string;
  columns: ColumnDef[];
  indexes: IndexDef[];
  hasTimestamps: boolean;
  methods: Record<string, (...args: any[]) => any>;
}

function instanceToSqlType(instance: string): SqlType {
  switch (instance) {
    case 'String':
      return 'TEXT';
    case 'Number':
      return 'DOUBLE PRECISION';
    case 'Boolean':
      return 'BOOLEAN';
    case 'Date':
      return 'TIMESTAMPTZ';
    case 'ObjectID':
      return 'TEXT';
    default:
      // Array, Embedded document, Mixed, Decimal128, …
      return 'JSONB';
  }
}

function refOf(path: any): string | undefined {
  const direct = path?.options?.ref;
  if (typeof direct === 'string') return direct;
  const caster = path?.caster?.options?.ref || path?.schema; // arrays / subdocs
  if (typeof caster === 'string') return caster;
  return undefined;
}

export function buildTableDef(modelName: string, schema: Schema<any>): TableDef {
  const table: string = (schema.get('collection') as string) || modelName.toLowerCase() + 's';
  const columns: ColumnDef[] = [
    { name: '_id', sqlType: 'TEXT' },
  ];
  const indexes: IndexDef[] = [];
  const paths: any = (schema as any).paths;

  for (const key of Object.keys(paths)) {
    if (key === '_id' || key === '__v') continue;
    const path: any = paths[key];
    const col: ColumnDef = {
      name: key,
      sqlType: instanceToSqlType(path.instance || ''),
      ref: refOf(path),
    };
    const opts = path.options || {};
    if (opts.unique) {
      col.unique = true;
      // Partial unique (e.g. sparse idempotency key): stored as sparseUnique
      col.sparseUnique = !!path._index?.partialFilterExpression;
    }
    columns.push(col);
  }

  // Declared secondary indexes
  for (const idx of schema.indexes() as any[]) {
    const spec = idx[0] as Record<string, number | string>;
    const opts = idx[1] as any;
    const cols = Object.keys(spec).filter((c) => c !== '_id');
    if (!cols.length) continue;
    if (cols.every((c) => columns.some((col) => col.name === c))) {
      indexes.push({ columns: cols, unique: !!opts?.unique, sparse: !!opts?.partialFilterExpression });
    }
  }

  const hasTimestamps = !!(schema.options as any).timestamps;

  return {
    model: modelName,
    table,
    columns,
    indexes,
    hasTimestamps,
    methods: (schema.methods || {}) as any,
  };
}

// ---------------------------------------------------------------------------
// Registry — populated by getModel() so populate() can resolve refs.
// ---------------------------------------------------------------------------

const tables = new Map<string, TableDef>();
const byTableName = new Map<string, TableDef>();

export function registerTable(def: TableDef): void {
  tables.set(def.model, def);
  byTableName.set(def.table, def);
}

export function getTable(modelName: string): TableDef {
  const def = tables.get(modelName);
  if (!def) throw new Error(`[supabase-driver] model not registered: ${modelName}`);
  return def;
}

export function getTableByCollection(collection: string): TableDef | undefined {
  return byTableName.get(collection);
}

export function allTables(): TableDef[] {
  return Array.from(tables.values());
}

/** mongoose ref names are model names; map to their table defs. */
export function refTableFor(col: ColumnDef): TableDef | undefined {
  if (!col.ref) return undefined;
  return tables.get(col.ref);
}

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
