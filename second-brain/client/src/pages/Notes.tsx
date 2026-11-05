import { useEffect, useMemo, useRef, useState } from 'react';
import { act, api, askAI, errorToast, notifyChange, toast, useResource } from '../api';
import { Empty, Markdown, PageHeader } from '../components/ui';
import { navigate, useRoute } from '../router';
import type { Note } from '../types';
import { cap, fmtDate, NOTE_TYPES, today } from '../utils';

const TYPE_ICON: Record<string, string> = { inbox: '📥', nota: '📝', idea: '💡', brainstorm: '🌪️', diario: '📔' };

export default function Notes() {
  const { params } = useRoute();
  const notes = useResource<Note>('notes');
  const [type, setType] = useState(params.get('type') ?? '');
  const [tag, setTag] = useState('');
  const [q, setQ] = useState('');
  const selectedId = Number(params.get('id')) || null;

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return notes.items.filter(
      (n) =>
        (!type || n.type === type) &&
        (!tag || splitTags(n.tags).includes(tag)) &&
        (!ql || `${n.title} ${n.content} ${n.tags}`.toLowerCase().includes(ql)),
    );
  }, [notes.items, type, tag, q]);

  const allTags = useMemo(() => [...new Set(notes.items.flatMap((n) => splitTags(n.tags)))].sort(), [notes.items]);
  const selected = notes.items.find((n) => n.id === selectedId) ?? null;

  const select = (id: number | null) => navigate(id ? `/note?id=${id}` : '/note');

  const newNote = async (init: Partial<Note> = {}) => {
    const n = await act(() => api.post<Note>('/notes', { type: type || 'nota', ...init }));
    if (n) select(n.id);
  };

  const openDiary = async () => {
    const title = `Diario ${fmtDate(today(), { day: 'numeric', month: 'long', year: 'numeric' })}`;
    const existing = notes.items.find((n) => n.type === 'diario' && n.title === title);
    if (existing) select(existing.id);
    else newNote({ type: 'diario', title, content: '## Com\'è andata oggi?\n\n\n## Gratitudine\n- \n\n## Cosa ho imparato\n- \n' });
  };

  const openByTitle = (title: string) => {
    const found = notes.items.find((n) => n.title.toLowerCase() === title.toLowerCase());
    if (found) select(found.id);
    else newNote({ title, type: 'nota' });
  };

  return (
    <div className="page">
      <PageHeader
        title="Note & idee"
        subtitle="Il tuo archivio di pensieri: appunti, idee, brainstorming e diario. Collega le note con [[Titolo]]."
        actions={
          <>
            <button className="btn" onClick={openDiary}>
              📔 Diario di oggi
            </button>
            <button className="btn primary" onClick={() => newNote()}>
              + Nuova nota
            </button>
          </>
        }
      />
      <div className={`notes-layout ${selected ? 'has-selection' : ''}`}>
        <aside className="notes-list card">
          <input type="search" placeholder="Cerca nelle note…" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="pills">
            <button className={`pill ${!type ? 'active' : ''}`} onClick={() => setType('')}>
              Tutte
            </button>
            {NOTE_TYPES.map((t) => (
              <button key={t} className={`pill ${type === t ? 'active' : ''}`} onClick={() => setType(type === t ? '' : t)}>
                {TYPE_ICON[t]} {cap(t)}
              </button>
            ))}
          </div>
          {allTags.length > 0 && (
            <div className="pills tags">
              {allTags.map((t) => (
                <button key={t} className={`pill small ${tag === t ? 'active' : ''}`} onClick={() => setTag(tag === t ? '' : t)}>
                  #{t}
                </button>
              ))}
            </div>
          )}
          {filtered.length === 0 && <Empty>{notes.loading ? 'Caricamento…' : 'Nessuna nota.'}</Empty>}
          <ul className="note-items">
            {filtered.map((n) => (
              <li key={n.id}>
                <button className={`note-item ${n.id === selectedId ? 'active' : ''}`} onClick={() => select(n.id)}>
                  <div className="note-item-title">
                    {n.pinned && '📌 '}
                    {TYPE_ICON[n.type] ?? '📝'} {n.title || 'Senza titolo'}
                  </div>
                  <div className="muted small ellipsis">{n.content.replace(/[#*>\-[\]]/g, '').slice(0, 90) || '…'}</div>
                  <div className="muted tiny">{new Date(n.updated_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</div>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        <section className="note-editor-wrap">
          {selected ? (
            <NoteEditor key={selected.id} note={selected} allNotes={notes.items} onClose={() => select(null)} onDelete={() => notes.remove(selected.id).then(() => select(null))} onWikiLink={openByTitle} />
          ) : (
            <div className="card">
              <Empty>
                Seleziona una nota o creane una nuova.
                <br />
                Suggerimento: usa “+ Cattura” in alto per salvare un'idea al volo nell'inbox, poi smistala qui.
              </Empty>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function splitTags(tags: string | null | undefined): string[] {
  return (tags ?? '')
    .split(',')
    .map((t) => t.trim().replace(/^#/, '').toLowerCase())
    .filter(Boolean);
}

function NoteEditor({
  note,
  allNotes,
  onClose,
  onDelete,
  onWikiLink,
}: {
  note: Note;
  allNotes: Note[];
  onClose: () => void;
  onDelete: () => void;
  onWikiLink: (title: string) => void;
}) {
  const [draft, setDraft] = useState(note);
  const [preview, setPreview] = useState(note.content.length > 0);
  const [saving, setSaving] = useState<'idle' | 'dirty' | 'saving' | 'saved'>('idle');
  const [aiBusy, setAiBusy] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const dirty = saving === 'dirty';
  const savingRef = useRef(saving);
  savingRef.current = saving;

  const save = async () => {
    const d = draftRef.current;
    setSaving('saving');
    try {
      await api.patch(`/notes/${note.id}`, { title: d.title, content: d.content, type: d.type, tags: d.tags, pinned: d.pinned });
      setSaving('saved');
      notifyChange();
    } catch (e) {
      setSaving('dirty');
      errorToast(e);
    }
  };

  // salvataggio automatico dopo una breve pausa di scrittura
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(save, 800);
    return () => clearTimeout(t);
  }, [draft, dirty]); // eslint-disable-line react-hooks/exhaustive-deps

  // salva le modifiche pendenti quando si cambia nota
  useEffect(
    () => () => {
      if (savingRef.current === 'dirty') {
        const d = draftRef.current;
        api.patch(`/notes/${note.id}`, { title: d.title, content: d.content, type: d.type, tags: d.tags, pinned: d.pinned }).then(notifyChange, errorToast);
      }
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const change = (patch: Partial<Note>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setSaving('dirty');
  };

  const backlinks = allNotes.filter((n) => n.id !== note.id && draft.title && n.content.toLowerCase().includes(`[[${draft.title.toLowerCase()}]]`));

  const brainstorm = async () => {
    setAiBusy(true);
    try {
      const reply = await askAI([
        {
          role: 'user',
          content: `Fai brainstorming su questa nota/idea. Espandila con angolazioni diverse, domande da approfondire, possibili prossimi passi concreti e rischi. Sii specifico.\n\nTitolo: ${draft.title}\n\n${draft.content}`,
        },
      ]);
      change({ content: `${draft.content}\n\n---\n## ✨ Brainstorming AI (${fmtDate(today())})\n${reply}\n` });
      setPreview(true);
      toast('Brainstorming aggiunto alla nota');
    } catch (e) {
      errorToast(e);
    } finally {
      setAiBusy(false);
    }
  };

  const toTask = async () => {
    await act(() => api.post('/tasks', { title: draft.title || draft.content.slice(0, 80), notes: draft.content.slice(0, 500), due_date: today() }), 'Task creato per oggi');
  };

  return (
    <div className="card note-editor">
      <div className="note-toolbar">
        <button className="btn ghost small mobile-only" onClick={onClose}>
          ‹ Note
        </button>
        <select value={draft.type} onChange={(e) => change({ type: e.target.value })} aria-label="Tipo di nota">
          {NOTE_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_ICON[t]} {cap(t)}
            </option>
          ))}
        </select>
        <input className="grow" value={draft.tags} onChange={(e) => change({ tags: e.target.value })} placeholder="tag, separati, da virgola" aria-label="Tag" />
        <button className={`icon-btn ${draft.pinned ? 'active' : ''}`} title="Fissa in alto" onClick={() => change({ pinned: !draft.pinned })}>
          📌
        </button>
        <button className="btn ghost small" onClick={() => setPreview(!preview)}>
          {preview ? '✎ Modifica' : '👁 Anteprima'}
        </button>
      </div>
      <input className="note-title" value={draft.title} onChange={(e) => change({ title: e.target.value })} placeholder="Titolo" aria-label="Titolo" />
      {preview ? (
        <div className="note-preview" onDoubleClick={() => setPreview(false)}>
          {draft.content ? <Markdown text={draft.content} onWikiLink={onWikiLink} /> : <p className="muted">Nota vuota — doppio clic per scrivere.</p>}
        </div>
      ) : (
        <textarea
          className="note-content"
          value={draft.content}
          onChange={(e) => change({ content: e.target.value })}
          placeholder={'Scrivi qui… (supporta # titoli, **grassetto**, - elenchi, - [ ] checklist, [[collegamenti]])'}
          autoFocus
        />
      )}
      {backlinks.length > 0 && (
        <div className="backlinks">
          <span className="muted small">Citata in:</span>{' '}
          {backlinks.map((b) => (
            <button key={b.id} className="pill small" onClick={() => navigate(`/note?id=${b.id}`)}>
              {b.title}
            </button>
          ))}
        </div>
      )}
      <div className="note-footer">
        <span className="muted small">{saving === 'saving' ? 'Salvataggio…' : saving === 'dirty' ? 'Modifiche non salvate' : saving === 'saved' ? 'Salvato ✓' : ''}</span>
        <span className="spacer" />
        <button className="btn small" onClick={toTask}>
          ☑ Crea task
        </button>
        <button className="btn small" onClick={brainstorm} disabled={aiBusy}>
          {aiBusy ? 'Sto pensando…' : '✨ Brainstorming AI'}
        </button>
        <button className="btn small danger ghost" onClick={() => confirm('Eliminare questa nota?') && onDelete()}>
          Elimina
        </button>
      </div>
    </div>
  );
}
