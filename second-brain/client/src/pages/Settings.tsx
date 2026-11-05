import { useRef, useState } from 'react';
import { act, api, errorToast, getToken, notifyChange, setToken, toast, useFetch, useResource } from '../api';
import { Card, EntityForm, Empty, Modal, PageHeader } from '../components/ui';
import type { Feed, Settings as SettingsT } from '../types';
import { today } from '../utils';

export default function Settings() {
  const { data: settings } = useFetch<SettingsT>('/settings');
  const feeds = useResource<Feed>('feeds');
  const [editingFeed, setEditingFeed] = useState<Partial<Feed> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportData = async () => {
    try {
      const res = await fetch('/api/export', { headers: getToken() ? { Authorization: `Bearer ${getToken()}` } : {} });
      if (!res.ok) throw new Error('Esportazione non riuscita');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `second-brain-${today()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      errorToast(e);
    }
  };

  const importData = async (file: File) => {
    if (!confirm('Il ripristino SOSTITUISCE tutti i dati attuali con quelli del backup. Continuare?')) return;
    try {
      const json = JSON.parse(await file.text());
      const r = await api.post<{ counts: Record<string, number> }>('/import', json);
      notifyChange();
      toast(`Backup ripristinato (${Object.values(r.counts).reduce((a, b) => a + b, 0)} elementi)`);
    } catch (e) {
      errorToast(e);
    }
  };

  return (
    <div className="page">
      <PageHeader title="Impostazioni" />
      <div className="grid">
        <ClaudeConnection />
        <Card title="Profilo e obiettivi" className="span-2">
          {settings && (
            <EntityForm
              key={JSON.stringify(settings)}
              fields={[
                { name: 'name', label: 'Il tuo nome', half: true },
                { name: 'currency', label: 'Valuta (codice ISO)', half: true, suggestions: ['EUR', 'USD', 'GBP', 'CHF'] },
                { name: 'calorie_target', label: 'Obiettivo calorie (kcal/giorno)', type: 'number', min: 0, half: true },
                { name: 'protein_target', label: 'Proteine (g/giorno)', type: 'number', min: 0, half: true },
                { name: 'carbs_target', label: 'Carboidrati (g/giorno)', type: 'number', min: 0, half: true },
                { name: 'fat_target', label: 'Grassi (g/giorno)', type: 'number', min: 0, half: true },
                { name: 'workouts_per_week', label: 'Allenamenti a settimana', type: 'number', min: 0, half: true },
                { name: 'social_niche', label: 'La tua nicchia social', half: true, placeholder: 'Es. finanza personale per giovani' },
              ]}
              initial={settings}
              onSubmit={(v) => act(() => api.put('/settings', v), 'Impostazioni salvate')}
            />
          )}
        </Card>

        <Card
          title="Fonti di notizie (RSS)"
          className="span-2"
          action={
            <button className="btn small" onClick={() => setEditingFeed({ enabled: true, category: 'Generale' })}>
              + Feed
            </button>
          }
        >
          {feeds.items.length === 0 && <Empty>Nessun feed configurato.</Empty>}
          <ul className="list">
            {feeds.items.map((f) => (
              <li key={f.id} className="row">
                <input type="checkbox" checked={f.enabled} aria-label={`Attiva ${f.name}`} onChange={(e) => feeds.update(f.id, { enabled: e.target.checked })} />
                <button className="link grow ellipsis" onClick={() => setEditingFeed(f)}>
                  <b>{f.name}</b> <span className="muted small">{f.url}</span>
                </button>
                <span className="badge">{f.category}</span>
              </li>
            ))}
          </ul>
          <p className="muted small">Quasi tutti i siti e blog offrono un feed RSS (spesso all'indirizzo /feed o /rss). Funzionano anche i canali YouTube e le newsletter Substack.</p>
        </Card>

        <Card title="Backup dei dati">
          <p className="muted small">Tutti i dati sono salvati in locale in un database SQLite. Esporta un backup regolarmente.</p>
          <div className="row-gap">
            <button className="btn" onClick={exportData}>
              ⬇ Esporta JSON
            </button>
            <button className="btn ghost" onClick={() => fileRef.current?.click()}>
              ⬆ Ripristina…
            </button>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])} />
          </div>
        </Card>

        {getToken() && (
          <Card title="Sessione">
            <button
              className="btn ghost"
              onClick={() => {
                setToken('');
                location.reload();
              }}
            >
              Esci
            </button>
          </Card>
        )}
      </div>

      {editingFeed && (
        <Modal title={editingFeed.id ? 'Modifica feed' : 'Nuovo feed'} onClose={() => setEditingFeed(null)}>
          <EntityForm
            fields={[
              { name: 'name', label: 'Nome', required: true, half: true },
              { name: 'category', label: 'Categoria', half: true, suggestions: [...new Set(feeds.items.map((f) => f.category))] },
              { name: 'url', label: 'URL del feed RSS/Atom', required: true, placeholder: 'https://…/feed' },
              { name: 'enabled', label: 'Attivo', type: 'checkbox' },
            ]}
            initial={editingFeed}
            onCancel={() => setEditingFeed(null)}
            onDelete={editingFeed.id ? () => feeds.remove(editingFeed.id!).then(() => setEditingFeed(null)) : undefined}
            onSubmit={async (v) => {
              const r = editingFeed.id ? await feeds.update(editingFeed.id, v) : await feeds.create(v);
              if (r) setEditingFeed(null);
            }}
          />
        </Modal>
      )}
    </div>
  );
}

interface Integration {
  apiUrl: string;
  dataDir: string;
  dbPath: string;
  mcpPath: string;
  mcpBuilt: boolean;
  passwordProtected: boolean;
  desktop: boolean;
}

/** Istruzioni per collegare Claude Desktop / Claude Code tramite il server MCP */
function ClaudeConnection() {
  const { data } = useFetch<Integration>('/integration');
  if (!data) return null;
  const env = data.passwordProtected ? { SECOND_BRAIN_PASSWORD: 'la-tua-password' } : undefined;
  const desktopConfig = JSON.stringify({ mcpServers: { 'second-brain': { command: 'node', args: [data.mcpPath], ...(env ? { env } : {}) } } }, null, 2);
  const codeCmd = `claude mcp add second-brain --scope user -- node "${data.mcpPath}"`;
  const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => toast('Copiato'));

  return (
    <Card title="🤖 Collega Claude (MCP)" className="span-all">
      <p className="small">
        Con il server MCP puoi parlare con Second Brain da <b>Claude Desktop</b> o <b>Claude Code</b>: “ho speso 23€ al supermercato”, “aggiungi il task chiamare
        Marco domani”, “ho fatto panca 4×8 a 75 kg”, “salva queste 5 idee video”, “come sto andando con lo squat?”. Second Brain deve essere aperto
        (app desktop o <code>npm run dev</code>).
      </p>
      {!data.mcpBuilt && (
        <p className="notice small">
          Il server MCP non è ancora compilato: nella cartella <code>second-brain</code> esegui <code>npm run build</code>.
        </p>
      )}
      <div className="grid">
        <div>
          <div className="subhead">Claude Desktop</div>
          <p className="muted small">
            Impostazioni → Sviluppatore → Modifica configurazione (file <code>claude_desktop_config.json</code>), incolla e riavvia Claude:
          </p>
          <pre className="code">{desktopConfig}</pre>
          <button className="btn small" onClick={() => copy(desktopConfig)}>
            ⧉ Copia configurazione
          </button>
        </div>
        <div>
          <div className="subhead">Claude Code</div>
          <p className="muted small">Esegui una volta nel terminale:</p>
          <pre className="code">{codeCmd}</pre>
          <button className="btn small" onClick={() => copy(codeCmd)}>
            ⧉ Copia comando
          </button>
          <div className="subhead">Altri strumenti</div>
          <p className="muted small">
            API REST: <code>{data.apiUrl}</code>
            <br />
            Dati: <code>{data.dbPath}</code>
          </p>
        </div>
      </div>
    </Card>
  );
}
