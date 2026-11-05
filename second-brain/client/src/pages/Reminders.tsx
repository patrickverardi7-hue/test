import { useState } from 'react';
import { act, api, useResource } from '../api';
import { EntityForm, Empty, Modal, PageHeader } from '../components/ui';
import { reminderFields } from '../forms';
import type { Reminder } from '../types';
import { fmtDateTime, nowLocal, today } from '../utils';

const REPEAT_LABEL: Record<string, string> = { daily: 'ogni giorno', weekly: 'ogni settimana', monthly: 'ogni mese' };

export default function Reminders() {
  const reminders = useResource<Reminder>('reminders');
  const [editing, setEditing] = useState<Partial<Reminder> | null>(null);
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const now = nowLocal();
  const t = today();

  const active = reminders.items.filter((r) => !r.done);
  const groups = [
    { title: 'Scaduti', items: active.filter((r) => r.remind_at < now), tone: 'text-red' },
    { title: 'Oggi', items: active.filter((r) => r.remind_at >= now && r.remind_at.slice(0, 10) === t) },
    { title: 'Prossimamente', items: active.filter((r) => r.remind_at.slice(0, 10) > t) },
    { title: 'Completati', items: reminders.items.filter((r) => r.done).slice(0, 30), tone: 'muted' },
  ];

  const inOneHour = () => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
  };

  return (
    <div className="page">
      <PageHeader
        title="Promemoria"
        subtitle="Ricevi una notifica al momento giusto. I promemoria ricorrenti si ripianificano da soli."
        actions={
          <>
            {perm === 'default' && (
              <button className="btn" onClick={() => Notification.requestPermission().then(setPerm)}>
                🔔 Attiva notifiche
              </button>
            )}
            <button className="btn primary" onClick={() => setEditing({ remind_at: inOneHour(), repeat: 'none' })}>
              + Promemoria
            </button>
          </>
        }
      />
      {perm === 'denied' && <p className="notice">Le notifiche del browser sono bloccate: vedrai comunque gli avvisi dentro l'app.</p>}

      {active.length === 0 && !reminders.loading && <Empty>Nessun promemoria attivo.</Empty>}

      {groups
        .filter((g) => g.items.length)
        .map((g) => (
          <section key={g.title} className="task-group">
            <h3 className={g.tone}>{g.title}</h3>
            <ul className="list card-list">
              {g.items.map((r) => (
                <li key={r.id} className={`row ${r.done ? 'is-done' : ''}`}>
                  {!r.done ? (
                    <button className="icon-btn" title="Segna come fatto" onClick={() => act(() => api.post(`/reminders/${r.id}/complete`, { now: nowLocal() }), r.repeat !== 'none' ? 'Fatto: riprogrammato ✓' : 'Fatto ✓')}>
                      ○
                    </button>
                  ) : (
                    <button className="icon-btn" title="Riattiva" onClick={() => reminders.update(r.id, { done: false })}>
                      ↺
                    </button>
                  )}
                  <button className="link grow ellipsis" onClick={() => setEditing(r)}>
                    {r.title}
                    {r.notes && <span className="muted small"> — {r.notes}</span>}
                  </button>
                  {r.repeat !== 'none' && <span className="badge">🔁 {REPEAT_LABEL[r.repeat]}</span>}
                  <span className="muted small">{fmtDateTime(r.remind_at)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}

      {editing && (
        <Modal title={editing.id ? 'Modifica promemoria' : 'Nuovo promemoria'} onClose={() => setEditing(null)}>
          <EntityForm
            fields={reminderFields}
            initial={editing}
            onCancel={() => setEditing(null)}
            onDelete={editing.id ? () => reminders.remove(editing.id!).then(() => setEditing(null)) : undefined}
            onSubmit={async (v) => {
              const r = editing.id ? await reminders.update(editing.id, v) : await reminders.create(v);
              if (r) setEditing(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}
