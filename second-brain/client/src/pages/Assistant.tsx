import { useEffect, useRef, useState } from 'react';
import { act, api, askAI, useFetch, type ChatMessage } from '../api';
import { Empty, Markdown, PageHeader } from '../components/ui';
import { parseListItems, today } from '../utils';

const STORAGE_KEY = 'sb_chat';

const QUICK_PROMPTS = [
  { label: '🗓️ Pianifica la mia giornata', text: 'Pianifica la mia giornata di oggi con fasce orarie, tenendo conto di agenda, task, priorità, allenamento e pasti.' },
  { label: '🔍 Revisione settimanale', text: 'Fammi una revisione settimanale: cosa sta andando bene, cosa no, a che punto sono gli obiettivi e le abitudini, e 3 priorità per la prossima settimana.' },
  { label: '💡 Idee per i social', text: 'Proponimi 7 idee di contenuti social per questa settimana, coerenti con la mia nicchia e con quello che ho già pubblicato.' },
  { label: '💶 Analizza le mie spese', text: 'Analizza le mie finanze di questo mese: dove sto spendendo di più, come vanno i budget e 3 azioni concrete per risparmiare.' },
  { label: '🏋️ Allenamento di oggi', text: 'Suggeriscimi un allenamento per oggi in base a quello che ho fatto negli ultimi giorni e al mio obiettivo settimanale.' },
  { label: '🥗 Cosa mangio stasera?', text: 'In base a quello che ho mangiato oggi e ai miei obiettivi di macronutrienti, cosa potrei mangiare per i pasti rimanenti?' },
  { label: '🧠 Brainstorming', text: 'Facciamo brainstorming. Ho un\'idea: ' },
  { label: '🎯 Scomponi un obiettivo', text: 'Aiutami a scomporre questo obiettivo in tappe e task concreti: ' },
];

function loadHistory(): ChatMessage[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export default function Assistant() {
  const { data: status } = useFetch<{ enabled: boolean; model: string }>('/ai/status');
  const [messages, setMessages] = useState<ChatMessage[]>(loadHistory);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-60)));
    } catch {
      /* storage non disponibile */
    }
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text = input) => {
    const content = text.trim();
    if (!content || busy) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(next);
    setInput('');
    setError('');
    setBusy(true);
    try {
      const reply = await askAI(next);
      setMessages([...next, { role: 'assistant', content: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const usePrompt = (text: string) => {
    if (text.endsWith(': ')) {
      setInput(text);
      inputRef.current?.focus();
    } else send(text);
  };

  const saveAsNote = (content: string) => {
    const question = [...messages].reverse().find((m) => m.role === 'user')?.content ?? 'Assistente';
    act(() => api.post('/notes', { title: question.slice(0, 70), content, type: 'nota', tags: 'assistente' }), 'Salvata nelle note');
  };

  const saveAsVideoIdeas = (content: string) => {
    const items = parseListItems(content).slice(0, 20);
    if (!items.length) return;
    act(async () => {
      for (const it of items) await api.post('/social_posts', { title: it.title.slice(0, 140), hook: it.detail || null, status: 'idea', format: 'reel', source: 'AI' });
    }, `${items.length} idee video salvate nella banca idee 🎬`);
  };

  const saveAsTasks = (content: string) => {
    const items = parseListItems(content).slice(0, 15);
    if (!items.length) return;
    act(async () => {
      for (const it of items) await api.post('/tasks', { title: it.title.replace(/^\d{1,2}[:.]\d{2}\s*[–-]?\s*(\d{1,2}[:.]\d{2})?\s*/, '').slice(0, 140), notes: it.detail, due_date: today() });
    }, `${items.length} task creati per oggi`);
  };

  return (
    <div className="page assistant-page">
      <PageHeader
        title="Assistente"
        subtitle="La tua seconda mente: conosce task, agenda, obiettivi, finanze, note e allenamenti."
        actions={
          messages.length > 0 && (
            <button className="btn ghost" onClick={() => confirm('Cancellare la conversazione?') && setMessages([])}>
              🗑 Nuova chat
            </button>
          )
        }
      />
      {status && !status.enabled && (
        <div className="notice">
          L'assistente AI non è attivo. Aggiungi la tua chiave in <code>server/.env</code> → <code>ANTHROPIC_API_KEY=…</code> e riavvia il server.
        </div>
      )}

      <div className="chat">
        {messages.length === 0 && (
          <Empty>
            Chiedimi qualsiasi cosa sulla tua vita organizzata qui dentro.
            <div className="quick-prompts">
              {QUICK_PROMPTS.map((p) => (
                <button key={p.label} className="pill" onClick={() => usePrompt(p.text)}>
                  {p.label}
                </button>
              ))}
            </div>
          </Empty>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`msg msg-${m.role}`}>
            {m.role === 'assistant' ? <Markdown text={m.content} /> : <p>{m.content}</p>}
            {m.role === 'assistant' && (
              <div className="msg-actions">
                <button className="btn small ghost" onClick={() => saveAsNote(m.content)}>
                  📝 Salva come nota
                </button>
                {parseListItems(m.content).length > 0 && (
                  <>
                    <button className="btn small ghost" onClick={() => saveAsTasks(m.content)}>
                      ☑ Trasforma l'elenco in task
                    </button>
                    <button className="btn small ghost" onClick={() => saveAsVideoIdeas(m.content)}>
                      🎬 Salva come idee video
                    </button>
                  </>
                )}
                <button className="btn small ghost" onClick={() => navigator.clipboard?.writeText(m.content)}>
                  ⧉ Copia
                </button>
              </div>
            )}
          </div>
        ))}
        {busy && <div className="msg msg-assistant typing">Sto pensando…</div>}
        {error && <div className="notice">{error}</div>}
        <div ref={endRef} />
      </div>

      {messages.length > 0 && (
        <div className="quick-prompts inline">
          {QUICK_PROMPTS.slice(0, 5).map((p) => (
            <button key={p.label} className="pill small" onClick={() => usePrompt(p.text)} disabled={busy}>
              {p.label}
            </button>
          ))}
        </div>
      )}
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          rows={2}
          placeholder="Scrivi un messaggio… (Invio per inviare, Maiusc+Invio per andare a capo)"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button className="btn primary" type="submit" disabled={busy || !input.trim()}>
          Invia
        </button>
      </form>
    </div>
  );
}
