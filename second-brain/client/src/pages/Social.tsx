import { useState } from 'react';
import { askAI, errorToast, useFetch, useResource } from '../api';
import { Card, EntityForm, Empty, Markdown, Modal, PageHeader, Tabs } from '../components/ui';
import { postFields } from '../forms';
import type { Settings, SocialPost } from '../types';
import { cap, fmtDayLabel, fmtNum, parseListItems, PLATFORMS, POST_STATUSES, VIDEO_FORMATS } from '../utils';

const STATUS_ICON: Record<string, string> = { idea: '💡', bozza: '✍️', pronto: '🎬', programmato: '📅', pubblicato: '✅' };

export default function Social() {
  const posts = useResource<SocialPost>('social_posts');
  const { data: settings } = useFetch<Settings>('/settings');
  const [platform, setPlatform] = useState('');
  const [editing, setEditing] = useState<Partial<SocialPost> | null>(null);
  const [ideasOpen, setIdeasOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [view, setView] = useState<'banca' | 'bacheca'>('banca');
  const pillars = [...new Set(posts.items.map((p) => p.pillar).filter(Boolean) as string[])];

  const visible = posts.items.filter((p) => !platform || p.platform === platform);
  const published = posts.items.filter((p) => p.status === 'pubblicato');
  const totalViews = published.reduce((s, p) => s + (p.views ?? 0), 0);

  const move = (p: SocialPost, dir: 1 | -1) => {
    const i = POST_STATUSES.indexOf(p.status) + dir;
    if (i >= 0 && i < POST_STATUSES.length) posts.update(p.id, { status: POST_STATUSES[i] });
  };

  return (
    <div className="page">
      <PageHeader
        title="Idee video & social"
        subtitle={
          <>
            La tua banca di idee video, dalla prima intuizione alla pubblicazione. {published.length} pubblicati · {fmtNum(totalViews)} visualizzazioni totali
          </>
        }
        actions={
          <>
            <button className="btn" onClick={() => setImportOpen(true)}>
              ⬆ Importa elenco
            </button>
            <button className="btn" onClick={() => setIdeasOpen(true)}>
              ✨ Genera idee
            </button>
            <button className="btn primary" onClick={() => setEditing({ status: 'idea', platform: platform || 'instagram', format: 'reel', source: 'app' })}>
              + Idea video
            </button>
          </>
        }
      />
      <div className="toolbar">
        <Tabs
          value={view}
          onChange={setView}
          options={[
            { value: 'banca', label: '🎬 Banca idee' },
            { value: 'bacheca', label: '🗂️ Produzione' },
          ]}
        />
        <div className="pills">
          <button className={`pill ${!platform ? 'active' : ''}`} onClick={() => setPlatform('')}>
            Tutte
          </button>
          {PLATFORMS.map((p) => (
            <button key={p} className={`pill ${platform === p ? 'active' : ''}`} onClick={() => setPlatform(p)}>
              {cap(p)}
            </button>
          ))}
        </div>
      </div>

      {view === 'banca' && <IdeaBank posts={visible} onOpen={setEditing} onScore={(p, score) => posts.update(p.id, { score })} onStatus={(p, status) => posts.update(p.id, { status })} />}

      {view === 'bacheca' && <div className="kanban">
        {POST_STATUSES.map((status) => {
          const col = visible.filter((p) => p.status === status);
          return (
            <div key={status} className="kanban-col">
              <div className="kanban-head">
                {STATUS_ICON[status]} {cap(status)} <span className="muted">{col.length}</span>
              </div>
              {col.map((p) => (
                <div key={p.id} className="kanban-card" onClick={() => setEditing(p)}>
                  <div className="kanban-card-top">
                    <span className={`badge platform-${p.platform}`}>{p.platform}</span>
                    {p.publish_date && <span className="muted small">{fmtDayLabel(p.publish_date)}</span>}
                  </div>
                  <div className="kanban-title">{p.title}</div>
                  {p.hook && <div className="muted small ellipsis-2">“{p.hook}”</div>}
                  {status === 'pubblicato' && (p.views || p.likes) ? (
                    <div className="muted small">
                      👁 {fmtNum(p.views)} · ❤️ {fmtNum(p.likes)}
                    </div>
                  ) : null}
                  <div className="kanban-actions" onClick={(e) => e.stopPropagation()}>
                    <button className="icon-btn" disabled={status === POST_STATUSES[0]} onClick={() => move(p, -1)} aria-label="Sposta indietro">
                      ‹
                    </button>
                    <button className="icon-btn" disabled={status === 'pubblicato'} onClick={() => move(p, 1)} aria-label="Sposta avanti">
                      ›
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>}

      {editing && (
        <Modal title={editing.id ? 'Modifica contenuto' : 'Nuovo contenuto'} onClose={() => setEditing(null)} wide>
          <EntityForm
            fields={postFields(pillars)}
            initial={editing}
            onCancel={() => setEditing(null)}
            onDelete={editing.id ? () => posts.remove(editing.id!).then(() => setEditing(null)) : undefined}
            onSubmit={async (v) => {
              const r = editing.id ? await posts.update(editing.id, v) : await posts.create(v);
              if (r) setEditing(null);
            }}
          />
        </Modal>
      )}
      {importOpen && <ImportIdeas onClose={() => setImportOpen(false)} onAdd={(p) => posts.create(p)} platform={platform || 'instagram'} />}
      {ideasOpen && <IdeaGenerator niche={settings?.social_niche ?? ''} onClose={() => setIdeasOpen(false)} onAdd={(p) => posts.create(p)} recent={posts.items} />}
    </div>
  );
}

function IdeaGenerator({
  niche,
  onClose,
  onAdd,
  recent,
}: {
  niche: string;
  onClose: () => void;
  onAdd: (p: Partial<SocialPost>) => Promise<unknown>;
  recent: SocialPost[];
}) {
  const [topic, setTopic] = useState(niche);
  const [platform, setPlatform] = useState('instagram');
  const [format, setFormat] = useState('video brevi (Reel/TikTok/Shorts)');
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState('');
  const [added, setAdded] = useState<Set<string>>(new Set());

  const generate = async () => {
    setBusy(true);
    try {
      const existing = recent.slice(0, 30).map((p) => `- ${p.title}`).join('\n');
      const text = await askAI([
        {
          role: 'user',
          content: `Generami 10 idee di contenuti per ${platform} in formato ${format} sul tema/nicchia: "${topic || 'la mia nicchia (vedi impostazioni)'}".
Per ognuna scrivi una riga nel formato "N. Titolo — hook di apertura (le prime parole che catturano l'attenzione)".
Varia i formati (tutorial, storytelling, opinione controcorrente, errori comuni, dietro le quinte, trend). Evita idee già presenti in questa lista:
${existing || '(nessuna)'}
Alla fine aggiungi 3 consigli brevi per far crescere l'account in questa nicchia.`,
        },
      ]);
      setReply(text);
    } catch (e) {
      errorToast(e);
    } finally {
      setBusy(false);
    }
  };

  const ideas = parseListItems(reply).slice(0, 10);

  return (
    <Modal title="✨ Generatore di idee" onClose={onClose} wide>
      <div className="form">
        <div className="form-grid">
          <div className="field">
            <label htmlFor="ig-topic">Tema / nicchia</label>
            <input id="ig-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Es. fitness per chi lavora in ufficio" />
          </div>
          <div className="field half">
            <label htmlFor="ig-platform">Piattaforma</label>
            <select id="ig-platform" value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {cap(p)}
                </option>
              ))}
            </select>
          </div>
          <div className="field half">
            <label htmlFor="ig-format">Formato</label>
            <select id="ig-format" value={format} onChange={(e) => setFormat(e.target.value)}>
              <option>video brevi (Reel/TikTok/Shorts)</option>
              <option>caroselli</option>
              <option>video lunghi</option>
              <option>post testuali</option>
            </select>
          </div>
        </div>
        <div className="form-actions">
          <span className="spacer" />
          <button className="btn primary" onClick={generate} disabled={busy}>
            {busy ? 'Sto generando…' : reply ? 'Rigenera' : 'Genera idee'}
          </button>
        </div>
      </div>
      {ideas.length > 0 && (
        <ul className="list idea-list">
          {ideas.map((idea) => (
            <li key={idea.title} className="row">
              <div className="grow">
                <strong>{idea.title}</strong>
                {idea.detail && <div className="muted small">{idea.detail}</div>}
              </div>
              <button
                className="btn small"
                disabled={added.has(idea.title)}
                onClick={async () => {
                  await onAdd({ title: idea.title, hook: idea.detail, platform, status: 'idea', format: format.startsWith('video brevi') ? 'reel' : format.startsWith('video lunghi') ? 'video lungo' : format.startsWith('caroselli') ? 'carosello' : 'post', source: 'AI' });
                  setAdded(new Set(added).add(idea.title));
                }}
              >
                {added.has(idea.title) ? '✓ Aggiunta' : '+ Aggiungi'}
              </button>
            </li>
          ))}
        </ul>
      )}
      {reply && (
        <details className="ai-raw">
          <summary>Risposta completa</summary>
          <Card>
            <Markdown text={reply} />
          </Card>
        </details>
      )}
    </Modal>
  );
}

const STATUS_LABEL: Record<string, string> = { idea: '💡 Idea', bozza: '✍️ Bozza', pronto: '🎬 Pronto', programmato: '📅 Programmato', pubblicato: '✅ Pubblicato' };

/** Elenco di tutte le idee video ordinate per potenziale, con filtri */
function IdeaBank({
  posts,
  onOpen,
  onScore,
  onStatus,
}: {
  posts: SocialPost[];
  onOpen: (p: SocialPost) => void;
  onScore: (p: SocialPost, score: number) => void;
  onStatus: (p: SocialPost, status: string) => void;
}) {
  const [q, setQ] = useState('');
  const [format, setFormat] = useState('');
  const [pillar, setPillar] = useState('');
  const [showAll, setShowAll] = useState(false);
  const pillars = [...new Set(posts.map((p) => p.pillar).filter(Boolean) as string[])].sort();
  const list = posts
    .filter((p) => showAll || p.status === 'idea' || p.status === 'bozza')
    .filter((p) => !format || p.format === format)
    .filter((p) => !pillar || p.pillar === pillar)
    .filter((p) => !q || `${p.title} ${p.hook ?? ''} ${p.caption ?? ''} ${p.notes ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0) || b.id - a.id);

  return (
    <>
      <div className="toolbar">
        <input type="search" placeholder="Cerca tra le idee…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={format} onChange={(e) => setFormat(e.target.value)} aria-label="Formato">
          <option value="">Tutti i formati</option>
          {VIDEO_FORMATS.map((f) => (
            <option key={f} value={f}>
              {cap(f)}
            </option>
          ))}
        </select>
        {pillars.length > 0 && (
          <select value={pillar} onChange={(e) => setPillar(e.target.value)} aria-label="Rubrica">
            <option value="">Tutte le rubriche</option>
            {pillars.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        )}
        <label className="check small">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Anche in produzione e pubblicati
        </label>
      </div>
      {list.length === 0 && <Empty>Nessuna idea. Aggiungile da qui, con “+ Cattura → Idea video”, importando un elenco o chiedendo a Claude.</Empty>}
      <ul className="list card-list idea-bank">
        {list.map((p) => (
          <li key={p.id} className="row">
            <div className="stars" aria-label={`Potenziale ${p.score ?? 0} su 5`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} className={`star ${n <= (p.score ?? 0) ? 'on' : ''}`} onClick={() => onScore(p, n === p.score ? 0 : n)} aria-label={`${n} stelle`}>
                  ★
                </button>
              ))}
            </div>
            <button className="link grow" onClick={() => onOpen(p)}>
              <b>{p.title}</b>
              {p.hook && <div className="muted small ellipsis">“{p.hook}”</div>}
            </button>
            {p.pillar && <span className="badge purple">{p.pillar}</span>}
            <span className="badge">{p.format ?? 'reel'}</span>
            <span className={`badge platform-${p.platform}`}>{p.platform}</span>
            <select className="status-select" value={p.status} onChange={(e) => onStatus(p, e.target.value)} aria-label="Stato">
              {POST_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Importa molte idee in un colpo: una per riga, "Titolo — hook" */
function ImportIdeas({ onClose, onAdd, platform: initialPlatform }: { onClose: () => void; onAdd: (p: Partial<SocialPost>) => Promise<unknown>; platform: string }) {
  const [text, setText] = useState('');
  const [platform, setPlatform] = useState(initialPlatform);
  const [format, setFormat] = useState('reel');
  const [pillar, setPillar] = useState('');
  const [busy, setBusy] = useState(false);
  const rows = text
    .split('\n')
    .map((l) => l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').replace(/\*\*/g, '').trim())
    .filter((l) => l.length > 2)
    .map((l) => {
      const [title, ...rest] = l.split(/\s+[—–-]\s+|\t|;/);
      return { title: title.trim(), hook: rest.join(' — ').trim() };
    });

  const run = async () => {
    setBusy(true);
    for (const r of rows) await onAdd({ ...r, platform, format, pillar: pillar || null, status: 'idea', source: 'import' });
    setBusy(false);
    onClose();
  };

  return (
    <Modal title="Importa idee video" onClose={onClose} wide>
      <div className="form">
        <p className="muted small">Incolla le tue idee da qualsiasi posto (note del telefono, Notion, Excel, chat): una per riga. Se scrivi “Titolo — hook” l'hook viene salvato a parte.</p>
        <textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} placeholder={'3 errori che ti fanno perdere tempo — Stai sprecando 2 ore al giorno\nLa mia routine del mattino\n…'} />
        <div className="form-grid">
          <div className="field half">
            <label htmlFor="imp-platform">Piattaforma</label>
            <select id="imp-platform" value={platform} onChange={(e) => setPlatform(e.target.value)}>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {cap(p)}
                </option>
              ))}
            </select>
          </div>
          <div className="field half">
            <label htmlFor="imp-format">Formato</label>
            <select id="imp-format" value={format} onChange={(e) => setFormat(e.target.value)}>
              {VIDEO_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {cap(f)}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="imp-pillar">Rubrica / tema (opzionale)</label>
            <input id="imp-pillar" value={pillar} onChange={(e) => setPillar(e.target.value)} />
          </div>
        </div>
        <div className="form-actions">
          <span className="muted small">{rows.length} idee riconosciute</span>
          <span className="spacer" />
          <button className="btn primary" disabled={!rows.length || busy} onClick={run}>
            {busy ? 'Importo…' : `Importa ${rows.length} idee`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
