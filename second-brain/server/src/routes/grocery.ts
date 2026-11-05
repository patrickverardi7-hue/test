// Spesa intelligente: piano alimentare → fabbisogno → meno dispensa → lista della spesa.
// Quando segni un pasto del piano come mangiato, gli ingredienti vengono scalati dalla dispensa;
// quando completi la spesa, gli articoli comprati entrano in dispensa.
import { Router } from 'express';
import { create, db, getOne, HttpError, list, remove, transaction, update, type Row } from '../db.js';
import { RESOURCES } from '../resources.js';
import { addDays, isDate, todayLocal } from '../dates.js';
import { guessCategory, keyOf, normalize } from '../units.js';

export { guessCategory, normalize };

export const groceryRouter = Router();

export interface Ingredient {
  name: string;
  quantity: number | null;
  unit: string | null;
}

/** ISO weekday: 1 = lunedì … 7 = domenica */
function weekdayOf(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

function pantryIndex() {
  const items = list(RESOURCES.pantry_items, {}) as (Row & { name: string; quantity: number; unit: string })[];
  const map = new Map<string, Row & { name: string; quantity: number; unit: string }>();
  for (const it of items) {
    const n = normalize(it.quantity, it.unit);
    map.set(keyOf(it.name, n.unit), { ...it, quantity: n.quantity, unit: n.unit });
  }
  return { items, map };
}

/** Calcola il fabbisogno del piano per `days` giorni da `from` */
export function planNeeds(from: string, days: number) {
  const plan = list(RESOURCES.meal_plan, {}) as (Row & { weekday: number; ingredients: Ingredient[] | null })[];
  const need = new Map<string, { name: string; quantity: number; unit: string }>();
  for (let i = 0; i < days; i++) {
    const wd = weekdayOf(addDays(from, i));
    for (const meal of plan.filter((p) => p.weekday === wd)) {
      for (const ing of meal.ingredients ?? []) {
        if (!ing?.name?.trim()) continue;
        const n = normalize(ing.quantity ?? 1, ing.unit);
        const k = keyOf(ing.name, n.unit);
        const cur = need.get(k);
        if (cur) cur.quantity += n.quantity;
        else need.set(k, { name: ing.name.trim(), quantity: n.quantity, unit: n.unit });
      }
    }
  }
  return [...need.values()];
}

export function generateShoppingList(from: string, days: number) {
  const { items: pantry, map: pantryMap } = pantryIndex();
  const needs = planNeeds(from, days);
  const manual = (list(RESOURCES.shopping_items, { checked: 'false', source: 'manuale' }) as Row[]).map((r) => String(r.name).toLowerCase().trim());

  const toAdd: Row[] = [];
  for (const n of needs) {
    const have = pantryMap.get(keyOf(n.name, n.unit));
    const missing = Math.round((n.quantity - Number(have?.quantity ?? 0)) * 100) / 100;
    if (missing <= 0 || manual.includes(n.name.toLowerCase())) continue;
    toAdd.push({ name: n.name, quantity: missing, unit: n.unit, category: (have?.category as string) || guessCategory(n.name), source: 'piano' });
  }
  // scorte sotto la soglia minima
  for (const p of pantry) {
    const min = Number(p.min_quantity);
    if (!min || Number(p.quantity) >= min) continue;
    const name = String(p.name);
    if (toAdd.some((t) => String(t.name).toLowerCase() === name.toLowerCase()) || manual.includes(name.toLowerCase())) continue;
    toAdd.push({ name, quantity: Math.round((min - Number(p.quantity)) * 100) / 100, unit: p.unit, category: (p.category as string) || guessCategory(name), source: 'scorta' });
  }

  transaction(() => {
    db.exec("DELETE FROM shopping_items WHERE checked = 0 AND source IN ('piano', 'scorta')");
    for (const it of toAdd) create(RESOURCES.shopping_items, it);
  });
  return { added: toAdd.length, from, to: addDays(from, days - 1), items: list(RESOURCES.shopping_items, {}) };
}

/** Sposta gli articoli spuntati nella dispensa */
export function completeShopping() {
  const checked = list(RESOURCES.shopping_items, { checked: 'true' }) as (Row & { id: number; name: string; quantity: number; unit: string; category: string })[];
  const { map } = pantryIndex();
  transaction(() => {
    for (const it of checked) {
      const n = normalize(it.quantity ?? 1, it.unit);
      const existing = map.get(keyOf(it.name, n.unit));
      if (existing) update(RESOURCES.pantry_items, Number(existing.id), { quantity: Number(existing.quantity) + n.quantity, unit: n.unit });
      else create(RESOURCES.pantry_items, { name: it.name, quantity: n.quantity, unit: n.unit, category: it.category || guessCategory(it.name) });
      remove(RESOURCES.shopping_items, it.id);
    }
  });
  return { moved: checked.length };
}

/** Scala gli ingredienti consumati dalla dispensa */
export function consumeIngredients(ingredients: Ingredient[]) {
  const { map } = pantryIndex();
  const consumed: { name: string; quantity: number; unit: string; left: number }[] = [];
  for (const ing of ingredients) {
    if (!ing?.name) continue;
    const n = normalize(ing.quantity ?? 1, ing.unit);
    const p = map.get(keyOf(ing.name, n.unit));
    if (!p) continue;
    const left = Math.max(0, Math.round((Number(p.quantity) - n.quantity) * 100) / 100);
    update(RESOURCES.pantry_items, Number(p.id), { quantity: left, unit: n.unit });
    p.quantity = left;
    consumed.push({ name: String(p.name), quantity: n.quantity, unit: n.unit, left });
  }
  return consumed;
}

// ---------- endpoint ----------

groceryRouter.post('/shopping/generate', (req, res) => {
  const from = isDate(req.body?.from) ? req.body.from : todayLocal();
  const days = Math.min(Math.max(Number(req.body?.days) || 7, 1), 31);
  res.json(generateShoppingList(from, days));
});

/** Aggiunge articoli alla lista unendo i doppioni (stesso nome → somma le quantità se l'unità è compatibile) */
export function addShoppingItems(items: { name: string; quantity?: number | null; unit?: string | null; category?: string | null }[]) {
  const out: Row[] = [];
  transaction(() => {
    for (const it of items) {
      const name = it.name?.trim();
      if (!name) continue;
      const existing = (list(RESOURCES.shopping_items, { checked: 'false' }) as Row[]).find((r) => String(r.name).toLowerCase() === name.toLowerCase());
      if (!existing) {
        out.push(create(RESOURCES.shopping_items, { name, quantity: it.quantity ?? null, unit: it.unit ?? null, category: it.category, source: 'manuale' }));
        continue;
      }
      const add = it.quantity ? normalize(it.quantity, it.unit) : null;
      if (add && existing.quantity && existing.unit === add.unit) {
        out.push(update(RESOURCES.shopping_items, Number(existing.id), { quantity: Number(existing.quantity) + add.quantity, unit: add.unit, source: 'manuale' }));
      } else if (add && !existing.quantity) {
        out.push(update(RESOURCES.shopping_items, Number(existing.id), { quantity: add.quantity, unit: add.unit, source: 'manuale' }));
      } else {
        out.push(update(RESOURCES.shopping_items, Number(existing.id), { source: 'manuale' }));
      }
    }
  });
  return out;
}

groceryRouter.post('/shopping/add', (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [req.body];
  res.json(addShoppingItems(items));
});

groceryRouter.post('/shopping/complete', (_req, res) => {
  res.json(completeShopping());
});

groceryRouter.get('/shopping/text', (_req, res) => {
  const items = list(RESOURCES.shopping_items, { checked: 'false' }) as Row[];
  const byCat = new Map<string, string[]>();
  for (const it of items) {
    const cat = String(it.category || 'Altro');
    const qty = it.quantity ? ` — ${formatQty(Number(it.quantity), String(it.unit ?? ''))}` : '';
    byCat.set(cat, [...(byCat.get(cat) ?? []), `- ${it.name}${qty}`]);
  }
  res.type('text/plain').send([...byCat.entries()].map(([c, l]) => `${c}\n${l.join('\n')}`).join('\n\n') || 'Lista vuota');
});

export function formatQty(q: number, unit: string) {
  if (unit === 'g' && q >= 1000) return `${+(q / 1000).toFixed(2)} kg`;
  if (unit === 'ml' && q >= 1000) return `${+(q / 1000).toFixed(2)} l`;
  return `${+q.toFixed(2)} ${unit}`.trim();
}

groceryRouter.post('/meal_plan/:id/eat', (req, res) => {
  const item = getOne(RESOURCES.meal_plan, Number(req.params.id)) as (Row & { ingredients: Ingredient[] | null }) | undefined;
  if (!item) throw new HttpError(404, 'Pasto del piano non trovato');
  const date = isDate(req.body?.date) ? req.body.date : todayLocal();
  const result = transaction(() => {
    const meal = create(RESOURCES.meals, {
      date,
      meal_type: item.meal_type,
      description: item.title,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
    });
    return { meal, consumed: consumeIngredients(item.ingredients ?? []) };
  });
  res.json(result);
});

groceryRouter.get('/meal_plan/today', (req, res) => {
  const date = isDate(req.query.date) ? req.query.date : todayLocal();
  res.json({ date, weekday: weekdayOf(date), items: list(RESOURCES.meal_plan, { weekday: String(weekdayOf(date)) }) });
});

export { weekdayOf };
