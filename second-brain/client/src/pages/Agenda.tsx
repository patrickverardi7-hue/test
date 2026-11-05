import { useState } from 'react';
import { act, api, useResource } from '../api';
import { EntityForm, Empty, Modal, PageHeader, Tabs } from '../components/ui';
import { eventFields } from '../forms';
import type { EventItem, Task } from '../types';
import { addDays, cap, fmtDate, fmtDayLabel, minToTime, startOfWeek, timeToMin, today } from '../utils';

type View = 'settimana' | 'giorno';
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00 → 23:00

export default function Agenda() {
  const [view, setView] = useState<View>('giorno');
  const [day, setDay] = useState(today());
  const [editing, setEditing] = useState<Partial<EventItem> | null>(null);
  const weekStart = startOfWeek(day);
  const from = view === 'settimana' ? weekStart : day;
  const to = view === 'settimana' ? addDays(weekStart, 6) : day;

  const events = useResource<EventItem>('events', { from, to });
  const dueTasks = useResource<Task>('tasks', { from, to });
  const openTasks = useResource<Task>('tasks', { status__ne: 'done' });

  const shift = (n: number) => setDay(addDays(day, view === 'settimana' ? n * 7 : n));

  const saveEvent = async (v: Record<string, unknown>) => {
    const r = editing?.id ? await events.update(editing.id, v) : await events.create(v);
    if (r) setEditing(null);
  };

  return (
    <div className="page">
      <PageHeader
        title="Agenda & tempo"
        subtitle="Impegni, appuntamenti e time-blocking della giornata."
        actions={
          <button className="btn primary" onClick={() => setEditing({ date: day, category: 'personale' })}>
            + Evento
          </button>
        }
      />
      <div className="toolbar">
        <Tabs<View>
          value={view}
          onChange={setView}
          options={[
            { value: 'giorno', label: 'Giorno' },
            { value: 'settimana', label: 'Settimana' },
          ]}
        />
        <div className="nav-group">
          <button className="btn ghost" onClick={() => shift(-1)} aria-label="Precedente">
            ‹
          </button>
          <button className="btn ghost" onClick={() => setDay(today())}>
            Oggi
          </button>
          <button className="btn ghost" onClick={() => shift(1)} aria-label="Successivo">
            ›
          </button>
        </div>
        <input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="Scegli data" />
        <strong className="toolbar-title">
          {view === 'giorno' ? cap(fmtDate(day, { weekday: 'long', day: 'numeric', month: 'long' })) : `${fmtDate(weekStart)} – ${fmtDate(addDays(weekStart, 6))}`}
        </strong>
      </div>

      {view === 'settimana' ? (
        <div className="week">
          {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d) => {
            const evs = events.items.filter((e) => e.date === d);
            const tks = dueTasks.items.filter((t) => t.due_date === d);
            return (
              <div key={d} className={`week-day ${d === today() ? 'is-today' : ''}`}>
                <div className="week-day-head">
                  <button
                    className="link"
                    onClick={() => {
                      setDay(d);
                      setView('giorno');
                    }}
                  >
                    {cap(fmtDate(d, { weekday: 'short', day: 'numeric' }))}
                  </button>
                  <button className="icon-btn" title="Aggiungi evento" onClick={() => setEditing({ date: d, category: 'personale' })}>
                    +
                  </button>
                </div>
                {evs.map((e) => (
                  <button key={e.id} className={`event-pill cat-${e.category}`} onClick={() => setEditing(e)}>
                    {e.start_time && <b>{e.start_time} </b>}
                    {e.title}
                  </button>
                ))}
                {tks.map((t) => (
                  <div key={t.id} className={`task-pill ${t.status === 'done' ? 'is-done' : ''}`}>
                    ☐ {t.title}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="day-layout">
          <div className="timeline card">
            {events.items
              .filter((e) => !e.start_time)
              .map((e) => (
                <button key={e.id} className={`event-pill cat-${e.category}`} onClick={() => setEditing(e)}>
                  Tutto il giorno · {e.title}
                </button>
              ))}
            {HOURS.map((h) => {
              const evs = events.items.filter((e) => e.start_time && Number(e.start_time.slice(0, 2)) === h);
              return (
                <div key={h} className="hour-row">
                  <button className="hour-label" title="Aggiungi evento a quest'ora" onClick={() => setEditing({ date: day, start_time: minToTime(h * 60), end_time: minToTime(h * 60 + 60), category: 'personale' })}>
                    {String(h).padStart(2, '0')}:00
                  </button>
                  <div className="hour-slot">
                    {evs.map((e) => (
                      <button key={e.id} className={`event-block cat-${e.category}`} onClick={() => setEditing(e)}>
                        <b>
                          {e.start_time}
                          {e.end_time ? `–${e.end_time}` : ''}
                        </b>{' '}
                        {e.title}
                        {e.location && <span className="muted"> · 📍{e.location}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <PlanPanel day={day} tasks={openTasks.items.filter((t) => !t.due_date || t.due_date <= day)} events={events.items} />
        </div>
      )}

      {editing && (
        <Modal title={editing.id ? 'Modifica evento' : 'Nuovo evento'} onClose={() => setEditing(null)}>
          <EntityForm
            fields={eventFields}
            initial={editing}
            onSubmit={saveEvent}
            onCancel={() => setEditing(null)}
            onDelete={editing.id ? () => events.remove(editing.id!).then(() => setEditing(null)) : undefined}
          />
        </Modal>
      )}
    </div>
  );
}

/** Pannello di time-blocking: trasforma i task in blocchi di tempo in agenda */
function PlanPanel({ day, tasks, events }: { day: string; tasks: Task[]; events: EventItem[] }) {
  const [planning, setPlanning] = useState<Task | null>(null);
  const [start, setStart] = useState('09:00');
  const scheduled = new Set(events.map((e) => e.task_id).filter(Boolean));

  // suggerisce il primo spazio libero abbastanza lungo per il task
  const nextFree = (durationMin: number) => {
    const now = new Date();
    const base = day === today() ? Math.max(8 * 60, Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15) : 9 * 60;
    const busy = events
      .filter((e) => e.start_time)
      .map((e) => ({ start: timeToMin(e.start_time!), end: e.end_time ? timeToMin(e.end_time) : timeToMin(e.start_time!) + 60 }))
      .sort((a, b) => a.start - b.start);
    let cursor = base;
    for (const b of busy) {
      if (b.start - cursor >= durationMin) break;
      cursor = Math.max(cursor, b.end);
    }
    return minToTime(cursor);
  };

  const plan = async () => {
    if (!planning) return;
    const dur = planning.estimate_min || 60;
    await act(
      () =>
        api.post('/events', {
          title: planning.title,
          date: day,
          start_time: start,
          end_time: minToTime(timeToMin(start) + dur),
          category: planning.area ?? 'personale',
          task_id: planning.id,
        }),
      'Blocco di tempo aggiunto',
    );
    setPlanning(null);
  };

  const sorted = [...tasks].sort((a, b) => b.priority - a.priority || (a.due_date ?? '9').localeCompare(b.due_date ?? '9'));
  const totalMin = sorted.filter((t) => !scheduled.has(t.id)).reduce((s, t) => s + (t.estimate_min || 0), 0);

  return (
    <aside className="card plan-panel">
      <div className="card-head">
        <h3>Da pianificare</h3>
        {totalMin > 0 && <span className="muted small">~{Math.round(totalMin / 6) / 10} h stimate</span>}
      </div>
      <p className="muted small">Assegna un orario ai task per bloccare il tempo in agenda.</p>
      {sorted.length === 0 && <Empty>Nessun task aperto per {fmtDayLabel(day).toLowerCase()}.</Empty>}
      <ul className="list">
        {sorted.map((t) => (
          <li key={t.id} className={`row prio-${t.priority}`}>
            <span className="grow ellipsis">
              {scheduled.has(t.id) ? '✅ ' : ''}
              {t.title}
            </span>
            {t.estimate_min ? <span className="muted small">{t.estimate_min}′</span> : null}
            {!scheduled.has(t.id) && (
              <button
                className="btn small"
                onClick={() => {
                  setStart(nextFree(t.estimate_min || 60));
                  setPlanning(t);
                }}
              >
                ⏱ Pianifica
              </button>
            )}
          </li>
        ))}
      </ul>
      {planning && (
        <Modal title={`Pianifica: ${planning.title}`} onClose={() => setPlanning(null)}>
          <div className="form">
            <div className="field">
              <label htmlFor="plan-start">Ora di inizio</label>
              <input id="plan-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <p className="muted">
              Durata: {planning.estimate_min || 60} minuti (fino alle {minToTime(timeToMin(start) + (planning.estimate_min || 60))}).
            </p>
            <div className="form-actions">
              <span className="spacer" />
              <button className="btn ghost" onClick={() => setPlanning(null)}>
                Annulla
              </button>
              <button className="btn primary" onClick={plan}>
                Blocca il tempo
              </button>
            </div>
          </div>
        </Modal>
      )}
    </aside>
  );
}
