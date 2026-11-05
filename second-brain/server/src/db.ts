import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_FEEDS, DEFAULT_SETTINGS, RESOURCES, type FieldType, type ResourceDef } from './resources.js';

const DB_PATH = path.resolve(process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'second-brain.db'));
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

export type Row = Record<string, unknown>;

const SQL_TYPE: Record<FieldType, string> = { text: 'TEXT', int: 'INTEGER', real: 'REAL', bool: 'INTEGER', json: 'TEXT' };

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function migrate() {
  for (const def of Object.values(RESOURCES)) {
    db.exec(`CREATE TABLE IF NOT EXISTS ${def.table} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )`);
    const existing = new Set((db.prepare(`PRAGMA table_info(${def.table})`).all() as { name: string }[]).map((c) => c.name));
    for (const [name, type] of Object.entries(def.fields)) {
      if (!existing.has(name)) db.exec(`ALTER TABLE ${def.table} ADD COLUMN ${name} ${SQL_TYPE[type]}`);
    }
    for (const col of def.indexes ?? []) {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_${def.table}_${col} ON ${def.table}(${col})`);
    }
  }
  db.exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS uq_habit_logs ON habit_logs(habit_id, date)');

  // Primo avvio: feed di notizie di esempio
  const feeds = db.prepare('SELECT COUNT(*) AS n FROM feeds').get() as { n: number };
  const seeded = db.prepare("SELECT value FROM settings WHERE key = '_feeds_seeded'").get();
  if (feeds.n === 0 && !seeded) {
    for (const f of DEFAULT_FEEDS) create(RESOURCES.feeds, f);
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('_feeds_seeded', 'true')").run();
  }
}

// ---------- conversione valori ----------

function toDb(type: FieldType, value: unknown): SQLInputValue {
  if (value === undefined || value === null) return null;
  switch (type) {
    case 'text':
      return String(value);
    case 'int': {
      if (value === '') return null;
      const n = Number(value);
      return Number.isFinite(n) ? Math.round(n) : null;
    }
    case 'real': {
      if (value === '') return null;
      const n = Number(value);
      return Number.isFinite(n) ? n : null;
    }
    case 'bool':
      return value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;
    case 'json':
      return JSON.stringify(value);
  }
}

export function fromRow(def: ResourceDef, row: Row | undefined): Row | undefined {
  if (!row) return undefined;
  const out: Row = { ...row };
  for (const [key, type] of Object.entries(def.fields)) {
    const v = row[key];
    if (v === null || v === undefined) continue;
    if (type === 'bool') out[key] = v === 1;
    else if (type === 'json') {
      try {
        out[key] = JSON.parse(String(v));
      } catch {
        out[key] = null;
      }
    }
  }
  return out;
}

// ---------- CRUD generico ----------

export function list(def: ResourceDef, query: Record<string, unknown>): Row[] {
  const where: string[] = [];
  const params: SQLInputValue[] = [];

  for (const [rawKey, rawVal] of Object.entries(query)) {
    if (typeof rawVal !== 'string') continue;
    const negate = rawKey.endsWith('__ne');
    const key = negate ? rawKey.slice(0, -4) : rawKey;
    const type = def.fields[key];
    if (!type) continue;
    if (rawVal === 'null') {
      where.push(`${key} IS ${negate ? 'NOT ' : ''}NULL`);
    } else if (negate) {
      where.push(`(${key} IS NULL OR ${key} != ?)`);
      params.push(toDb(type, rawVal));
    } else {
      where.push(`${key} = ?`);
      params.push(toDb(type, rawVal));
    }
  }

  if (def.dateField) {
    if (typeof query.from === 'string') {
      where.push(`substr(${def.dateField}, 1, 10) >= ?`);
      params.push(query.from);
    }
    if (typeof query.to === 'string') {
      where.push(`substr(${def.dateField}, 1, 10) <= ?`);
      params.push(query.to);
    }
  }

  if (typeof query.q === 'string' && query.q.trim() && def.searchFields?.length) {
    const like = `%${query.q.trim()}%`;
    where.push(`(${def.searchFields.map((f) => `${f} LIKE ?`).join(' OR ')})`);
    params.push(...def.searchFields.map(() => like));
  }

  let order = def.defaultOrder;
  if (typeof query.order === 'string') {
    const desc = query.order.startsWith('-');
    const field = desc ? query.order.slice(1) : query.order;
    if (def.fields[field] || ['id', 'created_at', 'updated_at'].includes(field)) order = `${field} ${desc ? 'DESC' : 'ASC'}`;
  }

  const limit = Math.min(Math.max(Number(query.limit) || 1000, 1), 5000);
  const sql = `SELECT * FROM ${def.table} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order} LIMIT ${limit}`;
  return (db.prepare(sql).all(...params) as Row[]).map((r) => fromRow(def, r)!);
}

export function getOne(def: ResourceDef, id: number): Row | undefined {
  return fromRow(def, db.prepare(`SELECT * FROM ${def.table} WHERE id = ?`).get(id) as Row | undefined);
}

function pickFields(def: ResourceDef, body: Row): Row {
  const data: Row = {};
  for (const key of Object.keys(def.fields)) if (key in body) data[key] = body[key];
  return data;
}

/** `meta` serve solo al ripristino da backup per conservare id e timestamp originali */
export function create(def: ResourceDef, body: Row, meta?: { id?: unknown; created_at?: unknown; updated_at?: unknown }): Row {
  const data: Row = { ...(def.defaults ?? {}), ...pickFields(def, body) };
  for (const req of def.required ?? []) {
    if (data[req] === undefined || data[req] === null || data[req] === '') {
      throw new HttpError(400, `Il campo "${req}" è obbligatorio`);
    }
  }
  if (!meta) def.beforeSave?.(data);
  const keys = Object.keys(data);
  const values = keys.map((k) => toDb(def.fields[k], data[k]));
  for (const k of ['id', 'created_at', 'updated_at'] as const) {
    if (meta?.[k] !== undefined && meta[k] !== null) {
      keys.push(k);
      values.push(k === 'id' ? Number(meta[k]) : String(meta[k]));
    }
  }
  const sql = keys.length
    ? `INSERT INTO ${def.table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`
    : `INSERT INTO ${def.table} DEFAULT VALUES`;
  const res = db.prepare(sql).run(...values);
  return getOne(def, Number(res.lastInsertRowid))!;
}

export function update(def: ResourceDef, id: number, body: Row): Row {
  const existing = getOne(def, id);
  if (!existing) throw new HttpError(404, 'Elemento non trovato');
  const data = pickFields(def, body);
  for (const req of def.required ?? []) {
    if (req in data && (data[req] === null || data[req] === '')) throw new HttpError(400, `Il campo "${req}" è obbligatorio`);
  }
  def.beforeSave?.(data, existing);
  const keys = Object.keys(data);
  if (keys.length) {
    const sets = keys.map((k) => `${k} = ?`).join(', ');
    db.prepare(`UPDATE ${def.table} SET ${sets}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(
      ...keys.map((k) => toDb(def.fields[k], data[k])),
      id,
    );
  }
  return getOne(def, id)!;
}

export function remove(def: ResourceDef, id: number) {
  for (const c of def.cascade ?? []) db.prepare(`DELETE FROM ${c.table} WHERE ${c.fk} = ?`).run(id);
  const res = db.prepare(`DELETE FROM ${def.table} WHERE id = ?`).run(id);
  if (res.changes === 0) throw new HttpError(404, 'Elemento non trovato');
}

// ---------- impostazioni ----------

export function getSettings(): Record<string, unknown> {
  const rows = db.prepare("SELECT key, value FROM settings WHERE key NOT LIKE '\\_%' ESCAPE '\\'").all() as { key: string; value: string }[];
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    try {
      out[r.key] = JSON.parse(r.value);
    } catch {
      out[r.key] = r.value;
    }
  }
  return out;
}

export function saveSettings(patch: Record<string, unknown>) {
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(patch)) {
    if (k.startsWith('_')) continue;
    stmt.run(k, JSON.stringify(v));
  }
  return getSettings();
}

export function transaction<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
