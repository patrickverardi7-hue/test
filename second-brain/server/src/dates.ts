// Utility per date in formato locale "YYYY-MM-DD" / "YYYY-MM-DDTHH:MM".
// Le date arrivano dal browser (ora locale dell'utente), quindi il server
// lavora solo sulle stringhe senza conversioni di fuso orario.

const pad = (n: number) => String(n).padStart(2, '0');

export function isDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function isMonth(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}$/.test(s);
}

export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parse(date: string): Date {
  const [y, m, d] = date.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fmt(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(date: string, n: number): string {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}

/** Lunedì della settimana che contiene `date` */
export function startOfWeek(date: string): string {
  const d = parse(date);
  const dow = (d.getUTCDay() + 6) % 7;
  return addDays(date, -dow);
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/** Avanza un datetime locale "YYYY-MM-DDTHH:MM" secondo la ricorrenza */
export function advanceDateTime(dt: string, repeat: string): string {
  const [date, time = '09:00'] = dt.split('T');
  const d = parse(date);
  if (repeat === 'daily') d.setUTCDate(d.getUTCDate() + 1);
  else if (repeat === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
  else if (repeat === 'monthly') {
    const day = d.getUTCDate();
    d.setUTCDate(1);
    d.setUTCMonth(d.getUTCMonth() + 1);
    const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    d.setUTCDate(Math.min(day, last));
  }
  return `${fmt(d)}T${time.slice(0, 5)}`;
}
