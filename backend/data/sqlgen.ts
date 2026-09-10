import { TableDef, ColumnDef } from './tableMap';

/**
 * Pure SQL generation for the Supabase driver — mongoose-style filters,
 * sorts, updates and projections → parameterised Postgres statements.
 * Kept free of I/O so it can be unit tested without a database.
 */

const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function quoteIdent(name: string): string {
  if (!IDENT_RE.test(name)) throw new Error(`[supabase-driver] illegal identifier: ${name}`);
  return `"${name}"`;
}

export function columnOf(table: TableDef, field: string): ColumnDef | undefined {
  return table.columns.find((c) => c.name === field);
}

export function hasColumn(table: TableDef, field: string): boolean {
  return !!columnOf(table, field);
}

/**
 * Compile a mongoose-style filter into a WHERE clause.
 * Supports: equality, $eq/$ne, $in/$nin, $gt/$gte/$lt/$lte, $exists,
 * $regex (+ $options 'i'), $or, $and, $nor.
 */
export function buildWhere(
  table: TableDef,
  filter: Record<string, any> | null | undefined,
  startParam = 1
): { sql: string; params: any[] } {
  const params: any[] = [];
  const clauses: string[] = [];

  const push = (clause: string, value?: any) => {
    if (value !== undefined) params.push(value);
    clauses.push(clause);
  };

  const compileField = (field: string, cond: any): void => {
    if (!hasColumn(table, field)) {
      // Unknown field under strict schema semantics → matches nothing,
      // mirroring mongoose strict mode.
      push('FALSE');
      return;
    }
    const col = quoteIdent(field);

    if (Array.isArray(cond)) {
      // mongoose: array in a filter means "match any of these"
      if (!cond.length) {
        push('FALSE');
      } else {
        const placeholders = cond.map(() => `$${startParam + params.length + 1}`);
        params.push(...cond);
        push(`${col} IN (${placeholders.join(', ')})`);
      }
      return;
    }

    if (cond !== null && typeof cond === 'object' && cond instanceof Date === false) {
      const ops = Object.keys(cond);
      const logical = ['$or', '$and', '$nor'].filter((o) => ops.includes(o));
      if (logical.length) {
        for (const op of logical) {
          const branches = cond[op] as any[];
          const parts = branches.map((branch: any) => {
            const sub = buildWhere(table, branch, startParam + params.length);
            params.push(...sub.params);
            return sub.sql;
          });
          const joiner = op === '$or' ? ' OR ' : op === '$nor' ? ' AND NOT ' : ' AND ';
          push(`(${parts.join(op === '$nor' ? joiner : joiner)})`);
        }
      }
      for (const op of ops) {
        if (['$or', '$and', '$nor'].includes(op)) continue;
        const value = cond[op];
        switch (op) {
          case '$eq':
            push(`${col} = $${startParam + params.length}`, value);
            break;
          case '$ne':
            push(`${col} <> $${startParam + params.length}`, value);
            break;
          case '$in': {
            if (!Array.isArray(value)) throw new Error('$in requires an array');
            if (!value.length) {
              push('FALSE');
              break;
            }
            const placeholders = value.map((v: any) => `$${startParam + params.length + 1}`);
            params.push(...value);
            push(`${col} IN (${placeholders.join(', ')})`);
            break;
          }
          case '$nin': {
            if (!Array.isArray(value)) throw new Error('$nin requires an array');
            if (!value.length) {
              push('TRUE');
              break;
            }
            const placeholders = value.map((v: any) => `$${startParam + params.length + 1}`);
            params.push(...value);
            push(`(${col} NOT IN (${placeholders.join(', ')}) OR ${col} IS NULL)`);
            break;
          }
          case '$gt':
            push(`${col} > $${startParam + params.length}`, value);
            break;
          case '$gte':
            push(`${col} >= $${startParam + params.length}`, value);
            break;
          case '$lt':
            push(`${col} < $${startParam + params.length}`, value);
            break;
          case '$lte':
            push(`${col} <= $${startParam + params.length}`, value);
            break;
          case '$exists':
            push(value ? `${col} IS NOT NULL` : `${col} IS NULL`);
            break;
          case '$regex': {
            const flags = cond.$options || '';
            const pattern = String(value);
            if (flags.includes('i')) {
              push(`${col} ILIKE $${startParam + params.length}`, regexToLike(pattern));
            } else {
              push(`${col} LIKE $${startParam + params.length}`, regexToLike(pattern));
            }
            break;
          }
          case '$options':
            break; // consumed by $regex
          default:
            throw new Error(`[supabase-driver] unsupported operator ${op} on ${table.table}.${field}`);
        }
      }
      if (!ops.length) {
        // e.g. `{ field: {} }` — treat as exists
        push(`${col} IS NOT NULL`);
      }
    } else if (cond === null) {
      push(`${col} IS NULL`);
    } else {
      push(`${col} = $${startParam + params.length}`, encodeValue(cond));
    }
  };

  if (filter && typeof filter === 'object') {
    for (const key of Object.keys(filter)) {
      if (key === '$or' || key === '$and' || key === '$nor') {
        const branches = filter[key] as any[];
        if (!Array.isArray(branches) || branches.length === 0) continue;
        const parts = branches.map((branch: any) => {
          const sub = buildWhere(table, branch, startParam + params.length);
          params.push(...sub.params);
          return sub.sql;
        });
        const joiner = key === '$and' ? ' AND ' : ' OR ';
        if (key === '$nor') {
          push(`NOT (${parts.join(' OR ')})`);
        } else {
          push(`(${parts.join(joiner)})`);
        }
      } else if (key.startsWith('$')) {
        throw new Error(`[supabase-driver] unsupported top-level operator ${key}`);
      } else {
        compileField(key, filter[key]);
      }
    }
  }

  return { sql: clauses.length ? clauses.join(' AND ') : 'TRUE', params };
}

/** Mongo $regex subsets we emit (prefix/contains) translate to LIKE patterns. */
function regexToLike(pattern: string): string {
  return `%${pattern.replace(/[\\%_]/g, (m) => '\\' + m)}%`;
}

/** Encode a JS value for a parameter — Dates pass through (pg adapts them). */
export function encodeValue(value: any): any {
  if (value === undefined) return null;
  return value;
}

export type SortSpec = Record<string, 1 | -1 | 'asc' | 'desc' | any>;

export function buildOrderBy(table: TableDef, sort?: SortSpec): string {
  if (!sort || !Object.keys(sort).length) return '';
  const parts: string[] = [];
  for (const key of Object.keys(sort)) {
    if (!hasColumn(table, key)) continue;
    const dir = sort[key] === -1 || String(sort[key]).toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    parts.push(`${quoteIdent(key)} ${dir} NULLS LAST`);
  }
  return parts.length ? ` ORDER BY ${parts.join(', ')}` : '';
}

export type UpdateSpec = Record<string, any>; // plain fields and/or $set/$push/$inc/$unset

/** Build the SET clause for UPDATE from a mongoose-style update document. */
export function buildUpdateSet(
  table: TableDef,
  update: UpdateSpec,
  startParam = 1
): { sql: string; params: any[]; pushColumns: Record<string, any>; incColumns: Record<string, number> } {
  const params: any[] = [];
  const sets: string[] = [];
  const pushColumns: Record<string, any> = {};
  const incColumns: Record<string, number> = {};

  const setField = (field: string, value: any) => {
    if (!hasColumn(table, field)) return; // strict mode: strip unknown
    params.push(value === undefined ? null : value);
    sets.push(`${quoteIdent(field)} = $${startParam + params.length - 1}`);
  };

  const body = (update && (update as any).$set !== undefined ? { ...(update as any), ...(update as any).$set, $set: undefined } : update) || {};

  for (const key of Object.keys(body)) {
    if (key === '$set') continue;
    if (key === '$push') {
      for (const [f, v] of Object.entries(body.$push as Record<string, any>)) {
        if (hasColumn(table, f)) pushColumns[f] = v;
      }
      continue;
    }
    if (key === '$inc') {
      for (const [f, v] of Object.entries(body.$inc as Record<string, any>)) {
        if (hasColumn(table, f)) incColumns[f] = Number(v);
      }
      continue;
    }
    if (key === '$unset') {
      for (const f of Object.keys(body.$unset as Record<string, any>)) setField(f, null);
      continue;
    }
    if (key.startsWith('$')) continue;
    setField(key, body[key]);
  }

  for (const [f, v] of Object.entries(incColumns)) {
    params.push(v);
    sets.push(`${quoteIdent(f)} = COALESCE(${quoteIdent(f)}, 0) + $${startParam + params.length - 1}`);
  }

  if (table.hasTimestamps) {
    params.push(new Date());
    sets.push(`"updatedAt" = $${startParam + params.length - 1}`);
  }

  return { sql: sets.join(', '), params, pushColumns, incColumns };
}

/** Projection: include list, exclude list, or empty (all columns). */
export function buildProjection(table: TableDef, select?: string | Record<string, 0 | 1>): string {
  const all = table.columns.map((c) => c.name);
  if (!select) return all.map(quoteIdent).join(', ');
  if (typeof select === 'string') {
    const tokens = select.split(/\s+/).filter(Boolean);
    const plus = tokens.filter((t) => t.startsWith('+')).map((t) => t.slice(1));
    const minus = tokens.filter((t) => t.startsWith('-')).map((t) => t.slice(1));
    const bare = tokens.filter((t) => !t.startsWith('-') && !t.startsWith('+'));
    if (minus.length && !bare.length && !plus.length) {
      const excluded = new Set(minus.filter((t) => hasColumn(table, t)));
      return all.filter((c) => !excluded.has(c)).map(quoteIdent).join(', ');
    }
    const includes = [...bare, ...plus].filter((t) => hasColumn(table, t) && t !== '_id');
    return Array.from(new Set(['_id', ...includes])).map(quoteIdent).join(', ');
  }
  // object form
  const keys = Object.keys(select);
  const excluding = keys.filter((k) => !select[k]);
  if (excluding.length && !keys.some((k) => select[k])) {
    return all.filter((c) => !excluding.includes(c)).map(quoteIdent).join(', ');
  }
  const including = keys.filter((k) => select[k] && hasColumn(table, k));
  return Array.from(new Set(['_id', ...including])).map(quoteIdent).join(', ');
}
