// Endpoint specifici (non CRUD): dashboard, finanze, abitudini, promemoria,
// impostazioni, ricerca globale, backup.
import { Router } from 'express';
import { create, db, fromRow, getOne, getSettings, HttpError, saveSettings, transaction, update, type Row } from '../db.js';
import { RESOURCES } from '../resources.js';
import { advanceDateTime, isDate, isMonth, todayLocal } from '../dates.js';
import { dashboard, financeSummary, habitsOverview } from '../summary.js';

export const featuresRouter = Router();

const dateParam = (v: unknown) => (isDate(v) ? v : todayLocal());

featuresRouter.get('/dashboard', (req, res) => {
  res.json(dashboard(dateParam(req.query.date)));
});

featuresRouter.get('/finance/summary', (req, res) => {
  const month = isMonth(req.query.month) ? req.query.month : todayLocal().slice(0, 7);
  res.json(financeSummary(month));
});

featuresRouter.get('/habits/overview', (req, res) => {
  res.json(habitsOverview(dateParam(req.query.date)));
});

featuresRouter.post('/habits/:id/toggle', (req, res) => {
  const id = Number(req.params.id);
  const date = dateParam(req.body?.date);
  if (!getOne(RESOURCES.habits, id)) throw new HttpError(404, 'Abitudine non trovata');
  const existing = db.prepare('SELECT id FROM habit_logs WHERE habit_id = ? AND date = ?').get(id, date);
  if (existing) db.prepare('DELETE FROM habit_logs WHERE habit_id = ? AND date = ?').run(id, date);
  else db.prepare('INSERT INTO habit_logs (habit_id, date) VALUES (?, ?)').run(id, date);
  res.json({ done: !existing });
});

// Completa un promemoria; se è ricorrente lo sposta alla prossima occorrenza futura
featuresRouter.post('/reminders/:id/complete', (req, res) => {
  const def = RESOURCES.reminders;
  const id = Number(req.params.id);
  const r = getOne(def, id);
  if (!r) throw new HttpError(404, 'Promemoria non trovato');
  const repeat = String(r.repeat ?? 'none');
  if (repeat === 'none') return res.json(update(def, id, { done: true }));
  const now = typeof req.body?.now === 'string' ? req.body.now : `${todayLocal()}T00:00`;
  let next = advanceDateTime(String(r.remind_at), repeat);
  for (let i = 0; next <= now && i < 1000; i++) next = advanceDateTime(next, repeat);
  res.json(update(def, id, { remind_at: next }));
});

featuresRouter.get('/settings', (_req, res) => {
  res.json(getSettings());
});

featuresRouter.put('/settings', (req, res) => {
  if (!req.body || typeof req.body !== 'object') throw new HttpError(400, 'Dati non validi');
  res.json(saveSettings(req.body));
});

// Ricerca globale nella "seconda mente"
const SEARCHABLE: { resource: string; title: string; snippet: string; date?: string }[] = [
  { resource: 'notes', title: 'title', snippet: 'content' },
  { resource: 'tasks', title: 'title', snippet: 'notes', date: 'due_date' },
  { resource: 'goals', title: 'title', snippet: 'description', date: 'target_date' },
  { resource: 'events', title: 'title', snippet: 'notes', date: 'date' },
  { resource: 'reminders', title: 'title', snippet: 'notes', date: 'remind_at' },
  { resource: 'social_posts', title: 'title', snippet: 'hook', date: 'publish_date' },
  { resource: 'transactions', title: 'description', snippet: 'category', date: 'date' },
  { resource: 'workouts', title: 'title', snippet: 'notes', date: 'date' },
  { resource: 'meals', title: 'description', snippet: 'meal_type', date: 'date' },
];

featuresRouter.get('/search', (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) return res.json([]);
  const like = `%${q}%`;
  const results: Row[] = [];
  for (const s of SEARCHABLE) {
    const def = RESOURCES[s.resource];
    const fields = def.searchFields ?? [s.title];
    const rows = db
      .prepare(`SELECT * FROM ${def.table} WHERE ${fields.map((f) => `${f} LIKE ?`).join(' OR ')} ORDER BY updated_at DESC LIMIT 10`)
      .all(...fields.map(() => like)) as Row[];
    for (const r of rows) {
      const text = String(r[s.snippet] ?? '');
      const idx = text.toLowerCase().indexOf(q.toLowerCase());
      results.push({
        resource: s.resource,
        id: r.id,
        title: String(r[s.title] || '(senza titolo)'),
        snippet: idx >= 0 ? text.slice(Math.max(0, idx - 40), idx + 120) : text.slice(0, 140),
        date: s.date ? r[s.date] : null,
      });
    }
  }
  res.json(results);
});

// Backup completo in JSON
featuresRouter.get('/export', (_req, res) => {
  const data: Record<string, Row[]> = {};
  for (const [name, def] of Object.entries(RESOURCES)) {
    data[name] = (db.prepare(`SELECT * FROM ${def.table} ORDER BY id`).all() as Row[]).map((r) => fromRow(def, r)!);
  }
  res.setHeader('Content-Disposition', `attachment; filename="second-brain-${todayLocal()}.json"`);
  res.json({ app: 'second-brain', version: 1, exported_at: new Date().toISOString(), settings: getSettings(), data });
});

// Ripristino da backup: SOSTITUISCE tutti i dati
featuresRouter.post('/import', (req, res) => {
  const body = req.body as { app?: string; data?: Record<string, Row[]>; settings?: Record<string, unknown> };
  if (body?.app !== 'second-brain' || !body.data) throw new HttpError(400, 'File di backup non valido');
  const counts: Record<string, number> = {};
  transaction(() => {
    for (const [name, def] of Object.entries(RESOURCES)) {
      db.exec(`DELETE FROM ${def.table}`);
      const rows = body.data![name] ?? [];
      for (const row of rows) create(def, row, { id: row.id, created_at: row.created_at, updated_at: row.updated_at });
      counts[name] = rows.length;
    }
    if (body.settings) saveSettings(body.settings);
  });
  res.json({ ok: true, counts });
});
