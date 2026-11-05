export const pad = (n: number) => String(n).padStart(2, '0');

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const today = () => toISODate(new Date());

export function nowLocal(): string {
  const d = new Date();
  return `${toISODate(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: string, n: number): string {
  const d = parseDate(date);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function startOfWeek(date: string): string {
  const d = parseDate(date);
  return addDays(date, -((d.getDay() + 6) % 7));
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${pad(last)}` };
}

export function fmtMonth(month: string): string {
  const s = parseDate(`${month}-01`).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fmtDate(date: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }): string {
  if (!date) return '';
  return parseDate(date).toLocaleDateString('it-IT', opts);
}

export function fmtDayLabel(date: string | null | undefined): string {
  if (!date) return '';
  const t = today();
  if (date === t) return 'Oggi';
  if (date === addDays(t, 1)) return 'Domani';
  if (date === addDays(t, -1)) return 'Ieri';
  return fmtDate(date, { weekday: 'short', day: 'numeric', month: 'short' });
}

export function fmtDateTime(dt: string | null | undefined): string {
  if (!dt) return '';
  const [d, t] = dt.split('T');
  return `${fmtDayLabel(d)}${t ? ' ' + t.slice(0, 5) : ''}`;
}

let currency = 'EUR';
export const setCurrency = (c: string) => {
  currency = c || 'EUR';
};
export function fmtMoney(n: number | null | undefined): string {
  try {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(n ?? 0);
  } catch {
    return `${(n ?? 0).toFixed(2)} ${currency}`;
  }
}

export const fmtNum = (n: number | null | undefined, digits = 0) =>
  new Intl.NumberFormat('it-IT', { maximumFractionDigits: digits }).format(n ?? 0);

export function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}
export function minToTime(min: number): string {
  const m = Math.max(0, Math.min(23 * 60 + 59, Math.round(min)));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

export const AREAS = ['personale', 'lavoro', 'salute', 'finanza', 'social', 'studio', 'casa', 'relazioni'];
export const PRIORITIES = [
  { value: 3, label: 'Alta' },
  { value: 2, label: 'Media' },
  { value: 1, label: 'Bassa' },
];
export const EXPENSE_CATEGORIES = ['Casa', 'Spesa', 'Ristoranti', 'Trasporti', 'Salute', 'Sport', 'Svago', 'Abbonamenti', 'Shopping', 'Viaggi', 'Lavoro', 'Altro'];
export const INCOME_CATEGORIES = ['Stipendio', 'Freelance', 'Social / Sponsor', 'Investimenti', 'Rimborsi', 'Altro'];
export const MEAL_TYPES = ['colazione', 'pranzo', 'spuntino', 'cena'];
export const WORKOUT_TYPES = ['forza', 'cardio', 'mobilità', 'sport', 'altro'];
export const PLATFORMS = ['instagram', 'tiktok', 'youtube', 'linkedin', 'x', 'altro'];
export const POST_STATUSES = ['idea', 'bozza', 'pronto', 'programmato', 'pubblicato'];
export const NOTE_TYPES = ['inbox', 'nota', 'idea', 'brainstorm', 'diario'];

export const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Estrae elementi da un elenco numerato o puntato prodotto dall'AI */
export function parseListItems(text: string): { title: string; detail: string }[] {
  const out: { title: string; detail: string }[] = [];
  for (const raw of text.split('\n')) {
    const m = raw.match(/^\s*(?:\d+[.)]|[-*•])\s+(.+)$/);
    if (!m) continue;
    const clean = m[1].replace(/\*\*/g, '').trim();
    const [title, ...rest] = clean.split(/\s+[—–-]\s+|:\s+/);
    if (title.length > 2) out.push({ title: title.trim(), detail: rest.join(' — ').trim() });
  }
  return out;
}

export const WEEKDAYS = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
/** 1 = lunedì … 7 = domenica */
export const isoWeekday = (date: string) => ((parseDate(date).getDay() + 6) % 7) + 1;

export const UNITS = ['g', 'kg', 'ml', 'l', 'pz'];
export function fmtQty(q: number | null | undefined, unit: string | null | undefined): string {
  if (q === null || q === undefined) return '';
  const u = unit ?? '';
  const n = (x: number) => new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 }).format(x);
  if (u === 'g' && q >= 1000) return `${n(q / 1000)} kg`;
  if (u === 'ml' && q >= 1000) return `${n(q / 1000)} l`;
  return `${n(q)} ${u}`.trim();
}

/** "2 kg mele", "mele 2kg", "6 uova", "latte" → { name, quantity, unit } */
export function parseItem(text: string): { name: string; quantity: number | null; unit: string | null } {
  const t = text.trim();
  const unitRe = '(kg|g|gr|l|lt|ml|cl|pz|pezzi|x)?';
  const start = t.match(new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*${unitRe}\\s+(.+)$`, 'i'));
  const end = t.match(new RegExp(`^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*${unitRe}$`, 'i'));
  const norm = (u?: string) => (!u || u.toLowerCase() === 'x' || u.toLowerCase().startsWith('pez') ? 'pz' : u.toLowerCase());
  if (start) return { name: start[3].trim(), quantity: Number(start[1].replace(',', '.')), unit: norm(start[2]) };
  if (end) return { name: end[1].trim(), quantity: Number(end[2].replace(',', '.')), unit: norm(end[3]) };
  return { name: t, quantity: null, unit: null };
}

export const VIDEO_FORMATS = ['reel', 'short', 'video lungo', 'carosello', 'post', 'live', 'story'];
