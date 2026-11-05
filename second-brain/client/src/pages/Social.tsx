import { useState } from 'react';
import { askAI, errorToast, useFetch, useResource } from '../api';
import { Card, EntityForm, Markdown, Modal, PageHeader } from '../components/ui';
import { postFields } from '../forms';
import type { Settings, SocialPost } from '../types';
import { cap, fmtDayLabel, fmtNum, parseListItems, PLATFORMS, POST_STATUSES } from '../utils';

const STATUS_ICON: Record<string, string> = { idea: '💡', bozza: '✍️', pronto: '🎬', programmato: '📅', pubblicato: '✅' };

export default function Social() {
  const posts = useResource<SocialPost>('social_posts');
  const { data: settings } = useFetch<Settings>('/settings');
  const [platform, setPlatform] = useState('');
  const [editing, setEditing] = useState<Partial<SocialPost> | null>(null);
  const [ideasOpen, setIdeasOpen] = useState(false);

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
        title="Social & contenuti"
        subtitle={
          <>
            Dall'idea alla pubblicazione. {published.length} pubblicati · {fmtNum(totalViews)} visualizzazioni totali
          </>
        }
        actions={
          <>
            <button className="btn" onClick={() => setIdeasOpen(true)}>
              ✨ Genera idee
            </button>
            <button className="btn primary" onClick={() => setEditing({ status: 'idea', platform: platform || 'instagram' })}>
              + Contenuto
            </button>
          </>
        }
      />
      <div className="toolbar">
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

      <div className="kanban">
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
      </div>

      {editing && (
        <Modal title={editing.id ? 'Modifica contenuto' : 'Nuovo contenuto'} onClose={() => setEditing(null)} wide>
          <EntityForm
            fields={postFields}
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
                  await onAdd({ title: idea.title, hook: idea.detail, platform, status: 'idea' });
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
