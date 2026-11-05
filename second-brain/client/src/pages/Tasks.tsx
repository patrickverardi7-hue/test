import { useMemo, useState } from 'react';
import { useResource } from '../api';
import { EntityForm, Empty, Modal, PageHeader, Tabs } from '../components/ui';
import { taskFields } from '../forms';
import type { Goal, Task } from '../types';
import { AREAS, cap, fmtDayLabel, today } from '../utils';

type View = 'oggi' | 'prossimi' | 'senza' | 'tutti' | 'fatti';

export default function Tasks() {
  const tasks = useResource<Task>('tasks');
  const { items: goals } = useResource<Goal>('goals', { status: 'attivo' });
  const [view, setView] = useState<View>('oggi');
  const [area, setArea] = useState('');
  const [q, setQ] = useState('');
  const [quick, setQuick] = useState('');
  const [editing, setEditing] = useState<Partial<Task> | null>(null);
  const date = today();

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return tasks.items.filter((t) => {
      if (area && t.area !== area) return false;
      if (ql && !`${t.title} ${t.notes ?? ''}`.toLowerCase().includes(ql)) return false;
      const done = t.status === 'done';
      switch (view) {
        case 'oggi':
          return !done && t.due_date !== null && t.due_date <= date;
        case 'prossimi':
          return !done && t.due_date !== null && t.due_date > date;
        case 'senza':
          return !done && !t.due_date;
        case 'tutti':
          return !done;
        case 'fatti':
          return done;
      }
    });
  }, [tasks.items, view, area, q, date]);

  const groups = useMemo(() => {
    if (view === 'fatti') {
      const sorted = [...filtered].sort((a, b) => (b.completed_at ?? '').localeCompare(a.completed_at ?? ''));
      return [{ key: 'Completati', items: sorted.slice(0, 200) }];
    }
    const map = new Map<string, Task[]>();
    for (const t of filtered) {
      const key = !t.due_date ? 'Senza scadenza' : t.due_date < date ? 'In ritardo' : fmtDayLabel(t.due_date);
      map.set(key, [...(map.get(key) ?? []), t]);
    }
    return [...map.entries()].map(([key, items]) => ({ key, items }));
  }, [filtered, view, date]);

  const addQuick = async () => {
    const title = quick.trim();
    if (!title) return;
    // "!" all'inizio o alla fine = priorità alta
    const high = /(^!|!$)/.test(title);
    await tasks.create({
      title: title.replace(/(^!\s*|\s*!$)/g, ''),
      priority: high ? 3 : 2,
      due_date: view === 'oggi' ? date : null,
      area: area || 'personale',
    });
    setQuick('');
  };

  const counts = {
    oggi: tasks.items.filter((t) => t.status !== 'done' && t.due_date && t.due_date <= date).length,
    tutti: tasks.items.filter((t) => t.status !== 'done').length,
  };
  const goalName = (id: number | null) => goals.find((g) => g.id === id)?.title;

  return (
    <div className="page">
      <PageHeader
        title="Task"
        subtitle="Le cose da fare, ogni giorno. Aggiungi “!” per la priorità alta."
        actions={
          <button className="btn primary" onClick={() => setEditing({ due_date: date, priority: 2, status: 'todo', area: 'personale' })}>
            + Nuovo task
          </button>
        }
      />

      <div className="toolbar">
        <Tabs<View>
          value={view}
          onChange={setView}
          options={[
            { value: 'oggi', label: `Oggi (${counts.oggi})` },
            { value: 'prossimi', label: 'Prossimi' },
            { value: 'senza', label: 'Senza data' },
            { value: 'tutti', label: `Aperti (${counts.tutti})` },
            { value: 'fatti', label: 'Completati' },
          ]}
        />
        <select value={area} onChange={(e) => setArea(e.target.value)} aria-label="Filtra per area">
          <option value="">Tutte le aree</option>
          {AREAS.map((a) => (
            <option key={a} value={a}>
              {cap(a)}
            </option>
          ))}
        </select>
        <input type="search" placeholder="Cerca…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {view !== 'fatti' && (
        <form
          className="quick-add"
          onSubmit={(e) => {
            e.preventDefault();
            addQuick();
          }}
        >
          <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder={view === 'oggi' ? 'Aggiungi un task per oggi e premi Invio…' : 'Aggiungi un task e premi Invio…'} />
          <button className="btn" type="submit">
            Aggiungi
          </button>
        </form>
      )}

      {groups.length === 0 && <Empty>{tasks.loading ? 'Caricamento…' : 'Niente qui. Ottimo lavoro! ✨'}</Empty>}

      {groups.map((g) => (
        <section key={g.key} className="task-group">
          <h3 className={g.key === 'In ritardo' ? 'text-red' : ''}>
            {g.key} <span className="muted">({g.items.length})</span>
          </h3>
          <ul className="list card-list">
            {g.items.map((t) => (
              <li key={t.id} className={`row task prio-${t.priority} ${t.status === 'done' ? 'is-done' : ''}`}>
                <input
                  type="checkbox"
                  checked={t.status === 'done'}
                  aria-label={`Segna ${t.title} come completato`}
                  onChange={(e) => tasks.update(t.id, { status: e.target.checked ? 'done' : 'todo' })}
                />
                <button className="link grow ellipsis" onClick={() => setEditing(t)}>
                  {t.title}
                  {t.notes && <span className="muted small"> — {t.notes.slice(0, 80)}</span>}
                </button>
                {t.status === 'doing' && <span className="badge blue">In corso</span>}
                {goalName(t.goal_id) && <span className="badge purple">🎯 {goalName(t.goal_id)}</span>}
                {t.estimate_min ? <span className="muted small">{t.estimate_min}′</span> : null}
                {t.area && <span className="badge">{t.area}</span>}
                {t.due_date && view !== 'oggi' && <span className={`muted small ${t.due_date < date && t.status !== 'done' ? 'text-red' : ''}`}>{fmtDayLabel(t.due_date)}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {editing && (
        <Modal title={editing.id ? 'Modifica task' : 'Nuovo task'} onClose={() => setEditing(null)}>
          <EntityForm
            fields={taskFields(goals)}
            initial={editing}
            onCancel={() => setEditing(null)}
            onDelete={editing.id ? () => tasks.remove(editing.id!).then(() => setEditing(null)) : undefined}
            onSubmit={async (v) => {
              const r = editing.id ? await tasks.update(editing.id, v) : await tasks.create(v);
              if (r) setEditing(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
