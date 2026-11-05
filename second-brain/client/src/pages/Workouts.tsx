import { useMemo, useState, type ReactNode } from 'react';
import { useFetch, useResource } from '../api';
import { Bars, Card, EntityForm, Empty, LineChart, Modal, PageHeader, Progress, Stat, Tabs } from '../components/ui';
import type { BodyMetric, Exercise, Settings, Workout, WorkoutProgress } from '../types';
import { addDays, cap, fmtDate, fmtDayLabel, fmtNum, startOfWeek, today, WORKOUT_TYPES } from '../utils';

const TYPE_ICON: Record<string, string> = { forza: '🏋️', cardio: '🏃', mobilità: '🧘', sport: '⚽', altro: '💪' };

type Tab = 'diario' | 'progressi';

export default function Workouts() {
  const [tab, setTab] = useState<Tab>('diario');
  const tabs = (
    <div className="toolbar">
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'diario', label: '📒 Diario' },
          { value: 'progressi', label: '📈 Progressi' },
        ]}
      />
    </div>
  );
  return tab === 'diario' ? <Diary tabs={tabs} /> : <ProgressView tabs={tabs} />;
}

function Diary({ tabs }: { tabs: ReactNode }) {
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
      {tabs}

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

function ProgressView({ tabs }: { tabs: ReactNode }) {
  const { data } = useFetch<WorkoutProgress>(`/workouts/progress?weeks=12&date=${today()}`);
  const metrics = useResource<BodyMetric>('body_metrics');
  const [selected, setSelected] = useState('');
  const [editing, setEditing] = useState<Partial<BodyMetric> | null>(null);
  const [metric, setMetric] = useState<'e1rm' | 'weight' | 'volume'>('e1rm');

  const ex = data?.exercises.find((e) => e.name === selected) ?? data?.exercises[0];
  const lastWeight = data?.body.filter((b) => b.weight !== null).slice(-1)[0];
  const firstWeight = data?.body.find((b) => b.weight !== null);

  return (
    <div className="page">
      <PageHeader
        title="Allenamenti"
        subtitle="Come stai migliorando: massimali stimati, carichi, volume e peso corporeo."
        actions={
          <button className="btn primary" onClick={() => setEditing({ date: today() })}>
            + Misurazione
          </button>
        }
      />
      {tabs}
      {!data ? (
        <div className="loading">Caricamento…</div>
      ) : (
        <>
          <div className="grid">
            <Card
              title="Progressi per esercizio"
              className="span-all"
              action={
                data.exercises.length > 0 && (
                  <div className="row-gap">
                    <select value={ex?.name ?? ''} onChange={(e) => setSelected(e.target.value)} aria-label="Esercizio">
                      {data.exercises.map((e) => (
                        <option key={e.name}>{e.name}</option>
                      ))}
                    </select>
                    <select value={metric} onChange={(e) => setMetric(e.target.value as typeof metric)} aria-label="Metrica">
                      <option value="e1rm">Massimale stimato</option>
                      <option value="weight">Carico migliore</option>
                      <option value="volume">Volume</option>
                    </select>
                  </div>
                )
              }
            >
              {!ex ? (
                <Empty>Registra allenamenti con esercizi e carichi per vedere i progressi.</Empty>
              ) : (
                <>
                  <div className="stats-row compact">
                    <Stat label="Massimale stimato" value={`${ex.last1rm} kg`} sub={`record ${ex.best1rm} kg`} tone="accent" />
                    <Stat label="Carico record" value={`${ex.prWeight} kg × ${ex.prReps}`} sub={fmtDayLabel(ex.prDate)} />
                    <Stat
                      label="Miglioramento"
                      value={ex.changePct === null ? '—' : `${ex.changePct > 0 ? '+' : ''}${ex.changePct}%`}
                      sub={`da ${ex.first1rm} kg in ${ex.sessionsCount} sessioni`}
                      tone={ex.changePct !== null && ex.changePct > 0 ? 'good' : ex.changePct !== null && ex.changePct < 0 ? 'bad' : undefined}
                    />
                  </div>
                  <LineChart
                    points={ex.history.map((h) => ({ x: fmtDate(h.date), y: h[metric] }))}
                    format={(n) => (metric === 'volume' ? fmtNum(n) : `${fmtNum(n, 1)}`) + ' kg'}
                  />
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Data</th>
                        <th>Miglior serie</th>
                        <th>Massimale stimato</th>
                        <th>Volume</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...ex.history].reverse().slice(0, 10).map((h) => (
                        <tr key={h.date}>
                          <td>{fmtDayLabel(h.date)}</td>
                          <td>
                            {h.sets}×{h.reps} @ {h.weight} kg
                          </td>
                          <td>{h.e1rm} kg</td>
                          <td>{fmtNum(h.volume)} kg</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </Card>

            <Card title="Volume settimanale (kg)">
              <Bars data={data.weekly.map((w) => ({ label: fmtDate(w.week, { day: 'numeric', month: 'numeric' }), value: w.volume }))} format={(n) => `${fmtNum(n)} kg`} />
            </Card>
            <Card title="Sessioni a settimana">
              <Bars data={data.weekly.map((w) => ({ label: fmtDate(w.week, { day: 'numeric', month: 'numeric' }), value: w.sessions }))} format={(n) => `${n} sessioni`} />
            </Card>

            <Card title="⚖️ Peso corporeo" className="span-2">
              {lastWeight && firstWeight && (
                <p className="muted small">
                  Ora {lastWeight.weight} kg · {fmtNum((lastWeight.weight ?? 0) - (firstWeight.weight ?? 0), 1)} kg dal {fmtDate(firstWeight.date)}
                </p>
              )}
              <LineChart points={data.body.filter((b) => b.weight !== null).map((b) => ({ x: fmtDate(b.date), y: b.weight }))} format={(n) => `${fmtNum(n, 1)} kg`} />
            </Card>
            <Card title="Tutti gli esercizi">
              <ul className="list compact">
                {data.exercises.map((e) => (
                  <li key={e.name} className="row clickable" onClick={() => setSelected(e.name)}>
                    <span className="grow">{e.name}</span>
                    <span className="muted small">{e.last1rm} kg</span>
                    {e.changePct !== null && <span className={`small ${e.changePct >= 0 ? 'text-green' : 'text-red'}`}>{e.changePct > 0 ? '+' : ''}{e.changePct}%</span>}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          {metrics.items.length > 0 && (
            <>
              <h2>Misurazioni</h2>
              <ul className="list card-list">
                {metrics.items.slice(0, 20).map((m) => (
                  <li key={m.id} className="row clickable" onClick={() => setEditing(m)}>
                    <span className="muted small date-col">{fmtDate(m.date)}</span>
                    <span className="grow">
                      {m.weight !== null && <b>{m.weight} kg</b>}
                      {m.body_fat !== null && <span className="muted"> · {m.body_fat}% grasso</span>}
                      {m.waist !== null && <span className="muted"> · vita {m.waist} cm</span>}
                    </span>
                    {m.notes && <span className="muted small ellipsis">{m.notes}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
      {editing && (
        <Modal title={editing.id ? 'Modifica misurazione' : 'Nuova misurazione'} onClose={() => setEditing(null)}>
          <EntityForm
            fields={[
              { name: 'date', label: 'Data', type: 'date', required: true, half: true },
              { name: 'weight', label: 'Peso (kg)', type: 'number', step: 0.1, min: 0, half: true },
              { name: 'body_fat', label: 'Massa grassa (%)', type: 'number', step: 0.1, min: 0, half: true },
              { name: 'waist', label: 'Circonferenza vita (cm)', type: 'number', step: 0.5, min: 0, half: true },
              { name: 'notes', label: 'Note', type: 'textarea', rows: 2 },
            ]}
            initial={editing}
            onCancel={() => setEditing(null)}
            onDelete={editing.id ? () => metrics.remove(editing.id!).then(() => setEditing(null)) : undefined}
            onSubmit={async (v) => {
              const r = editing.id ? await metrics.update(editing.id, v) : await metrics.create(v);
              if (r) setEditing(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
