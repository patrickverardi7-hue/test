import { useFetch } from '../api';
import { Empty, PageHeader } from '../components/ui';
import { Link, useRoute } from '../router';
import { fmtDateTime } from '../utils';

interface Result {
  resource: string;
  id: number;
  title: string;
  snippet: string;
  date: string | null;
}

const META: Record<string, { label: string; icon: string; to: (id: number) => string }> = {
  notes: { label: 'Note', icon: '📝', to: (id) => `/note?id=${id}` },
  tasks: { label: 'Task', icon: '☑', to: () => '/task' },
  goals: { label: 'Obiettivi', icon: '🎯', to: () => '/obiettivi' },
  events: { label: 'Agenda', icon: '🗓️', to: () => '/agenda' },
  reminders: { label: 'Promemoria', icon: '🔔', to: () => '/promemoria' },
  social_posts: { label: 'Social', icon: '📱', to: () => '/social' },
  transactions: { label: 'Finanze', icon: '💶', to: () => '/finanze' },
  workouts: { label: 'Allenamenti', icon: '🏋️', to: () => '/allenamenti' },
  meals: { label: 'Alimentazione', icon: '🥗', to: () => '/alimentazione' },
};

export default function Search() {
  const { params } = useRoute();
  const q = params.get('q') ?? '';
  const { data = [], loading } = useFetch<Result[]>(q ? `/search?q=${encodeURIComponent(q)}` : null);
  const groups = Object.keys(META)
    .map((r) => ({ r, items: data.filter((d) => d.resource === r) }))
    .filter((g) => g.items.length);

  return (
    <div className="page">
      <PageHeader title={`Risultati per “${q}”`} subtitle={loading ? 'Cerco…' : `${data.length} risultati in tutta la tua seconda mente`} />
      {!loading && data.length === 0 && <Empty>Nessun risultato.</Empty>}
      {groups.map((g) => (
        <section key={g.r} className="task-group">
          <h3>
            {META[g.r].icon} {META[g.r].label}
          </h3>
          <ul className="list card-list">
            {g.items.map((it) => (
              <li key={it.id} className="row">
                <Link to={META[g.r].to(it.id)} className="grow">
                  <b>{it.title}</b>
                  {it.snippet && <div className="muted small ellipsis">{it.snippet}</div>}
                </Link>
                {it.date && <span className="muted small">{fmtDateTime(it.date)}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
