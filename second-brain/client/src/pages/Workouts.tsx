import { useMemo, useState } from 'react';
import { useFetch, useResource } from '../api';
import { Card, EntityForm, Empty, Modal, PageHeader, Progress, Stat } from '../components/ui';
import type { Exercise, Settings, Workout } from '../types';
import { addDays, cap, fmtDayLabel, fmtNum, startOfWeek, today, WORKOUT_TYPES } from '../utils';

const TYPE_ICON: Record<string, string> = { forza: '🏋️', cardio: '🏃', mobilità: '🧘', sport: '⚽', altro: '💪' };

export default function Workouts() {
  const date = today();
  const workouts = useResource<Workout>('workouts', { limit: 500 });
  const { data: settings } = useFetch<Settings>('/settings');
  const [editing, setEditing] = useState<Partial<Workout> | null>(null);

  const weekStart = startOfWeek(date);
  const thisWeek = workouts.items.filter((w) => w.date >= weekStart && w.date <= addDays(weekStart, 6));
  const last30 = workouts.items.filter((w) => w.date > addDays(date, -30));
  const target = settings?.workouts_per_week ?? 4;

  // record personali: carico massimo per esercizio
  const records = useMemo(() => {
    const map = new Map<string, { weight: number; reps: number | null; date: string }>();
    for (const w of workouts.items)
      for (const e of w.exercises ?? []) {
        if (!e.name || !e.weight) continue;
        const key = e.name.trim();
        const cur = map.get(key);
        if (!cur || e.weight > cur.weight) map.set(key, { weight: e.weight, reps: e.reps, date: w.date });
      }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [workouts.items]);

  const exerciseNames = records.map(([n]) => n);

  return (
    <div className="page">
      <PageHeader
        title="Allenamenti"
        subtitle="Sessioni, esercizi, carichi e record personali."
        actions={
          <button className="btn primary" onClick={() => setEditing({ date, type: 'forza', exercises: [] })}>
            + Allenamento
          </button>
        }
      />

      <div className="stats-row">
        <Stat label="Questa settimana" value={`${thisWeek.length}/${target}`} sub="sessioni" tone={thisWeek.length >= target ? 'good' : undefined} />
        <Stat label="Ultimi 30 giorni" value={last30.length} sub={`${fmtNum(last30.reduce((s, w) => s + (w.duration_min ?? 0), 0))} minuti totali`} />
        <Stat label="Volume 30 gg" value={`${fmtNum(last30.reduce((s, w) => s + volume(w.exercises), 0))} kg`} sub="serie × ripetizioni × carico" />
      </div>

      <div className="grid">
        <Card title="Obiettivo settimanale">
          <Progress value={thisWeek.length} max={target} right={`${thisWeek.length} di ${target}`} color="var(--green)" />
          <div className="week-dots">
            {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d) => {
              const w = thisWeek.filter((x) => x.date === d);
              return (
                <div key={d} className={`week-dot ${w.length ? 'done' : ''} ${d === date ? 'today' : ''}`} title={w.map((x) => x.title).join(', ')}>
                  <span>{fmtDayLabel(d) === 'Oggi' ? 'Oggi' : cap(new Date(d + 'T00:00').toLocaleDateString('it-IT', { weekday: 'short' }))}</span>
                  <b>{w.length ? TYPE_ICON[w[0].type] ?? '💪' : '·'}</b>
                </div>
              );
            })}
          </div>
        </Card>
        <Card title="🏆 Record personali">
          {records.length === 0 ? (
            <Empty>Registra esercizi con il carico per vedere i tuoi massimali.</Empty>
          ) : (
            <ul className="list compact">
              {records.map(([name, r]) => (
                <li key={name} className="row">
                  <span className="grow">{name}</span>
                  <strong>
                    {r.weight} kg{r.reps ? ` × ${r.reps}` : ''}
                  </strong>
                  <span className="muted small">{fmtDayLabel(r.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <h2>Storico</h2>
      {workouts.items.length === 0 && <Empty>{workouts.loading ? 'Caricamento…' : 'Nessun allenamento registrato.'}</Empty>}
      <ul className="list card-list">
        {workouts.items.slice(0, 100).map((w) => (
          <li key={w.id} className="row clickable workout-row" onClick={() => setEditing(w)}>
            <span className="workout-icon">{TYPE_ICON[w.type] ?? '💪'}</span>
            <div className="grow">
              <div>
                <strong>{w.title}</strong> <span className="muted small">· {fmtDayLabel(w.date)}</span>
              </div>
              {(w.exercises ?? []).length > 0 && (
                <div className="muted small ellipsis">
                  {w.exercises!.map((e) => `${e.name}${e.sets && e.reps ? ` ${e.sets}×${e.reps}` : ''}${e.weight ? ` @${e.weight}kg` : ''}`).join(' · ')}
                </div>
              )}
            </div>
            {w.duration_min ? <span className="muted small">{w.duration_min} min</span> : null}
            <button
              className="btn small"
              title="Ripeti oggi"
              onClick={(e) => {
                e.stopPropagation();
                setEditing({ ...w, id: undefined, date });
              }}
            >
              ↺ Ripeti
            </button>
          </li>
        ))}
      </ul>

      {editing && (
        <Modal title={editing.id ? 'Modifica allenamento' : 'Nuovo allenamento'} onClose={() => setEditing(null)} wide>
          <EntityForm
            fields={[
              { name: 'title', label: 'Titolo', required: true, placeholder: 'Es. Push, Corsa 5 km, Gambe…' },
              { name: 'date', label: 'Data', type: 'date', required: true, half: true },
              { name: 'type', label: 'Tipo', type: 'select', options: WORKOUT_TYPES, required: true, half: true },
              { name: 'duration_min', label: 'Durata (min)', type: 'number', min: 0, half: true },
              { name: 'calories', label: 'Calorie bruciate', type: 'number', min: 0, half: true },
              { name: 'notes', label: 'Note (sensazioni, RPE…)', type: 'textarea', rows: 2 },
            ]}
            initial={{ ...editing, exercises: editing.exercises ?? [] }}
            onCancel={() => setEditing(null)}
            onDelete={editing.id ? () => workouts.remove(editing.id!).then(() => setEditing(null)) : undefined}
            onSubmit={async (v) => {
              const exercises = ((v.exercises ?? []) as Exercise[]).filter((e) => e.name.trim());
              const body = { ...v, exercises };
              const r = editing.id ? await workouts.update(editing.id, body) : await workouts.create(body);
              if (r) setEditing(null);
            }}
          >
            {(values, set) => <ExerciseEditor value={values.exercises ?? []} onChange={(ex) => set('exercises', ex)} suggestions={exerciseNames} />}
          </EntityForm>
        </Modal>
      )}
    </div>
  );
}

function volume(ex: Exercise[] | null) {
  return (ex ?? []).reduce((s, e) => s + (e.sets ?? 0) * (e.reps ?? 0) * (e.weight ?? 0), 0);
}

function ExerciseEditor({ value, onChange, suggestions }: { value: Exercise[]; onChange: (v: Exercise[]) => void; suggestions: string[] }) {
  const update = (i: number, patch: Partial<Exercise>) => onChange(value.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const num = (s: string) => (s === '' ? null : Number(s));
  return (
    <div className="exercises">
      <div className="subhead">Esercizi</div>
      {value.length > 0 && (
        <div className="exercise-row head muted small">
          <span>Esercizio</span>
          <span>Serie</span>
          <span>Rip.</span>
          <span>Kg</span>
          <span />
        </div>
      )}
      {value.map((e, i) => (
        <div key={i} className="exercise-row">
          <input value={e.name} list="exercise-names" placeholder="Es. Squat" aria-label="Esercizio" onChange={(ev) => update(i, { name: ev.target.value })} />
          <input type="number" min={0} value={e.sets ?? ''} aria-label="Serie" onChange={(ev) => update(i, { sets: num(ev.target.value) })} />
          <input type="number" min={0} value={e.reps ?? ''} aria-label="Ripetizioni" onChange={(ev) => update(i, { reps: num(ev.target.value) })} />
          <input type="number" min={0} step={0.5} value={e.weight ?? ''} aria-label="Carico in kg" onChange={(ev) => update(i, { weight: num(ev.target.value) })} />
          <button type="button" className="icon-btn" aria-label="Rimuovi esercizio" onClick={() => onChange(value.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      <datalist id="exercise-names">
        {suggestions.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      <button type="button" className="btn small" onClick={() => onChange([...value, { name: '', sets: 3, reps: 10, weight: null }])}>
        + Esercizio
      </button>
    </div>
  );
}
