import { useMemo, useState } from 'react';
import { act, api, errorToast, getToken, toast, useResource } from '../api';
import { Card, EntityForm, Empty, Modal, PageHeader, Tabs } from '../components/ui';
import type { Ingredient, PantryItem, PlanMeal, ShoppingItem } from '../types';
import { cap, fmtNum, fmtQty, isoWeekday, MEAL_TYPES, parseItem, today, UNITS, WEEKDAYS } from '../utils';

type View = 'lista' | 'dispensa' | 'piano';

export default function Grocery() {
  const [view, setView] = useState<View>('lista');
  return (
    <div className="page">
      <PageHeader
        title="Spesa & dispensa"
        subtitle="Il piano alimentare genera la lista della spesa togliendo quello che hai già in casa. Quando mangi un pasto del piano, la dispensa si aggiorna da sola."
      />
      <div className="toolbar">
        <Tabs<View>
          value={view}
          onChange={setView}
          options={[
            { value: 'lista', label: '🛒 Lista della spesa' },
            { value: 'dispensa', label: '🏠 Dispensa' },
            { value: 'piano', label: '📅 Piano alimentare' },
          ]}
        />
      </div>
      {view === 'lista' && <ShoppingList />}
      {view === 'dispensa' && <Pantry />}
      {view === 'piano' && <MealPlan />}
    </div>
  );
}

// ---------------- lista della spesa ----------------
function ShoppingList() {
  const items = useResource<ShoppingItem>('shopping_items');
  const [text, setText] = useState('');
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);

  const groups = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>();
    for (const it of items.items.filter((i) => !i.checked)) map.set(it.category || 'Altro', [...(map.get(it.category || 'Altro') ?? []), it]);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [items.items]);
  const checked = items.items.filter((i) => i.checked);

  const add = async () => {
    // si possono inserire più articoli separati da virgola: "2 kg mele, latte, 6 uova"
    const parts = text.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) return;
    const r = await act(() => api.post('/shopping/add', { items: parts.map(parseItem) }));
    if (r) setText('');
  };

  const generate = async () => {
    setBusy(true);
    const r = await act(() => api.post<{ added: number }>('/shopping/generate', { from: today(), days }));
    if (r) toast(r.added ? `${r.added} articoli aggiunti dal piano e dalle scorte` : 'Hai già tutto quello che serve 👌');
    setBusy(false);
  };

  const copy = async () => {
    try {
      const res = await fetch('/api/shopping/text', { headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {} });
      await navigator.clipboard.writeText(await res.text());
      toast('Lista copiata: incollala dove vuoi (WhatsApp, note, spesa online)');
    } catch (e) {
      errorToast(e);
    }
  };

  return (
    <>
      <div className="grocery-actions card">
        <div className="row-gap">
          <span>Genera dal piano per i prossimi</span>
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Giorni">
            {[3, 5, 7, 10, 14].map((d) => (
              <option key={d} value={d}>
                {d} giorni
              </option>
            ))}
          </select>
          <button className="btn primary" onClick={generate} disabled={busy}>
            ✨ Genera lista
          </button>
          <span className="spacer" />
          <button className="btn ghost" onClick={copy}>
            ⧉ Copia lista
          </button>
        </div>
        <p className="muted small">Calcola gli ingredienti dei pasti pianificati, sottrae la dispensa e aggiunge le scorte sotto la soglia minima. Gli articoli inseriti a mano restano.</p>
      </div>

      <form
        className="quick-add"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Aggiungi: 2 kg mele, latte, 6 uova…" />
        <button className="btn" type="submit">
          Aggiungi
        </button>
      </form>

      {groups.length === 0 && checked.length === 0 && <Empty>La lista è vuota. Generala dal piano alimentare o aggiungi articoli a mano.</Empty>}

      <div className="grocery-groups">
        {groups.map(([cat, list]) => (
          <Card key={cat} title={cat}>
            <ul className="list compact">
              {list.map((it) => (
                <li key={it.id} className="row">
                  <input type="checkbox" checked={it.checked} aria-label={`Preso: ${it.name}`} onChange={() => items.update(it.id, { checked: true })} />
                  <span className="grow">{it.name}</span>
                  {it.source !== 'manuale' && <span className="badge" title={it.source === 'piano' ? 'Dal piano alimentare' : 'Scorta sotto il minimo'}>{it.source === 'piano' ? '📅' : '📉'}</span>}
                  <span className="muted small">{fmtQty(it.quantity, it.unit)}</span>
                  <button className="icon-btn" aria-label={`Rimuovi ${it.name}`} onClick={() => items.remove(it.id)}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      {checked.length > 0 && (
        <Card
          title={`Nel carrello (${checked.length})`}
          className="cart"
          action={
            <button className="btn primary small" onClick={() => act(() => api.post('/shopping/complete'), 'Spesa completata: dispensa aggiornata 🏠')}>
              ✓ Spesa fatta → in dispensa
            </button>
          }
        >
          <ul className="list compact">
            {checked.map((it) => (
              <li key={it.id} className="row is-done">
                <input type="checkbox" checked aria-label={`Rimetti in lista ${it.name}`} onChange={() => items.update(it.id, { checked: false })} />
                <span className="grow">{it.name}</span>
                <span className="muted small">{fmtQty(it.quantity, it.unit)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

// ---------------- dispensa ----------------
function Pantry() {
  const pantry = useResource<PantryItem>('pantry_items');
  const [editing, setEditing] = useState<Partial<PantryItem> | null>(null);
  const [q, setQ] = useState('');
  const low = (p: PantryItem) => p.min_quantity !== null && p.quantity < p.min_quantity;
  const empty = (p: PantryItem) => p.quantity <= 0;
  const visible = pantry.items.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));

  const step = (p: PantryItem) => (p.unit === 'pz' ? 1 : p.unit === 'g' || p.unit === 'ml' ? 100 : 1);

  return (
    <>
      <div className="toolbar">
        <input type="search" placeholder="Cerca in dispensa…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="muted small">
          {pantry.items.length} prodotti · {pantry.items.filter(low).length} sotto scorta
        </span>
        <span className="spacer" />
        <button className="btn primary" onClick={() => setEditing({ unit: 'pz', quantity: 1 })}>
          + Prodotto
        </button>
      </div>
      {visible.length === 0 && <Empty>La dispensa è vuota. Si riempie da sola quando completi la spesa, oppure aggiungi i prodotti a mano.</Empty>}
      {visible.length > 0 && (
        <ul className="list card-list">
          {visible.map((p) => (
            <li key={p.id} className={`row ${empty(p) ? 'is-empty' : ''}`}>
              <button className="link grow ellipsis" onClick={() => setEditing(p)}>
                {p.name} {p.category && <span className="muted small">· {p.category}</span>}
              </button>
              {low(p) && <span className="badge red">sotto scorta</span>}
              {p.expires_on && p.expires_on <= today() && <span className="badge red">scaduto</span>}
              <button className="icon-btn" aria-label="Diminuisci" onClick={() => pantry.update(p.id, { quantity: Math.max(0, p.quantity - step(p)) })}>
                −
              </button>
              <strong className="qty">{fmtQty(p.quantity, p.unit)}</strong>
              <button className="icon-btn" aria-label="Aumenta" onClick={() => pantry.update(p.id, { quantity: p.quantity + step(p) })}>
                +
              </button>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <Modal title={editing.id ? 'Modifica prodotto' : 'Nuovo prodotto'} onClose={() => setEditing(null)}>
          <EntityForm
            fields={[
              { name: 'name', label: 'Prodotto', required: true },
              { name: 'quantity', label: 'Quantità', type: 'number', min: 0, step: 0.01, half: true },
              { name: 'unit', label: 'Unità', type: 'select', options: UNITS, required: true, half: true },
              { name: 'min_quantity', label: 'Scorta minima (stessa unità)', type: 'number', min: 0, step: 0.01, half: true },
              { name: 'expires_on', label: 'Scadenza', type: 'date', half: true },
              { name: 'category', label: 'Reparto', suggestions: ['Frutta e verdura', 'Carne e pesce', 'Latticini', 'Pane e cereali', 'Dispensa', 'Surgelati', 'Bevande', 'Casa e igiene', 'Integratori', 'Altro'] },
            ]}
            initial={editing}
            onCancel={() => setEditing(null)}
            onDelete={editing.id ? () => pantry.remove(editing.id!).then(() => setEditing(null)) : undefined}
            onSubmit={async (v) => {
              const r = editing.id ? await pantry.update(editing.id, v) : await pantry.create(v);
              if (r) setEditing(null);
            }}
          />
        </Modal>
      )}
    </>
  );
}

// ---------------- piano alimentare ----------------
function MealPlan() {
  const plan = useResource<PlanMeal>('meal_plan');
  const [editing, setEditing] = useState<Partial<PlanMeal> | null>(null);
  const todayWd = isoWeekday(today());

  const copyDay = async (from: number) => {
    const to = Number(prompt(`Copia ${WEEKDAYS[from - 1]} su quale giorno? (1 = lunedì … 7 = domenica, 0 = tutti gli altri)`));
    if (Number.isNaN(to) || to < 0 || to > 7) return;
    const targets = to === 0 ? [1, 2, 3, 4, 5, 6, 7].filter((d) => d !== from) : [to];
    const src = plan.items.filter((p) => p.weekday === from);
    await act(async () => {
      for (const d of targets) for (const { id: _i, created_at: _c, updated_at: _u, ...rest } of src) await api.post('/meal_plan', { ...rest, weekday: d });
    }, 'Giornata copiata');
  };

  return (
    <>
      <p className="muted small">Inserisci i pasti della tua settimana tipo con i loro ingredienti: servono per calcolare la spesa e scalare la dispensa.</p>
      <div className="plan-week">
        {WEEKDAYS.map((label, i) => {
          const wd = i + 1;
          const meals = plan.items.filter((p) => p.weekday === wd);
          const kcal = meals.reduce((s, m) => s + (m.calories ?? 0), 0);
          return (
            <Card
              key={wd}
              className={wd === todayWd ? 'is-today' : ''}
              title={
                <>
                  {label} {kcal > 0 && <span className="muted small">· {fmtNum(kcal)} kcal</span>}
                </>
              }
              action={
                <span className="row-gap">
                  {meals.length > 0 && (
                    <button className="icon-btn" title="Copia su altri giorni" onClick={() => copyDay(wd)}>
                      ⧉
                    </button>
                  )}
                  <button className="icon-btn" title="Aggiungi pasto" onClick={() => setEditing({ weekday: wd, meal_type: 'pranzo', ingredients: [] })}>
                    +
                  </button>
                </span>
              }
            >
              {meals.length === 0 ? (
                <p className="muted small">—</p>
              ) : (
                <ul className="list compact">
                  {meals.map((m) => (
                    <li key={m.id} className="row clickable" onClick={() => setEditing(m)}>
                      <span className="muted small meal-type">{cap(m.meal_type)}</span>
                      <span className="grow">
                        {m.title}
                        {(m.ingredients ?? []).length > 0 && <div className="muted tiny ellipsis">{m.ingredients!.map((x) => x.name).join(', ')}</div>}
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
        <Modal title={editing.id ? 'Modifica pasto del piano' : 'Nuovo pasto del piano'} onClose={() => setEditing(null)} wide>
          <EntityForm
            fields={[
              { name: 'title', label: 'Pasto', required: true, placeholder: 'Es. Pollo, riso e verdure' },
              { name: 'weekday', label: 'Giorno', type: 'select', required: true, half: true, options: WEEKDAYS.map((l, i) => ({ value: i + 1, label: l })) },
              { name: 'meal_type', label: 'Momento', type: 'select', options: MEAL_TYPES, required: true, half: true },
              { name: 'calories', label: 'Calorie', type: 'number', min: 0, half: true },
              { name: 'protein', label: 'Proteine (g)', type: 'number', min: 0, half: true },
              { name: 'carbs', label: 'Carboidrati (g)', type: 'number', min: 0, half: true },
              { name: 'fat', label: 'Grassi (g)', type: 'number', min: 0, half: true },
            ]}
            initial={{ ...editing, ingredients: editing.ingredients ?? [] }}
            onCancel={() => setEditing(null)}
            onDelete={editing.id ? () => plan.remove(editing.id!).then(() => setEditing(null)) : undefined}
            onSubmit={async (v) => {
              const body = { ...v, ingredients: (v.ingredients as Ingredient[]).filter((x) => x.name.trim()) };
              const r = editing.id ? await plan.update(editing.id, body) : await plan.create(body);
              if (r) setEditing(null);
            }}
          >
            {(values, set) => <IngredientsEditor value={values.ingredients} onChange={(v) => set('ingredients', v)} />}
          </EntityForm>
        </Modal>
      )}
    </>
  );
}

function IngredientsEditor({ value, onChange }: { value: Ingredient[]; onChange: (v: Ingredient[]) => void }) {
  const update = (i: number, patch: Partial<Ingredient>) => onChange(value.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  return (
    <div className="exercises">
      <div className="subhead">Ingredienti (per una porzione)</div>
      {value.map((ing, i) => (
        <div key={i} className="ingredient-row">
          <input value={ing.name} placeholder="Es. Riso basmati" aria-label="Ingrediente" onChange={(e) => update(i, { name: e.target.value })} />
          <input type="number" min={0} step={0.01} value={ing.quantity ?? ''} aria-label="Quantità" onChange={(e) => update(i, { quantity: e.target.value === '' ? null : Number(e.target.value) })} />
          <select value={ing.unit ?? 'g'} aria-label="Unità" onChange={(e) => update(i, { unit: e.target.value })}>
            {UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
          <button type="button" className="icon-btn" aria-label="Rimuovi ingrediente" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <button type="button" className="btn small" onClick={() => onChange([...value, { name: '', quantity: null, unit: 'g' }])}>
        + Ingrediente
      </button>
    </div>
  );
}
