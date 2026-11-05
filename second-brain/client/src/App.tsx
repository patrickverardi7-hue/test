import { useEffect, useRef, useState, type FormEvent } from 'react';
import { act, api, getToken, onUnauthorized, setToken, toast, useFetch, useToasts } from './api';
import { Modal } from './components/ui';
import { navigate, useRoute } from './router';
import type { Reminder, Settings as SettingsT } from './types';
import { addDays, nowLocal, parseItem, setCurrency, today } from './utils';
import Dashboard from './pages/Dashboard';
import Tasks from './pages/Tasks';
import Agenda from './pages/Agenda';
import Reminders from './pages/Reminders';
import Goals from './pages/Goals';
import Notes from './pages/Notes';
import Finance from './pages/Finance';
import Nutrition from './pages/Nutrition';
import Workouts from './pages/Workouts';
import Social from './pages/Social';
import News from './pages/News';
import Assistant from './pages/Assistant';
import Settings from './pages/Settings';
import Search from './pages/Search';
import Grocery from './pages/Grocery';

const NAV = [
  { path: '/', label: 'Oggi', icon: '🏠', page: Dashboard },
  { path: '/task', label: 'Task', icon: '☑️', page: Tasks },
  { path: '/agenda', label: 'Agenda & tempo', icon: '🗓️', page: Agenda },
  { path: '/promemoria', label: 'Promemoria', icon: '🔔', page: Reminders },
  { path: '/obiettivi', label: 'Obiettivi & abitudini', icon: '🎯', page: Goals },
  { path: '/note', label: 'Note & idee', icon: '💡', page: Notes },
  { path: '/finanze', label: 'Finanze', icon: '💶', page: Finance },
  { path: '/alimentazione', label: 'Alimentazione', icon: '🥗', page: Nutrition },
  { path: '/spesa', label: 'Spesa & dispensa', icon: '🛒', page: Grocery },
  { path: '/allenamenti', label: 'Allenamenti', icon: '🏋️', page: Workouts },
  { path: '/social', label: 'Social & idee video', icon: '🎬', page: Social },
  { path: '/notizie', label: 'Notizie', icon: '📰', page: News },
  { path: '/assistente', label: 'Assistente AI', icon: '✨', page: Assistant },
  { path: '/impostazioni', label: 'Impostazioni', icon: '⚙️', page: Settings },
];

export default function App() {
  const [auth, setAuth] = useState<'checking' | 'ok' | 'login'>('checking');

  useEffect(() => {
    onUnauthorized(() => setAuth('login'));
    api
      .get<{ authRequired: boolean }>('/health')
      .then((h) => setAuth(h.authRequired && !getToken() ? 'login' : 'ok'))
      .catch(() => setAuth('ok'));
  }, []);

  if (auth === 'checking') return <div className="loading">🧠</div>;
  if (auth === 'login') return <Login onDone={() => setAuth('ok')} />;
  return <Shell />;
}

function Login({ onDone }: { onDone: () => void }) {
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setToken(pwd);
    try {
      await api.get('/settings');
      onDone();
    } catch {
      setToken('');
      setErr('Password errata');
    }
  };
  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <h1>🧠 Second Brain</h1>
        <label htmlFor="pwd">Password</label>
        <input id="pwd" type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} autoFocus />
        {err && <p className="text-red small">{err}</p>}
        <button className="btn primary" type="submit">
          Entra
        </button>
      </form>
    </div>
  );
}

function Shell() {
  const { path, params } = useRoute();
  const [menuOpen, setMenuOpen] = useState(false);
  const [capture, setCapture] = useState(false);
  const [search, setSearch] = useState(params.get('q') ?? '');
  const toasts = useToasts();
  const { data: settings } = useFetch<SettingsT>('/settings');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings) setCurrency(settings.currency);
  }, [settings]);

  useEffect(() => setMenuOpen(false), [path]);

  // #/?capture=1 apre la cattura rapida (usato dalla scorciatoia globale dell'app desktop)
  const captureParam = params.get('capture');
  useEffect(() => {
    if (!captureParam) return;
    setCapture(true);
    navigate(path);
  }, [captureParam]); // eslint-disable-line react-hooks/exhaustive-deps

  // scorciatoie: "/" cerca, "Alt+N" cattura rapida
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        setCapture(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useReminderNotifications();

  const current = NAV.find((n) => n.path === path);
  const Page = path === '/cerca' ? Search : (current?.page ?? Dashboard);

  return (
    <div className={`app ${menuOpen ? 'menu-open' : ''}`}>
      <aside className="sidebar">
        <div className="brand">🧠 Second Brain</div>
        <nav>
          {NAV.map((n) => (
            <a key={n.path} href={`#${n.path}`} className={`nav-item ${n.path === path ? 'active' : ''}`}>
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </a>
          ))}
        </nav>
        <div className="sidebar-foot muted tiny">Alt+N cattura · / cerca</div>
      </aside>
      <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />

      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            ☰
          </button>
          <form
            className="search"
            onSubmit={(e) => {
              e.preventDefault();
              if (search.trim()) navigate(`/cerca?q=${encodeURIComponent(search.trim())}`);
            }}
          >
            <input ref={searchRef} type="search" placeholder="Cerca in tutta la tua seconda mente…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Cerca" />
          </form>
          <button className="btn primary" onClick={() => setCapture(true)}>
            + Cattura
          </button>
        </header>
        <main className="content">
          <Page key={path} />
        </main>
      </div>

      {capture && <QuickCapture onClose={() => setCapture(false)} />}

      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tone}`}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

type CaptureType = 'inbox' | 'task' | 'idea' | 'video' | 'reminder' | 'expense' | 'event' | 'workout' | 'shopping';

const PLACEHOLDER: Record<CaptureType, string> = {
  inbox: 'Cosa ti passa per la testa?',
  task: 'Cosa devi fare?',
  idea: "Descrivi l'idea…",
  video: 'Titolo del video — hook (es. "3 errori in palestra — Il secondo lo fanno tutti")',
  reminder: 'Di cosa vuoi ricordarti?',
  event: 'Appuntamento o impegno',
  expense: 'Descrizione della spesa',
  workout: 'Es. Push, Corsa 5 km (aggiungi gli esercizi dalla pagina Allenamenti)',
  shopping: 'Es. 2 kg mele, latte, 6 uova',
};

function QuickCapture({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<CaptureType>('inbox');
  const [text, setText] = useState('');
  const [date, setDate] = useState(today());
  const [time, setTime] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Spesa');

  const TYPES: { value: CaptureType; label: string }[] = [
    { value: 'inbox', label: '📥 Inbox' },
    { value: 'task', label: '☑️ Task' },
    { value: 'idea', label: '💡 Idea' },
    { value: 'video', label: '🎬 Idea video' },
    { value: 'reminder', label: '🔔 Promemoria' },
    { value: 'event', label: '🗓️ Evento' },
    { value: 'expense', label: '💶 Uscita' },
    { value: 'workout', label: '🏋️ Allenamento' },
    { value: 'shopping', label: '🛒 Lista spesa' },
  ];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    const ops: Record<CaptureType, () => Promise<unknown>> = {
      inbox: () => api.post('/notes', { type: 'inbox', title: t.slice(0, 80), content: t.length > 80 ? t : '' }),
      idea: () => api.post('/notes', { type: 'idea', title: t.slice(0, 80), content: t.length > 80 ? t : '' }),
      task: () => api.post('/tasks', { title: t, due_date: date || null }),
      reminder: () => api.post('/reminders', { title: t, remind_at: `${date}T${time || '09:00'}`, repeat: 'none' }),
      event: () => api.post('/events', { title: t, date, start_time: time || null }),
      expense: () => api.post('/transactions', { type: 'expense', amount: Number(amount), description: t, category, date }),
      video: () => {
        const [title, ...hook] = t.split(/\s+[—–-]\s+|\n/);
        return api.post('/social_posts', { title: title.slice(0, 140), hook: hook.join(' ').trim() || null, status: 'idea', format: 'reel', source: 'cattura' });
      },
      workout: () => api.post('/workouts', { title: t, date, duration_min: amount ? Number(amount) : null, type: 'forza', exercises: [] }),
      shopping: async () => {
        await api.post('/shopping/add', { items: t.split(/[,;\n]/).map((x) => x.trim()).filter(Boolean).map(parseItem) });
        return true;
      },
    };
    const r = await act(ops[type], 'Catturato ✓');
    if (r !== undefined) onClose();
  };

  const needsDate = type === 'task' || type === 'reminder' || type === 'event' || type === 'expense' || type === 'workout';
  const needsTime = type === 'reminder' || type === 'event';

  return (
    <Modal title="Cattura rapida" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <div className="pills">
          {TYPES.map((t) => (
            <button type="button" key={t.value} className={`pill ${type === t.value ? 'active' : ''}`} onClick={() => setType(t.value)}>
              {t.label}
            </button>
          ))}
        </div>
        <textarea
          autoFocus
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={PLACEHOLDER[type]}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e);
          }}
        />
        {needsDate && (
          <div className="form-grid">
            {needsDate && (
              <div className="field half">
                <label htmlFor="cap-date">Data</label>
                <div className="row-gap">
                  <input id="cap-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  {type === 'task' && (
                    <button type="button" className="btn small ghost" onClick={() => setDate(addDays(today(), 1))}>
                      Domani
                    </button>
                  )}
                </div>
              </div>
            )}
            {needsTime && (
              <div className="field half">
                <label htmlFor="cap-time">Ora</label>
                <input id="cap-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required={type === 'reminder'} />
              </div>
            )}
            {type === 'workout' && (
              <div className="field half">
                <label htmlFor="cap-dur">Durata (min)</label>
                <input id="cap-dur" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
            )}
            {type === 'expense' && (
              <>
                <div className="field half">
                  <label htmlFor="cap-amount">Importo</label>
                  <input id="cap-amount" type="number" step="0.01" min="0" required value={amount} onChange={(e) => setAmount(e.target.value)} />
                </div>
                <div className="field half">
                  <label htmlFor="cap-cat">Categoria</label>
                  <input id="cap-cat" value={category} onChange={(e) => setCategory(e.target.value)} />
                </div>
              </>
            )}
          </div>
        )}
        <div className="form-actions">
          <span className="muted tiny">Ctrl+Invio per salvare</span>
          <span className="spacer" />
          <button className="btn primary" type="submit">
            Salva
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Controlla i promemoria ogni 30 secondi e mostra notifiche del browser + toast */
function useReminderNotifications() {
  const notified = useRef(new Set<string>());
  useEffect(() => {
    const check = async () => {
      try {
        const list = await api.get<Reminder[]>(`/reminders?done=false&to=${today()}`);
        const now = nowLocal();
        for (const r of list) {
          const key = `${r.id}@${r.remind_at}`;
          if (r.remind_at > now || notified.current.has(key)) continue;
          notified.current.add(key);
          // non notificare i promemoria scaduti da più di un'ora (es. all'apertura dell'app)
          if (Date.now() - new Date(r.remind_at).getTime() > 60 * 60 * 1000) continue;
          toast(`🔔 ${r.title}`, 'info');
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('🔔 Promemoria', { body: r.title, tag: key });
          }
        }
      } catch {
        /* offline o non autenticato: riprova al prossimo giro */
      }
    };
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, []);
}
