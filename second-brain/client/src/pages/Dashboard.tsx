import { act, api, useFetch } from '../api';
import { Card, Empty, Progress, Stat } from '../components/ui';
import { Link } from '../router';
import { goalProgress, type Dashboard as DashboardData } from '../types';
import { cap, fmtDate, fmtDateTime, fmtDayLabel, fmtMoney, fmtNum, nowLocal, today } from '../utils';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Buonanotte';
  if (h < 13) return 'Buongiorno';
  if (h < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

export default function Dashboard() {
  const date = today();
  const { data, error } = useFetch<DashboardData>(`/dashboard?date=${date}`);

  if (error) return <Empty>Errore nel caricamento: {error}</Empty>;
  if (!data) return <div className="loading">Caricamento…</div>;

  const { settings, finance, nutrition, workouts } = data;
  const overdue = data.tasks.filter((t) => t.due_date! < date);
  const habitsDone = data.habits.filter((h) => h.doneToday).length;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>
            {greeting()}
            {settings.name ? `, ${settings.name}` : ''} 👋
          </h1>
          <p className="muted">{cap(fmtDate(date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</p>
        </div>
        <Link to="/assistente" className="btn primary">
          ✨ Pianifica la giornata con l'AI
        </Link>
      </header>

      <div className="stats-row">
        <Stat label="Task per oggi" value={data.tasks.length} sub={`${data.tasksDoneToday} completati oggi${overdue.length ? ` · ${overdue.length} in ritardo` : ''}`} tone={overdue.length ? 'bad' : undefined} />
        <Stat label="Abitudini" value={`${habitsDone}/${data.habits.length}`} sub="completate oggi" tone={habitsDone === data.habits.length && habitsDone > 0 ? 'good' : undefined} />
        <Stat label="Saldo del mese" value={fmtMoney(finance.net)} sub={`Uscite ${fmtMoney(finance.expense)}`} tone={finance.net >= 0 ? 'good' : 'bad'} />
        <Stat label="Allenamenti settimana" value={`${workouts.count}/${workouts.target}`} sub={`${workouts.minutes} minuti`} tone={workouts.count >= workouts.target ? 'good' : undefined} />
      </div>

      <div className="grid">
        <Card title="Task di oggi" to="/task" className="span-2">
          {data.tasks.length === 0 ? (
            <Empty>Nessun task in scadenza. 🎉</Empty>
          ) : (
            <ul className="list">
              {data.tasks.slice(0, 10).map((t) => (
                <li key={t.id} className="row">
                  <input
                    type="checkbox"
                    aria-label={`Completa ${t.title}`}
                    onChange={() => act(() => api.patch(`/tasks/${t.id}`, { status: 'done' }), 'Task completato ✓')}
                  />
                  <span className="grow">{t.title}</span>
                  {t.priority === 3 && <span className="badge red">Alta</span>}
                  <span className={`muted small ${t.due_date! < date ? 'text-red' : ''}`}>{fmtDayLabel(t.due_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Agenda di oggi" to="/agenda">
          {data.events.length === 0 ? (
            <Empty>Giornata libera.</Empty>
          ) : (
            <ul className="list">
              {data.events.map((e) => (
                <li key={e.id} className="row">
                  <span className="time">{e.start_time ?? 'tutto il giorno'}</span>
                  <span className="grow">{e.title}</span>
                </li>
              ))}
            </ul>
          )}
          {data.upcoming.length > 0 && (
            <>
              <div className="subhead">Prossimi giorni</div>
              <ul className="list compact">
                {data.upcoming.map((e) => (
                  <li key={e.id} className="row">
                    <span className="muted small">{fmtDayLabel(e.date)}</span>
                    <span className="grow">{e.title}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card title="Abitudini" to="/obiettivi">
          {data.habits.length === 0 ? (
            <Empty>Aggiungi le abitudini da costruire.</Empty>
          ) : (
            <div className="habit-chips">
              {data.habits.map((h) => (
                <button
                  key={h.id}
                  className={`habit-chip ${h.doneToday ? 'done' : ''}`}
                  style={{ ['--habit' as string]: h.color ?? undefined }}
                  onClick={() => act(() => api.post(`/habits/${h.id}/toggle`, { date }))}
                >
                  <span>{h.icon}</span> {h.name}
                  {h.streak > 1 && <small> 🔥{h.streak}</small>}
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card title="Promemoria" to="/promemoria">
          {data.reminders.length === 0 ? (
            <Empty>Nessun promemoria per oggi.</Empty>
          ) : (
            <ul className="list">
              {data.reminders.map((r) => (
                <li key={r.id} className="row">
                  <button className="icon-btn" title="Fatto" onClick={() => act(() => api.post(`/reminders/${r.id}/complete`, { now: nowLocal() }), 'Fatto ✓')}>
                    ○
                  </button>
                  <span className="grow">{r.title}</span>
                  <span className={`muted small ${r.remind_at < nowLocal() ? 'text-red' : ''}`}>{fmtDateTime(r.remind_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Alimentazione" to="/alimentazione">
          <Progress label="Calorie" value={nutrition.calories} max={nutrition.targets.calories} right={`${fmtNum(nutrition.calories)} / ${fmtNum(nutrition.targets.calories)} kcal`} />
          <Progress label="Proteine" value={nutrition.protein} max={nutrition.targets.protein} color="var(--green)" right={`${fmtNum(nutrition.protein)} / ${nutrition.targets.protein} g`} />
        </Card>

        <Card title="Finanze del mese" to="/finanze">
          <div className="kv">
            <span>Entrate</span>
            <strong className="text-green">{fmtMoney(finance.income)}</strong>
            <span>Uscite</span>
            <strong className="text-red">{fmtMoney(finance.expense)}</strong>
            <span>Saldo totale</span>
            <strong>{fmtMoney(finance.totalBalance)}</strong>
          </div>
          {finance.budgets
            .filter((b) => b.spent > b.monthly_limit * 0.8)
            .map((b) => (
              <Progress key={b.id} label={`⚠️ ${b.category}`} value={b.spent} max={b.monthly_limit} right={`${fmtMoney(b.spent)} / ${fmtMoney(b.monthly_limit)}`} />
            ))}
        </Card>

        <Card title="Obiettivi" to="/obiettivi" className="span-2">
          {data.goals.length === 0 ? (
            <Empty>Definisci i tuoi obiettivi per dare una direzione alle giornate.</Empty>
          ) : (
            data.goals.map((g) => <Progress key={g.id} label={g.title} value={goalProgress(g)} right={`${goalProgress(g)}%${g.target_date ? ' · ' + fmtDate(g.target_date) : ''}`} />)
          )}
        </Card>

        <Card title="Social in programma" to="/social">
          {data.social.length === 0 ? (
            <Empty>Nessun contenuto programmato.</Empty>
          ) : (
            <ul className="list">
              {data.social.map((p) => (
                <li key={p.id} className="row">
                  <span className={`badge platform-${p.platform}`}>{p.platform}</span>
                  <span className="grow">{p.title}</span>
                  <span className="muted small">{fmtDayLabel(p.publish_date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Note recenti" to="/note">
          {data.inboxCount > 0 && (
            <Link to="/note?type=inbox" className="inbox-alert">
              📥 {data.inboxCount} elementi nell'inbox da smistare
            </Link>
          )}
          {data.notes.length === 0 ? (
            <Empty>Cattura idee e appunti con “+ Cattura”.</Empty>
          ) : (
            <ul className="list compact">
              {data.notes.map((n) => (
                <li key={n.id} className="row">
                  <Link to={`/note?id=${n.id}`} className="grow ellipsis">
                    {n.pinned ? '📌 ' : ''}
                    {n.title || n.content.slice(0, 60) || '(vuota)'}
                  </Link>
                  <span className="badge">{n.type}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
