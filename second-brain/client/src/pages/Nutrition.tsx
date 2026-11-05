import { useMemo, useState } from 'react';
import { useFetch, useResource } from '../api';
import { Bars, Card, EntityForm, Empty, Modal, PageHeader, Progress } from '../components/ui';
import { mealFields } from '../forms';
import type { Meal, Settings } from '../types';
import { addDays, cap, fmtDate, fmtDayLabel, fmtNum, MEAL_TYPES, today } from '../utils';

const MEAL_ICON: Record<string, string> = { colazione: '☕', pranzo: '🍝', spuntino: '🍎', cena: '🍽️' };

export default function Nutrition() {
  const [date, setDate] = useState(today());
  const { data: settings } = useFetch<Settings>('/settings');
  const week = useResource<Meal>('meals', { from: addDays(date, -6), to: date });
  const recent = useResource<Meal>('meals', { order: '-date', limit: 300 });
  const [editing, setEditing] = useState<Partial<Meal> | null>(null);
  const [picker, setPicker] = useState(false);

  const meals = week.items.filter((m) => m.date === date);
  const sum = (k: 'calories' | 'protein' | 'carbs' | 'fat', list = meals) => list.reduce((s, m) => s + (m[k] ?? 0), 0);
  const targets = {
    calories: settings?.calorie_target ?? 2200,
    protein: settings?.protein_target ?? 140,
    carbs: settings?.carbs_target ?? 250,
    fat: settings?.fat_target ?? 70,
  };

  const frequent = useMemo(() => {
    const seen = new Map<string, Meal & { count: number }>();
    for (const m of recent.items) {
      const key = m.description.trim().toLowerCase();
      const e = seen.get(key);
      if (e) e.count++;
      else seen.set(key, { ...m, count: 1 });
    }
    return [...seen.values()].sort((a, b) => b.count - a.count).slice(0, 30);
  }, [recent.items]);

  const weekData = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(date, i - 6);
    return { label: fmtDate(d, { weekday: 'short' }), value: sum('calories', week.items.filter((m) => m.date === d)) };
  });

  return (
    <div className="page">
      <PageHeader
        title="Alimentazione"
        subtitle="Diario dei pasti, calorie e macronutrienti. Obiettivi modificabili nelle impostazioni."
        actions={
          <>
            <button className="btn" onClick={() => setPicker(true)}>
              ↺ Pasti frequenti
            </button>
            <button className="btn primary" onClick={() => setEditing({ date, meal_type: guessMealType() })}>
              + Pasto
            </button>
          </>
        }
      />
      <div className="toolbar">
        <div className="nav-group">
          <button className="btn ghost" onClick={() => setDate(addDays(date, -1))} aria-label="Giorno precedente">
            ‹
          </button>
          <strong className="toolbar-title">{fmtDayLabel(date)}</strong>
          <button className="btn ghost" onClick={() => setDate(addDays(date, 1))} aria-label="Giorno successivo">
            ›
          </button>
        </div>
        <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Scegli data" />
      </div>

      <div className="grid">
        <Card title="Obiettivi del giorno">
          <Progress label="🔥 Calorie" value={sum('calories')} max={targets.calories} right={`${fmtNum(sum('calories'))} / ${fmtNum(targets.calories)} kcal`} />
          <Progress label="🥩 Proteine" value={sum('protein')} max={targets.protein} color="var(--green)" right={`${fmtNum(sum('protein'))} / ${targets.protein} g`} />
          <Progress label="🍞 Carboidrati" value={sum('carbs')} max={targets.carbs} color="var(--orange)" right={`${fmtNum(sum('carbs'))} / ${targets.carbs} g`} />
          <Progress label="🥑 Grassi" value={sum('fat')} max={targets.fat} color="var(--blue)" right={`${fmtNum(sum('fat'))} / ${targets.fat} g`} />
          <p className="muted small">Rimangono {fmtNum(Math.max(0, targets.calories - sum('calories')))} kcal.</p>
        </Card>
        <Card title="Calorie ultimi 7 giorni">
          <Bars data={weekData} target={targets.calories} format={(n) => `${fmtNum(n)} kcal`} />
          <p className="muted small">Media: {fmtNum(weekData.reduce((s, d) => s + d.value, 0) / 7)} kcal/giorno · linea = obiettivo</p>
        </Card>
      </div>

      <div className="meals">
        {MEAL_TYPES.map((type) => {
          const list = meals.filter((m) => m.meal_type === type);
          return (
            <Card
              key={type}
              title={`${MEAL_ICON[type]} ${cap(type)}`}
              action={
                <span className="row-gap">
                  {list.length > 0 && <span className="muted small">{fmtNum(sum('calories', list))} kcal</span>}
                  <button className="icon-btn" title={`Aggiungi a ${type}`} onClick={() => setEditing({ date, meal_type: type })}>
                    +
                  </button>
                </span>
              }
            >
              {list.length === 0 ? (
                <p className="muted small">—</p>
              ) : (
                <ul className="list compact">
                  {list.map((m) => (
                    <li key={m.id} className="row clickable" onClick={() => setEditing(m)}>
                      <span className="grow">{m.description}</span>
                      <span className="muted small">
                        {m.calories ? `${fmtNum(m.calories)} kcal` : ''} {m.protein ? `· P${fmtNum(m.protein)}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      {editing && (
        <Modal title={editing.id ? 'Modifica pasto' : 'Nuovo pasto'} onClose={() => setEditing(null)}>
          <EntityForm
            fields={mealFields}
            initial={editing}
            onCancel={() => setEditing(null)}
            onDelete={editing.id ? () => week.remove(editing.id!).then(() => setEditing(null)) : undefined}
            onSubmit={async (v) => {
              const r = editing.id ? await week.update(editing.id, v) : await week.create(v);
              if (r) setEditing(null);
            }}
          />
        </Modal>
      )}
      {picker && (
        <Modal title="Pasti frequenti" onClose={() => setPicker(false)}>
          {frequent.length === 0 && <Empty>Qui compariranno i pasti che registri più spesso.</Empty>}
          <ul className="list">
            {frequent.map((m) => (
              <li key={m.id} className="row">
                <span className="grow">{m.description}</span>
                <span className="muted small">{m.calories ? `${fmtNum(m.calories)} kcal` : ''}</span>
                <button
                  className="btn small"
                  onClick={async () => {
                    const { id: _id, created_at: _c, updated_at: _u, count: _n, ...rest } = m;
                    await week.create({ ...rest, date, meal_type: guessMealType() });
                    setPicker(false);
                  }}
                >
                  + Aggiungi
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  );
}

function guessMealType() {
  const h = new Date().getHours();
  if (h < 11) return 'colazione';
  if (h < 15) return 'pranzo';
  if (h < 18) return 'spuntino';
  return 'cena';
}
