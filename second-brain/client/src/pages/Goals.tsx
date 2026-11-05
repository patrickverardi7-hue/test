import { useState } from 'react';
import { act, api, useFetch, useResource } from '../api';
import { Card, EntityForm, Empty, Modal, PageHeader, Progress } from '../components/ui';
import { goalFields } from '../forms';
import { goalProgress, type Goal, type Habit, type HabitOverview, type Milestone, type Task } from '../types';
import { cap, fmtDate, today } from '../utils';

export default function Goals() {
  const goals = useResource<Goal>('goals');
  const { items: tasks } = useResource<Task>('tasks');
  const [editing, setEditing] = useState<Partial<Goal> | null>(null);
  const [showDone, setShowDone] = useState(false);

  const visible = goals.items.filter((g) => showDone || g.status !== 'completato');

  const toggleMilestone = (g: Goal, i: number) => {
    const ms = (g.milestones ?? []).map((m, j) => (j === i ? { ...m, done: !m.done } : m));
    goals.update(g.id, { milestones: ms });
  };

  return (
    <div className="page">
      <PageHeader title="Obiettivi & abitudini" subtitle="Dove vuoi arrivare e cosa fai ogni giorno per arrivarci." />

      <Habits />

      <div className="section-head">
        <h2>Obiettivi</h2>
        <label className="check small">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Mostra completati
        </label>
        <span className="spacer" />
        <button className="btn primary" onClick={() => setEditing({ status: 'attivo', area: 'personale', milestones: [] })}>
          + Obiettivo
        </button>
      </div>

      {visible.length === 0 && <Empty>Nessun obiettivo. Inizia da uno per area: salute, lavoro, finanze, social…</Empty>}

      <div className="grid">
        {visible.map((g) => {
          const pct = goalProgress(g);
          const linked = tasks.filter((t) => t.goal_id === g.id);
          const openLinked = linked.filter((t) => t.status !== 'done');
          return (
            <Card
              key={g.id}
              className={g.status === 'completato' ? 'is-done' : ''}
              title={
                <>
                  {g.status === 'completato' ? '🏆 ' : g.status === 'in pausa' ? '⏸ ' : '🎯 '}
                  {g.title}
                </>
              }
              action={
                <button className="icon-btn" onClick={() => setEditing(g)} aria-label="Modifica">
                  ✎
                </button>
              }
            >
              <div className="meta-row">
                {g.area && <span className="badge">{g.area}</span>}
                {g.target_date && <span className="muted small">entro {fmtDate(g.target_date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
              </div>
              {g.description && <p className="muted small">{g.description}</p>}
              <Progress
                value={pct}
                right={g.metric_target ? `${g.metric_current ?? 0} / ${g.metric_target} ${g.unit ?? ''}` : `${pct}%`}
                label="Progresso"
                color={pct >= 100 ? 'var(--green)' : undefined}
              />
              {(g.milestones ?? []).length > 0 && (
                <ul className="milestones">
                  {g.milestones!.map((m, i) => (
                    <li key={i}>
                      <label className="check">
                        <input type="checkbox" checked={m.done} onChange={() => toggleMilestone(g, i)} /> <span className={m.done ? 'strike' : ''}>{m.text}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
              {linked.length > 0 && (
                <p className="muted small">
                  ☑ {linked.length - openLinked.length}/{linked.length} task collegati completati
                </p>
              )}
              {pct >= 100 && g.status === 'attivo' && (
                <button className="btn small" onClick={() => goals.update(g.id, { status: 'completato' })}>
                  🏆 Segna come raggiunto
                </button>
              )}
            </Card>
          );
        })}
      </div>

      {editing && (
        <Modal title={editing.id ? 'Modifica obiettivo' : 'Nuovo obiettivo'} onClose={() => setEditing(null)}>
          <EntityForm
            fields={goalFields}
            initial={{ ...editing, milestones_text: (editing.milestones ?? []).map((m) => m.text).join('\n') }}
            onCancel={() => setEditing(null)}
            onDelete={editing.id ? () => goals.remove(editing.id!).then(() => setEditing(null)) : undefined}
            onSubmit={async (v) => {
              const old = editing.milestones ?? [];
              const milestones: Milestone[] = String(v.milestones_text ?? '')
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean)
                .map((text) => ({ text, done: old.find((m) => m.text === text)?.done ?? false }));
              const { milestones_text: _, ...rest } = v;
              const body = { ...rest, milestones };
              const r = editing.id ? await goals.update(editing.id, body) : await goals.create(body);
              if (r) setEditing(null);
            }}
          >
            {(values, set) => (
              <div className="field">
                <label htmlFor="ms">Tappe intermedie (una per riga — il progresso si calcola da qui)</label>
                <textarea id="ms" rows={4} value={values.milestones_text ?? ''} onChange={(e) => set('milestones_text', e.target.value)} placeholder={'Es.\nDefinire il piano\nPrimo mese completato\n…'} />
              </div>
            )}
          </EntityForm>
        </Modal>
      )}
    </div>
  );
}

function Habits() {
  const date = today();
  const { data: habits = [] } = useFetch<HabitOverview[]>(`/habits/overview?date=${date}`);
  const habitRes = useResource<Habit>('habits', { archived: 'false' });
  const [editing, setEditing] = useState<Partial<Habit> | null>(null);

  return (
    <Card
      title="Abitudini"
      action={
        <button className="btn small" onClick={() => setEditing({ icon: '✅', color: '#7c5cff' })}>
          + Abitudine
        </button>
      }
    >
      {habits.length === 0 && <Empty>Es. 💧 Bere 2L d'acqua · 📚 Leggere 20 minuti · 🧘 Meditare</Empty>}
      <div className="habit-table">
        {habits.map((h) => (
          <div key={h.id} className="habit-row" style={{ ['--habit' as string]: h.color ?? undefined }}>
            <button className="link habit-name" onClick={() => setEditing(h)}>
              <span>{h.icon}</span> {h.name}
            </button>
            <div className="habit-days">
              {h.last7.map((d) => (
                <button
                  key={d.date}
                  className={`habit-day ${d.done ? 'done' : ''} ${d.date === date ? 'today' : ''}`}
                  title={`${cap(fmtDate(d.date, { weekday: 'long', day: 'numeric' }))}: ${d.done ? 'fatto' : 'non fatto'}`}
                  onClick={() => act(() => api.post(`/habits/${h.id}/toggle`, { date: d.date }))}
                >
                  {fmtDate(d.date, { weekday: 'narrow' })}
                </button>
              ))}
            </div>
            <span className="habit-stats">
              🔥 {h.streak} <span className="muted small">· {h.rate30}% in 30gg</span>
            </span>
          </div>
        ))}
      </div>
      {editing && (
        <Modal title={editing.id ? 'Modifica abitudine' : 'Nuova abitudine'} onClose={() => setEditing(null)}>
          <EntityForm
            fields={[
              { name: 'name', label: 'Nome', required: true },
              { name: 'icon', label: 'Emoji', half: true },
              { name: 'color', label: 'Colore', type: 'color', half: true },
            ]}
            initial={editing}
            onCancel={() => setEditing(null)}
            onDelete={editing.id ? () => habitRes.remove(editing.id!).then(() => setEditing(null)) : undefined}
            onSubmit={async (v) => {
              const r = editing.id ? await habitRes.update(editing.id, v) : await habitRes.create(v);
              if (r) setEditing(null);
            }}
          />
        </Modal>
      )}
    </Card>
  );
}
