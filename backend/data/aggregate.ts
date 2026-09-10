/**
 * MongoDB aggregation pipeline evaluator (JS side) for the Supabase driver.
 *
 * The leading `$match` stage of a pipeline is pushed down to SQL (see shim),
 * the remaining stages execute here over the fetched rows. This covers every
 * pipeline the application uses: $match, $group, $sort, $limit, $skip,
 * $project, $count, $unwind — with accumulators $sum/$avg/$min/$max/$first/
 * $last/$push/$addToSet and expressions $cond, $in, date extractors and
 * arithmetic helpers.
 */

export function runPipeline(rows: any[], pipeline: any[]): any[] {
  let data = rows;
  for (const stage of pipeline || []) {
    const op = Object.keys(stage || {})[0];
    if (!op) continue;
    const arg = (stage as any)[op];
    switch (op) {
      case '$match':
        data = data.filter((row) => matchDocument(row, arg));
        break;
      case '$group':
        data = groupStage(data, arg);
        break;
      case '$sort':
        data = sortStage(data, arg);
        break;
      case '$limit':
        data = data.slice(0, Number(arg) || 0);
        break;
      case '$skip':
        data = data.slice(Number(arg) || 0);
        break;
      case '$project':
        data = data.map((row) => projectStage(row, arg));
        break;
      case '$count':
        data = [{ [String(arg)]: data.length }];
        break;
      case '$unwind': {
        const path = typeof arg === 'string' ? arg : arg?.path;
        const field = String(path || '').replace(/^\$/, '');
        const out: any[] = [];
        for (const row of data) {
          const arr = getPath(row, field);
          if (Array.isArray(arr)) for (const item of arr) out.push({ ...row, [field]: item });
          else if (arr !== undefined && arr !== null) out.push(row);
        }
        data = out;
        break;
      }
      default:
        throw new Error(`[supabase-driver] unsupported aggregation stage: ${op}`);
    }
  }
  return data;
}

// ---------------------------------------------------------------------------
// $match — full in-memory evaluation (also used for non-leading $match)
// ---------------------------------------------------------------------------

export function matchDocument(doc: any, filter: any): boolean {
  if (!filter || typeof filter !== 'object') return true;
  for (const key of Object.keys(filter)) {
    const cond = filter[key];
    if (key === '$and') {
      if (!cond.every((f: any) => matchDocument(doc, f))) return false;
    } else if (key === '$or') {
      if (!cond.some((f: any) => matchDocument(doc, f))) return false;
    } else if (key === '$nor') {
      if (cond.some((f: any) => matchDocument(doc, f))) return false;
    } else if (key.startsWith('$')) {
      throw new Error(`[supabase-driver] unsupported $match operator ${key}`);
    } else if (!matchField(doc[key], cond)) {
      return false;
    }
  }
  return true;
}

function matchField(value: any, cond: any): boolean {
  if (cond !== null && typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond)) {
    for (const op of Object.keys(cond)) {
      const target = cond[op];
      switch (op) {
        case '$eq':
          if (!looseEqual(value, target)) return false;
          break;
        case '$ne':
          if (looseEqual(value, target)) return false;
          break;
        case '$in':
          if (!target.some((t: any) => looseEqual(value, t))) return false;
          break;
        case '$nin':
          if (target.some((t: any) => looseEqual(value, t))) return false;
          break;
        case '$gt':
          if (!(compare(value, target) > 0)) return false;
          break;
        case '$gte':
          if (!(compare(value, target) >= 0)) return false;
          break;
        case '$lt':
          if (!(compare(value, target) < 0)) return false;
          break;
        case '$lte':
          if (!(compare(value, target) <= 0)) return false;
          break;
        case '$exists':
          if ((value !== undefined && value !== null) !== !!target) return false;
          break;
        case '$regex': {
          const flags = cond.$options || '';
          const re = target instanceof RegExp ? target : new RegExp(target, flags);
          if (!re.test(String(value ?? ''))) return false;
          break;
        }
        case '$options':
          break;
        default:
          throw new Error(`[supabase-driver] unsupported $match field operator ${op}`);
      }
    }
    return true;
  }
  if (Array.isArray(cond)) return cond.some((t: any) => looseEqual(value, t));
  return looseEqual(value, cond);
}

function looseEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(keyOrder(a)) === JSON.stringify(keyOrder(b));
  }
  return false;
}

function keyOrder(obj: any): any {
  if (Array.isArray(obj)) return obj.map(keyOrder);
  if (obj && typeof obj === 'object') {
    return Object.keys(obj)
      .sort()
      .reduce((acc: any, k) => ((acc[k] = keyOrder(obj[k])), acc), {});
  }
  return obj;
}

function compare(a: any, b: any): number {
  const av = a instanceof Date ? a.getTime() : a;
  const bv = b instanceof Date ? b.getTime() : b;
  if (av === bv) return 0;
  if (av === undefined || av === null) return -1;
  if (bv === undefined || bv === null) return 1;
  return av > bv ? 1 : -1;
}

// ---------------------------------------------------------------------------
// $sort
// ---------------------------------------------------------------------------

function sortStage(rows: any[], spec: Record<string, 1 | -1>): any[] {
  const keys = Object.keys(spec);
  const sorted = [...rows];
  sorted.sort((a, b) => {
    for (const key of keys) {
      const dir = spec[key] === -1 || String(spec[key]).toLowerCase() === 'desc' ? -1 : 1;
      const cmp = compare(getPath(a, key), getPath(b, key));
      if (cmp !== 0) return cmp * dir;
    }
    return 0;
  });
  return sorted;
}

// ---------------------------------------------------------------------------
// $group
// ---------------------------------------------------------------------------

function groupStage(rows: any[], spec: any): any[] {
  const idExpr = spec._id !== undefined ? spec._id : null;
  const buckets = new Map<string, { key: any; docs: any[] }>();

  for (const row of rows) {
    const key = evaluate(idExpr, row);
    const hash = stableHash(key);
    if (!buckets.has(hash)) buckets.set(hash, { key, docs: [] });
    buckets.get(hash)!.docs.push(row);
  }

  const out: any[] = [];
  for (const bucket of buckets.values()) {
    const result: any = { _id: bucket.key };
    for (const field of Object.keys(spec)) {
      if (field === '_id') continue;
      result[field] = accumulate(spec[field], bucket.docs);
    }
    out.push(result);
  }
  return out;
}

function accumulate(spec: any, docs: any[]): any {
  const op = Object.keys(spec || {})[0];
  if (!op) return undefined;
  const arg = spec[op];
  const values = () => docs.map((d) => evaluate(arg, d)).filter((v) => v !== undefined && v !== null);
  switch (op) {
    case '$sum': {
      if (arg === 1 || arg === true) return docs.length;
      return values().reduce((a: number, b: any) => a + Number(b || 0), 0);
    }
    case '$avg': {
      const vals = values().map((v: any) => Number(v));
      if (!vals.length) return null;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    case '$max': {
      const vals = values();
      if (!vals.length) return null;
      return vals.reduce((a: any, b: any) => (compare(b, a) > 0 ? b : a));
    }
    case '$min': {
      const vals = values();
      if (!vals.length) return null;
      return vals.reduce((a: any, b: any) => (compare(b, a) < 0 ? b : a));
    }
    case '$first':
      return docs.length ? evaluate(arg, docs[0]) : null;
    case '$last':
      return docs.length ? evaluate(arg, docs[docs.length - 1]) : null;
    case '$push':
      return docs.map((d) => evaluate(arg, d)).filter((v) => v !== undefined);
    case '$addToSet': {
      const seen = new Set<string>();
      const out: any[] = [];
      for (const v of docs.map((d) => evaluate(arg, d))) {
        const h = stableHash(v);
        if (!seen.has(h)) {
          seen.add(h);
          out.push(v);
        }
      }
      return out;
    }
    case '$count':
      return docs.length;
    default:
      throw new Error(`[supabase-driver] unsupported accumulator ${op}`);
  }
}

// ---------------------------------------------------------------------------
// $project
// ---------------------------------------------------------------------------

function projectStage(row: any, spec: any): any {
  const out: any = {};
  for (const key of Object.keys(spec)) {
    const rule = spec[key];
    if (rule === true || rule === 1) {
      const v = getPath(row, key);
      if (v !== undefined) out[key] = v;
    } else if (rule === false || rule === 0) {
      delete out[key];
    } else {
      out[key] = evaluate(rule, row);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Expression evaluation
// ---------------------------------------------------------------------------

export function evaluate(expr: any, doc: any): any {
  if (typeof expr === 'string') {
    if (expr === '$$ROOT') return doc;
    if (expr.startsWith('$$ROOT.')) return getPath(doc, expr.slice('$$ROOT.'.length));
    if (expr.startsWith('$')) return getPath(doc, expr.slice(1));
    return expr;
  }
  if (expr === null || expr === undefined) return expr;
  if (typeof expr !== 'object') return expr;
  if (expr instanceof Date) return expr;
  if (Array.isArray(expr)) return expr.map((e) => evaluate(e, doc));

  const op = Object.keys(expr)[0];
  const args = (expr as any)[op];
  switch (op) {
    case '$cond': {
      const [cond, thenE, elseE] = Array.isArray(args) ? args : [args.if, args.then, args.else];
      const c = evaluate(cond, doc);
      return truthy(c) ? evaluate(thenE, doc) : evaluate(elseE, doc);
    }
    case '$in': {
      const [needleE, haystackE] = args;
      const needle = evaluate(needleE, doc);
      const haystack = evaluate(haystackE, doc) || [];
      return (Array.isArray(haystack) ? haystack : []).some((h: any) => looseEqual(h, needle));
    }
    case '$ifNull':
      return evaluate(args[0], doc) ?? evaluate(args[1], doc);
    case '$add':
      return (Array.isArray(args) ? args : [args]).reduce((a: number, e: any) => a + Number(evaluate(e, doc) || 0), 0);
    case '$subtract': {
      const [a, b] = Array.isArray(args) ? args : [args, 0];
      return Number(evaluate(a, doc) || 0) - Number(evaluate(b, doc) || 0);
    }
    case '$multiply':
      return (Array.isArray(args) ? args : [args]).reduce((a: number, e: any) => a * Number(evaluate(e, doc) || 0), 1);
    case '$divide': {
      const [a, b] = Array.isArray(args) ? args : [args, 1];
      const denom = Number(evaluate(b, doc));
      return denom === 0 ? null : Number(evaluate(a, doc)) / denom;
    }
    case '$abs':
      return Math.abs(Number(evaluate(args, doc) || 0));
    case '$hour':
    case '$minute':
    case '$second': {
      const d = toDate(evaluate(args, doc));
      if (!d) return null;
      if (op === '$hour') return d.getUTCHours();
      if (op === '$minute') return d.getUTCMinutes();
      return d.getUTCSeconds();
    }
    case '$year':
    case '$month':
    case '$dayOfMonth': {
      const d = toDate(evaluate(args, doc));
      if (!d) return null;
      if (op === '$year') return d.getUTCFullYear();
      if (op === '$month') return d.getUTCMonth() + 1;
      return d.getUTCDate();
    }
    case '$dayOfWeek': {
      const d = toDate(evaluate(args, doc));
      return d ? d.getUTCDay() + 1 : null; // mongo: 1 = Sunday
    }
    case '$dateToString': {
      const d = toDate(evaluate(args.date ?? args, doc));
      if (!d) return null;
      const format: string = args.format ?? '%Y-%m-%d';
      return format
        .replace(/%Y/g, String(d.getUTCFullYear()).padStart(4, '0'))
        .replace(/%m/g, String(d.getUTCMonth() + 1).padStart(2, '0'))
        .replace(/%d/g, String(d.getUTCDate()).padStart(2, '0'))
        .replace(/%H/g, String(d.getUTCHours()).padStart(2, '0'))
        .replace(/%M/g, String(d.getUTCMinutes()).padStart(2, '0'))
        .replace(/%S/g, String(d.getUTCSeconds()).padStart(2, '0'));
    }
    case '$toString': {
      const v = evaluate(args, doc);
      return v === null || v === undefined ? null : String(v);
    }
    case '$concat': {
      const parts = (Array.isArray(args) ? args : [args]).map((e: any) => evaluate(e, doc));
      return parts.some((p: any) => p === null || p === undefined) ? null : parts.map(String).join('');
    }
    case '$literal':
      return args;
    case '$size': {
      const v = evaluate(args, doc);
      return Array.isArray(v) ? v.length : 0;
    }
    default:
      // Not an operator → object of expressions (e.g. `{ y: {$year: …} }`)
      if (!op.startsWith('$')) {
        const out: any = {};
        for (const key of Object.keys(expr)) out[key] = evaluate(expr[key], doc);
        return out;
      }
      throw new Error(`[supabase-driver] unsupported aggregation expression ${op}`);
  }
}

function truthy(v: any): boolean {
  return v === true || v === 1 || (typeof v === 'string' && v === 'true');
}

function toDate(v: any): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

export function getPath(obj: any, path: string): any {
  if (!path) return obj;
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined) return undefined;
    cur = cur[p];
  }
  return cur;
}

function stableHash(value: any): string {
  if (value === null || value === undefined) return String(value);
  if (value instanceof Date) return `D${value.toISOString()}`;
  if (typeof value === 'object') return JSON.stringify(keyOrder(value));
  return `${typeof value}:${String(value)}`;
}
