import { useState } from 'react';
import { act, api, useFetch } from '../api';
import { Empty, PageHeader } from '../components/ui';
import { Link } from '../router';

interface NewsItem {
  title: string;
  link: string;
  date: string | null;
  snippet: string;
  source: string;
  category: string;
}

function timeAgo(iso: string | null) {
  if (!iso) return '';
  const diff = (Date.now() - Date.parse(iso)) / 60000;
  if (diff < 60) return `${Math.max(1, Math.round(diff))} min fa`;
  if (diff < 1440) return `${Math.round(diff / 60)} h fa`;
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

export default function News() {
  const [category, setCategory] = useState('');
  const [refresh, setRefresh] = useState(0);
  const { data, loading, error } = useFetch<{ items: NewsItem[]; errors: { source: string; error: string }[]; categories: string[] }>(
    `/news?category=${encodeURIComponent(category)}${refresh ? `&refresh=1&r=${refresh}` : ''}`,
  );
  const [q, setQ] = useState('');

  const items = (data?.items ?? []).filter((i) => !q || `${i.title} ${i.snippet}`.toLowerCase().includes(q.toLowerCase()));

  const save = (i: NewsItem) =>
    act(() => api.post('/notes', { title: i.title, type: 'nota', tags: 'notizie', content: `Fonte: ${i.source}\n${i.link}\n\n> ${i.snippet}\n\n## Le mie riflessioni\n` }), 'Salvata nelle note');

  return (
    <div className="page">
      <PageHeader
        title="Notizie"
        subtitle={
          <>
            Le tue fonti RSS in un unico posto. Gestisci i feed nelle <Link to="/impostazioni">impostazioni</Link>.
          </>
        }
        actions={
          <button className="btn" onClick={() => setRefresh(Date.now())} disabled={loading}>
            {loading ? 'Aggiorno…' : '↻ Aggiorna'}
          </button>
        }
      />
      <div className="toolbar">
        <div className="pills">
          <button className={`pill ${!category ? 'active' : ''}`} onClick={() => (setCategory(''), setRefresh(0))}>
            Tutte
          </button>
          {data?.categories.map((c) => (
            <button key={c} className={`pill ${category === c ? 'active' : ''}`} onClick={() => (setCategory(c), setRefresh(0))}>
              {c}
            </button>
          ))}
        </div>
        <input type="search" placeholder="Filtra…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {error && <p className="notice">{error}</p>}
      {data?.errors.length ? <p className="notice small">Non raggiungibili: {data.errors.map((e) => e.source).join(', ')}</p> : null}
      {!loading && items.length === 0 && <Empty>Nessuna notizia. Aggiungi o attiva dei feed RSS nelle impostazioni.</Empty>}
      <ul className="news-list">
        {items.map((i) => (
          <li key={i.link + i.title} className="card news-item">
            <div className="muted small">
              <b>{i.source}</b> · {timeAgo(i.date)} · {i.category}
            </div>
            <a href={i.link} target="_blank" rel="noreferrer" className="news-title">
              {i.title}
            </a>
            {i.snippet && <p className="muted small">{i.snippet}</p>}
            <button className="btn small ghost" onClick={() => save(i)}>
              📝 Salva nelle note
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
