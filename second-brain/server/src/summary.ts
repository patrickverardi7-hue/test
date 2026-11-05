// Calcoli aggregati riutilizzati da dashboard, pagine e assistente AI.
import { db, fromRow, getSettings, type Row } from './db.js';
import { RESOURCES } from './resources.js';
import { addDays, addMonths, startOfWeek } from './dates.js';

const all = (sql: string, ...params: (string | number)[]) => db.prepare(sql).all(...params) as Row[];
const one = (sql: string, ...params: (string | number)[]) => db.prepare(sql).get(...params) as Row | undefined;

export function financeSummary(month: string) {
  const totals = all("SELECT type, SUM(amount) AS total FROM transactions WHERE substr(date,1,7) = ? GROUP BY type", month);
  const income = Number(totals.find((t) => t.type === 'income')?.total ?? 0);
  const expense = Number(totals.find((t) => t.type === 'expense')?.total ?? 0);

  const byCategory = all(
    "SELECT category, SUM(amount) AS total FROM transactions WHERE substr(date,1,7) = ? AND type = 'expense' GROUP BY category ORDER BY total DESC",
    month,
  ).map((r) => ({ category: String(r.category ?? 'Altro'), total: Number(r.total) }));

  const budgets = all('SELECT * FROM budgets ORDER BY category').map((b) => {
    const spent = byCategory.find((c) => c.category.toLowerCase() === String(b.category).toLowerCase())?.total ?? 0;
    return { id: b.id, category: b.category, monthly_limit: Number(b.monthly_limit), spent };
  });

  const firstMonth = addMonths(month, -5);
  const trendRows = all(
    "SELECT substr(date,1,7) AS m, type, SUM(amount) AS total FROM transactions WHERE substr(date,1,7) BETWEEN ? AND ? GROUP BY m, type",
    firstMonth,
    month,
  );
  const trend = Array.from({ length: 6 }, (_, i) => {
    const m = addMonths(firstMonth, i);
    const get = (type: string) => Number(trendRows.find((r) => r.m === m && r.type === type)?.total ?? 0);
    return { month: m, income: get('income'), expense: get('expense') };
  });

  const allTime = one(
    "SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE -amount END),0) AS balance FROM transactions",
  );

  return { month, income, expense, net: income - expense, byCategory, budgets, trend, totalBalance: Number(allTime?.balance ?? 0) };
}

export function habitsOverview(date: string) {
  const habits = all("SELECT * FROM habits WHERE archived = 0 ORDER BY id").map((h) => fromRow(RESOURCES.habits, h)! as Row & { name: string });
  const since = addDays(date, -365);
  const logs = all('SELECT habit_id, date FROM habit_logs WHERE date BETWEEN ? AND ?', since, date);
  return habits.map((h) => {
    const dates = new Set(logs.filter((l) => l.habit_id === h.id).map((l) => String(l.date)));
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(date, i - 6);
      return { date: d, done: dates.has(d) };
    });
    // la serie conta fino a ieri se oggi non è ancora fatto
    let streak = 0;
    let cursor = dates.has(date) ? date : addDays(date, -1);
    while (dates.has(cursor)) {
      streak++;
      cursor = addDays(cursor, -1);
    }
    const last30 = Array.from({ length: 30 }, (_, i) => addDays(date, -i)).filter((d) => dates.has(d)).length;
    return { ...h, doneToday: dates.has(date), last7, streak, rate30: Math.round((last30 / 30) * 100) };
  });
}

export function nutritionDay(date: string) {
  const s = getSettings();
  const t = one(
    'SELECT COALESCE(SUM(calories),0) AS calories, COALESCE(SUM(protein),0) AS protein, COALESCE(SUM(carbs),0) AS carbs, COALESCE(SUM(fat),0) AS fat, COUNT(*) AS meals FROM meals WHERE date = ?',
    date,
  )!;
  return {
    calories: Number(t.calories),
    protein: Number(t.protein),
    carbs: Number(t.carbs),
    fat: Number(t.fat),
    meals: Number(t.meals),
    targets: {
      calories: Number(s.calorie_target),
      protein: Number(s.protein_target),
      carbs: Number(s.carbs_target),
      fat: Number(s.fat_target),
    },
  };
}

export function workoutsWeek(date: string) {
  const s = getSettings();
  const from = startOfWeek(date);
  const to = addDays(from, 6);
  const t = one('SELECT COUNT(*) AS n, COALESCE(SUM(duration_min),0) AS minutes FROM workouts WHERE date BETWEEN ? AND ?', from, to)!;
  return { from, to, count: Number(t.n), minutes: Number(t.minutes), target: Number(s.workouts_per_week) };
}

export function dashboard(date: string) {
  const map = (key: keyof typeof RESOURCES) => (r: Row) => fromRow(RESOURCES[key], r)!;
  const tasks = all(
    "SELECT * FROM tasks WHERE status != 'done' AND due_date IS NOT NULL AND due_date <= ? ORDER BY due_date, priority DESC",
    date,
  ).map(map('tasks'));
  const doneToday = one(
    "SELECT COUNT(*) AS n FROM tasks WHERE status = 'done' AND substr(completed_at,1,10) = ?",
    date,
  ) as { n: number };
  const events = all('SELECT * FROM events WHERE date = ? ORDER BY start_time IS NULL, start_time', date).map(map('events'));
  const reminders = all('SELECT * FROM reminders WHERE done = 0 AND substr(remind_at,1,10) <= ? ORDER BY remind_at', date).map(
    map('reminders'),
  );
  const goals = all("SELECT * FROM goals WHERE status = 'attivo' ORDER BY target_date IS NULL, target_date LIMIT 6").map(map('goals'));
  const social = all(
    "SELECT * FROM social_posts WHERE status != 'pubblicato' AND publish_date IS NOT NULL AND publish_date >= ? ORDER BY publish_date LIMIT 5",
    date,
  ).map(map('social_posts'));
  const notes = all('SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC LIMIT 5').map(map('notes'));
  const inbox = one("SELECT COUNT(*) AS n FROM notes WHERE type = 'inbox'") as { n: number };
  const upcoming = all(
    'SELECT * FROM events WHERE date > ? AND date <= ? ORDER BY date, start_time LIMIT 5',
    date,
    addDays(date, 7),
  ).map(map('events'));

  return {
    date,
    settings: getSettings(),
    tasks,
    tasksDoneToday: Number(doneToday.n),
    events,
    upcoming,
    reminders,
    habits: habitsOverview(date),
    finance: financeSummary(date.slice(0, 7)),
    nutrition: nutritionDay(date),
    workouts: workoutsWeek(date),
    goals,
    social,
    notes,
    inboxCount: Number(inbox.n),
  };
}
