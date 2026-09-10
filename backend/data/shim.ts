import mongoose, { Schema } from 'mongoose';
import { DATA_DRIVER, query, newId, isUniqueViolation } from './driver';
import { buildTableDef, TableDef, registerTable, refTableFor } from './tableMap';
import { buildWhere, buildOrderBy, buildUpdateSet, buildProjection, quoteIdent } from './sqlgen';
import { runPipeline } from './aggregate';
import { logger } from '../utils/logger';

/**
 * getModel(name, schema) — the single entry point used by backend/models.
 *
 *  mongo driver    → returns the real mongoose model (unchanged behaviour).
 *  supabase driver → returns a Postgres-backed model implementing the same
 *                    API surface the application uses (find/findOne/findById/
 *                    countDocuments/estimatedDocumentCount/exists/create/
 *                    insertMany/updateOne/updateMany/findOneAndUpdate/
 *                    findByIdAndUpdate/findByIdAndDelete/deleteOne/deleteMany/
 *                    distinct/aggregate), with chainable query helpers
 *                    (sort/skip/limit/select/populate/lean), document .save()
 *                    with modified-path tracking, schema defaults/casts and
 *                    schema instance methods.
 */

/**
 * Returns `any` deliberately: annotating this as mongoose.Model<T> forces the
 * compiler to prove assignability between two enormous mongoose generic
 * instantiations for every model, which exhausts memory. Callers keep using
 * the models exactly as before; runtime behaviour is identical both ways.
 */
export function getModel<T extends mongoose.Document>(name: string, schema: Schema<any>): any {
  if (DATA_DRIVER === 'mongo') {
    // Call through an erased signature: invoking mongoose.model with an
    // abstract type parameter makes tsc instantiate mongoose's enormous
    // generic model types and exhaust memory.
    const declareModel = mongoose.model as unknown as (name: string, schema: Schema<any>) => any;
    return declareModel(name, schema);
  }
  const def = buildTableDef(name, schema);
  (def as any).__paths = (schema as any).paths || {};
  registerTable(def);
  const model = makePgModel(def);
  MODEL_INSTANCES[name] = model;
  logger.info(`[supabase-driver] model ready: ${name} → table "${def.table}" (${def.columns.length} columns)`);
  return model;
}

/** Registry of live supabase-driver models, used to resolve populate() refs. */
const MODEL_INSTANCES: Record<string, PgModelCtor> = {};

function modelForRef(refName: string): PgModelCtor | undefined {
  return MODEL_INSTANCES[refName];
}

type PgModelCtor = any;

// ---------------------------------------------------------------------------
// Value codec
// ---------------------------------------------------------------------------

function encodeIn(def: TableDef, field: string, value: any): any {
  const col = def.columns.find((c) => c.name === field);
  if (!col) return value;
  if (value === undefined) return null;
  // Schema-level string casting (lowercase/uppercase/trim), mirroring mongoose
  const path: any = (def as any).__paths?.[field];
  const opts = path?.options || {};
  if (typeof value === 'string' && !col.ref && col.sqlType === 'TEXT') {
    if (opts.lowercase) value = value.toLowerCase();
    if (opts.uppercase) value = value.toUpperCase();
    if (opts.trim) value = value.trim();
  }
  if (value === null) return null;
  if (col.sqlType === 'JSONB') {
    if (col.ref && Array.isArray(value)) {
      return JSON.stringify(value.map((v) => (v && typeof v === 'object' ? v._id ?? v.id : v)));
    }
    return JSON.stringify(value);
  }
  if (col.ref && typeof value === 'object' && !(value instanceof Date)) {
    return (value as any)._id ?? String(value);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Document (Proxy-based, tracks modified paths like mongoose does)
// ---------------------------------------------------------------------------

interface DocCore {
  [key: string]: any;
  _id: string;
  __def: TableDef;
  __isNew: boolean;
  __touched: Set<string>;
}

function createDoc(def: TableDef, data: Record<string, any>, options: { isNew?: boolean } = {}): any {
  const core: DocCore = { ...(data || {}) } as any;
  core._id = typeof core._id === 'string' && core._id ? core._id : newId();
  core.__def = def;
  core.__isNew = !!options.isNew;
  core.__touched = new Set<string>();

  if (core.__isNew) {
    Object.keys(core).forEach((k) => core.__touched.add(k));
    applyDefaults(def, core);
    ensureTimestamps(def, core, 'insert');
  }

  const proxy = new Proxy(core, {
    set(target: any, prop: string | symbol, value: any): boolean {
      if (typeof prop === 'string' && !prop.startsWith('__')) target.__touched.add(prop);
      target[prop] = value;
      return true;
    },
  });

  // Instance methods declared on the mongoose schema (e.g. user.isLocked())
  for (const [methodName, fn] of Object.entries(def.methods || {})) {
    if (typeof fn === 'function') {
      proxy[methodName] = (fn as (...args: any[]) => any).bind(proxy);
    }
  }
  return proxy;
}

function applyDefaults(def: TableDef, doc: DocCore): void {
  for (const col of def.columns) {
    if (doc[col.name] !== undefined) continue;
    const schemaPath: any = (def as any).__paths?.[col.name];
    if (schemaPath && typeof schemaPath.getDefault === 'function') {
      try {
        const dflt = schemaPath.getDefault({ call: 'get' });
        if (dflt !== undefined) doc[col.name] = typeof dflt === 'function' ? dflt.call(doc) : dflt;
      } catch {
        /* defaults that require a mongoose context are skipped */
      }
    }
  }
}

function ensureTimestamps(def: TableDef, doc: DocCore, mode: 'insert' | 'update'): void {
  const now = new Date();
  if (mode === 'insert' && doc.createdAt === undefined) doc.createdAt = now;
  doc.updatedAt = now;
}

async function saveDoc(self: DocCore): Promise<void> {
  const def = self.__def;
  if (self.__isNew) {
    ensureTimestamps(def, self, 'insert');
    const cols = def.columns.filter((c) => self[c.name] !== undefined || c.name === '_id');
    const values = cols.map((c) => encodeIn(def, c.name, self[c.name]));
    await query(
      `INSERT INTO ${quoteIdent(def.table)} (${cols.map((c) => quoteIdent(c.name)).join(', ')}) VALUES (${cols
        .map((_, i) => `$${i + 1}`)
        .join(', ')})`,
      values
    );
    self.__isNew = false;
    return;
  }

  ensureTimestamps(def, self, 'update');
  const changed = def.columns.filter((c) => c.name !== '_id' && self.__touched.has(c.name));
  if (!changed.length) return;
  const values = changed.map((c) => encodeIn(def, c.name, self[c.name]));
  await query(
    `UPDATE ${quoteIdent(def.table)} SET ${changed
      .map((c, i) => `${quoteIdent(c.name)} = $${i + 1}`)
      .join(', ')} WHERE "_id" = $${changed.length + 1}`,
    [...values, self._id]
  );
}

function docToObject(self: DocCore): Record<string, any> {
  const out: any = {};
  for (const key of Object.keys(self)) {
    if (key.startsWith('__')) continue;
    out[key] = self[key];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Query builder
// ---------------------------------------------------------------------------

interface PopulateSpec {
  field: string;
  select?: string;
}

class PgQuery {
  def: TableDef;
  filter: Record<string, any>;
  private sortSpec?: Record<string, any>;
  private skipN?: number;
  private limitN?: number;
  private selectSpec?: string | Record<string, 0 | 1>;
  private populates: PopulateSpec[] = [];
  private leanFlag = false;
  private single: boolean;

  constructor(def: TableDef, filter: Record<string, any> = {}, single = false) {
    this.def = def;
    this.filter = filter || {};
    this.single = single;
  }

  sort(spec: Record<string, any> | string): this {
    this.sortSpec = typeof spec === 'string' ? stringToSort(spec) : spec;
    return this;
  }
  skip(n: number): this {
    this.skipN = n;
    return this;
  }
  limit(n: number): this {
    this.limitN = n;
    return this;
  }
  select(spec: string | Record<string, 0 | 1>): this {
    this.selectSpec = spec;
    return this;
  }
  populate(field: string | any, select?: string): this {
    if (typeof field === 'object' && field?.path) {
      this.populates.push({ field: field.path, select: field.select });
    } else if (typeof field === 'string') {
      this.populates.push({ field, select });
    }
    return this;
  }
  lean(_flag = true): this {
    this.leanFlag = true;
    return this;
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.exec().then(onfulfilled, onrejected);
  }

  async exec(): Promise<any> {
    const def = this.def;
    const where = buildWhere(def, this.filter);
    let sql = `SELECT ${buildProjection(def, this.selectSpec)} FROM ${quoteIdent(def.table)} WHERE ${where.sql}${buildOrderBy(
      def,
      this.sortSpec
    )}`;
    const params = [...where.params];
    if (this.skipN) {
      params.push(this.skipN);
      sql += ` OFFSET $${params.length}`;
    }
    const effectiveLimit = this.single ? 1 : this.limitN;
    if (effectiveLimit !== undefined) {
      params.push(effectiveLimit);
      sql += ` LIMIT $${params.length}`;
    }
    const res = await query(sql, params);
    let rows: any[] = res.rows;
    if (this.populates.length) rows = await this.applyPopulates(rows);
    const docs = this.leanFlag ? rows : rows.map((r) => createDoc(def, r, { isNew: false }));
    return this.single ? docs[0] ?? null : docs;
  }

  private async applyPopulates(rows: any[]): Promise<any[]> {
    for (const spec of this.populates) {
      const col = this.def.columns.find((c) => c.name === spec.field);
      const refDef = col && refTableFor(col);
      const refModel = col?.ref ? modelForRef(col.ref) : undefined;
      if (!refDef || !refModel) continue;
      const ids = new Set<string>();
      for (const row of rows) {
        const v = row[spec.field];
        if (Array.isArray(v)) v.forEach((x) => x && ids.add(String(typeof x === 'object' ? x._id : x)));
        else if (v) ids.add(String(typeof v === 'object' ? v._id : v));
      }
      if (!ids.size) {
        for (const row of rows) row[spec.field] = Array.isArray(row[spec.field]) ? [] : null;
        continue;
      }
      const q = new PgQuery(refDef, { _id: { $in: Array.from(ids) } });
      q.lean(true);
      if (spec.select) q.select(spec.select);
      const refDocs: any[] = await q.exec();
      const byId = new Map(refDocs.map((d) => [String(d._id), d]));
      for (const row of rows) {
        const v = row[spec.field];
        if (Array.isArray(v)) {
          row[spec.field] = v
            .map((x) => byId.get(String(typeof x === 'object' ? x._id : x)))
            .filter(Boolean);
        } else if (v) {
          row[spec.field] = byId.get(String(typeof v === 'object' ? v._id : v)) ?? null;
        } else {
          row[spec.field] = null;
        }
      }
    }
    return rows;
  }
}

function stringToSort(spec: string): Record<string, any> {
  const out: Record<string, any> = {};
  for (const token of spec.split(/\s+/).filter(Boolean)) {
    if (token.startsWith('-')) out[token.slice(1)] = -1;
    else out[token] = 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

function makePgModel(def: TableDef): PgModelCtor {
  class PgModel {
    static def = def;

    constructor(data?: Record<string, any>) {
      return createDoc(def, data || {}, { isNew: true });
    }

    static find(filter?: Record<string, any>): PgQuery {
      return new PgQuery(def, filter || {});
    }

    static findOne(filter?: Record<string, any>): PgQuery {
      return new PgQuery(def, filter || {}, true);
    }

    static findById(id: string): PgQuery {
      return new PgQuery(def, { _id: id }, true);
    }

    static async countDocuments(filter?: Record<string, any>): Promise<number> {
      const where = buildWhere(def, filter);
      const res = await query(`SELECT COUNT(*)::int AS n FROM ${quoteIdent(def.table)} WHERE ${where.sql}`, where.params);
      return res.rows[0]?.n ?? 0;
    }

    static async estimatedDocumentCount(): Promise<number> {
      const res = await query(`SELECT COUNT(*)::int AS n FROM ${quoteIdent(def.table)}`);
      return res.rows[0]?.n ?? 0;
    }

    static async exists(filter: Record<string, any>): Promise<{ _id: string } | null> {
      const where = buildWhere(def, filter);
      const res = await query(`SELECT "_id" FROM ${quoteIdent(def.table)} WHERE ${where.sql} LIMIT 1`, where.params);
      return res.rows[0] ? { _id: res.rows[0]._id } : null;
    }

    static async create(docs: any): Promise<any> {
      const many = Array.isArray(docs);
      const list = many ? docs : [docs];
      const out: any[] = [];
      for (const data of list) {
        const doc = createDoc(def, data || {}, { isNew: true });
        try {
          await saveDoc(doc);
        } catch (err: any) {
          if (isUniqueViolation(err)) err.code = 11000;
          throw err;
        }
        out.push(doc);
      }
      return many ? out : out[0];
    }

    static async insertMany(docs: any[]): Promise<any[]> {
      const out: any[] = [];
      for (const data of docs || []) {
        const doc = createDoc(def, data || {}, { isNew: true });
        await saveDoc(doc);
        out.push(doc);
      }
      return out;
    }

    static async updateOne(filter: Record<string, any>, update: any): Promise<{ acknowledged: boolean; modifiedCount: number; matchedCount: number }> {
      const count = await applyUpdate(def, filter, update, 1);
      return { acknowledged: true, modifiedCount: count, matchedCount: count };
    }

    static async updateMany(filter: Record<string, any>, update: any): Promise<{ acknowledged: boolean; modifiedCount: number }> {
      const count = await applyUpdate(def, filter, update, 1);
      return { acknowledged: true, modifiedCount: count };
    }

    static async findOneAndUpdate(filter: Record<string, any>, update: any, opts?: any): Promise<any> {
      const existing: any = await new PgQuery(def, filter, true).lean(true).exec();
      if (existing) {
        await applyUpdate(def, { _id: existing._id }, update, 1);
        if (opts && opts.new) {
          return new PgQuery(def, { _id: existing._id }, true).lean(!!opts.lean).exec();
        }
        return existing;
      }
      if (opts && opts.upsert) {
        const merged: any = { ...equalitiesFromFilter(filter) };
        const body = update && update.$set !== undefined ? update.$set : update;
        for (const key of Object.keys(body || {})) {
          if (!key.startsWith('$')) merged[key] = body[key];
        }
        const doc = createDoc(def, merged, { isNew: true });
        try {
          await saveDoc(doc);
        } catch (err: any) {
          if (isUniqueViolation(err)) {
            const { _id, ...withoutId } = merged;
            return PgModel.findOneAndUpdate(withoutId, update, { ...opts, upsert: false });
          }
          throw err;
        }
        if (opts && opts.new) return doc;
        return merged;
      }
      return null;
    }

    static async findByIdAndUpdate(id: string, update: any, opts?: any): Promise<any> {
      return PgModel.findOneAndUpdate({ _id: id }, update, opts);
    }

    static async findByIdAndDelete(id: string): Promise<any> {
      const doc: any = await new PgQuery(def, { _id: id }, true).lean(true).exec();
      if (doc) await PgModel.deleteOne({ _id: id });
      return doc ?? null;
    }

    static async deleteOne(filter: Record<string, any>): Promise<{ deletedCount: number }> {
      const where = buildWhere(def, filter);
      const res = await query(
        `DELETE FROM ${quoteIdent(def.table)} WHERE "_id" IN (SELECT "_id" FROM ${quoteIdent(def.table)} WHERE ${where.sql} LIMIT 1)`,
        where.params
      );
      return { deletedCount: res.rowCount ?? 0 };
    }

    static async deleteMany(filter: Record<string, any> = {}): Promise<{ deletedCount: number }> {
      const where = buildWhere(def, filter);
      const res = await query(`DELETE FROM ${quoteIdent(def.table)} WHERE ${where.sql}`, where.params);
      return { deletedCount: res.rowCount ?? 0 };
    }

    static async distinct(field: string, filter?: Record<string, any>): Promise<any[]> {
      const where = buildWhere(def, filter);
      const res = await query(
        `SELECT DISTINCT ${quoteIdent(field)} AS v FROM ${quoteIdent(def.table)} WHERE ${where.sql}`,
        where.params
      );
      return res.rows.map((r) => r.v).filter((v) => v !== null && v !== undefined);
    }

    static async aggregate(pipeline: any[]): Promise<any[]> {
      if (!Array.isArray(pipeline) || !pipeline.length) return [];
      let filter: Record<string, any> = {};
      const rest = [...pipeline];
      while (rest.length && rest[0] && rest[0].$match !== undefined) {
        filter = { ...filter, ...rest[0].$match };
        rest.shift();
      }
      const where = buildWhere(def, filter);
      const cap = parseInt(process.env.AGGREGATE_ROW_CAP || '200000', 10);
      const res = await query(`SELECT * FROM ${quoteIdent(def.table)} WHERE ${where.sql} LIMIT ${cap}`, where.params);
      return runPipeline(res.rows, rest);
    }

    static watch(): never {
      throw new Error('[supabase-driver] change streams are not supported; use socket.io events');
    }
  }

  return PgModel as PgModelCtor;
}

async function applyUpdate(def: TableDef, filter: Record<string, any>, update: any, _start: number): Promise<number> {
  const built = buildUpdateSet(def, update, 1);
  const params: any[] = [...built.params];
  let setSql = built.sql;
  for (const [field, value] of Object.entries(built.pushColumns)) {
    params.push(JSON.stringify([value]));
    setSql += `${setSql ? ', ' : ''}${quoteIdent(field)} = COALESCE(${quoteIdent(
      field
    )}, '[]'::jsonb) || $${params.length}::jsonb`;
  }
  if (!setSql) return 0;
  const where = buildWhere(def, filter, params.length + 1);
  const res = await query(`UPDATE ${quoteIdent(def.table)} SET ${setSql} WHERE ${where.sql}`, [...params, ...where.params]);
  return res.rowCount ?? 0;
}

function equalitiesFromFilter(filter: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(filter || {})) {
    if (value !== null && typeof value === 'object' && !(value instanceof Date) && !Array.isArray(value)) continue;
    out[key] = value;
  }
  return out;
}

export { createDoc, MODEL_INSTANCES };
