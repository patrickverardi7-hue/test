// Progressi negli allenamenti: andamento per esercizio, massimali stimati,
// volume settimanale e misure corporee.
import { Router } from 'express';
import { list, type Row } from '../db.js';
import { RESOURCES } from '../resources.js';
import { addDays, isDate, startOfWeek, todayLocal } from '../dates.js';

export const progressRouter = Router();

interface Exercise {
  name: string;
  sets: number | null;
  reps: number | null;
  weight: number | null;
}

/** Massimale stimato (formula di Epley) */
const epley = (w: number, r: number) => (r <= 1 ? w : w * (1 + r / 30));
const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

export function workoutProgress(opts: { date?: string; weeks?: number; exercise?: string } = {}) {
  const date = opts.date ?? todayLocal();
  const weeks = opts.weeks ?? 12;
  const workouts = (list(RESOURCES.workouts, { order: 'date', limit: 5000 }) as (Row & { date: string; exercises: Exercise[] | null; duration_min: number | null })[]);

  const byExercise = new Map<string, { name: string; sessions: { date: string; weight: number; reps: number; sets: number; e1rm: number; volume: number }[] }>();
  for (const w of workouts) {
    for (const e of w.exercises ?? []) {
      if (!e?.name?.trim()) continue;
      const key = e.name.trim().toLowerCase();
      const weight = Number(e.weight) || 0;
      const reps = Number(e.reps) || 0;
      const sets = Number(e.sets) || 1;
      const entry = byExercise.get(key) ?? { name: e.name.trim(), sessions: [] };
      const prev = entry.sessions.find((s) => s.date === w.date);
      const e1rm = weight ? epley(weight, reps) : 0;
      const volume = sets * reps * weight;
      if (prev) {
        prev.volume += volume;
        if (e1rm > prev.e1rm) Object.assign(prev, { weight, reps, sets, e1rm });
      } else entry.sessions.push({ date: w.date, weight, reps, sets, e1rm, volume });
      byExercise.set(key, entry);
    }
  }

  let exercises = [...byExercise.values()].map((ex) => {
    const s = ex.sessions;
    const first = s[0];
    const last = s[s.length - 1];
    const best = s.reduce((a, b) => (b.e1rm > a.e1rm ? b : a), s[0]);
    const bestWeight = s.reduce((a, b) => (b.weight > a.weight ? b : a), s[0]);
    return {
      name: ex.name,
      sessionsCount: s.length,
      lastDate: last.date,
      prWeight: bestWeight.weight,
      prReps: bestWeight.reps,
      prDate: bestWeight.date,
      best1rm: round(best.e1rm),
      first1rm: round(first.e1rm),
      last1rm: round(last.e1rm),
      changePct: first.e1rm > 0 ? round(((last.e1rm - first.e1rm) / first.e1rm) * 100) : null,
      history: s.map((x) => ({ ...x, e1rm: round(x.e1rm) })),
    };
  });
  exercises.sort((a, b) => b.lastDate.localeCompare(a.lastDate) || b.sessionsCount - a.sessionsCount);
  if (opts.exercise) {
    const q = opts.exercise.toLowerCase();
    exercises = exercises.filter((e) => e.name.toLowerCase().includes(q));
  }

  const firstWeek = addDays(startOfWeek(date), -7 * (weeks - 1));
  const weekly = Array.from({ length: weeks }, (_, i) => {
    const from = addDays(firstWeek, i * 7);
    const to = addDays(from, 6);
    const ws = workouts.filter((w) => w.date >= from && w.date <= to);
    return {
      week: from,
      sessions: ws.length,
      minutes: ws.reduce((s, w) => s + (Number(w.duration_min) || 0), 0),
      volume: Math.round(ws.reduce((s, w) => s + (w.exercises ?? []).reduce((v, e) => v + (Number(e.sets) || 1) * (Number(e.reps) || 0) * (Number(e.weight) || 0), 0), 0)),
    };
  });

  const body = (list(RESOURCES.body_metrics, { order: 'date', from: addDays(date, -365) }) as Row[]).map((b) => ({
    date: b.date,
    weight: b.weight,
    body_fat: b.body_fat,
    waist: b.waist,
  }));

  return { exercises, weekly, body };
}

progressRouter.get('/workouts/progress', (req, res) => {
  res.json(
    workoutProgress({
      date: isDate(req.query.date) ? req.query.date : undefined,
      weeks: Math.min(Math.max(Number(req.query.weeks) || 12, 4), 52),
      exercise: typeof req.query.exercise === 'string' && req.query.exercise ? req.query.exercise : undefined,
    }),
  );
});
