// Assistente AI ("seconda mente") basato su Claude.
// Riceve la conversazione dal client e aggiunge un'istantanea dei dati dell'utente
// (task, agenda, obiettivi, finanze, note...) così le risposte sono personalizzate.
import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { db, fromRow, getSettings, HttpError, type Row } from '../db.js';
import { RESOURCES } from '../resources.js';
import { addDays, isDate, todayLocal } from '../dates.js';
import { weekdayOf } from './grocery.js';
import { workoutProgress } from './progress.js';
import { financeSummary, habitsOverview, nutritionDay, workoutsWeek } from '../summary.js';

export const aiRouter = Router();

const MODEL = process.env.AI_MODEL || 'claude-opus-5-5';
export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client: Anthropic | null = null;
const getClient = () => (client ??= new Anthropic());

const SYSTEM_PROMPT = `Sei la "seconda mente" dell'utente: un assistente personale che lo aiuta a gestire tutta la sua vita — finanze, impegni, promemoria, obiettivi, abitudini, alimentazione, allenamenti, lavoro sui social, idee e pianificazione del tempo.

Come lavori:
- Rispondi sempre in italiano, in modo diretto e pratico. Usa elenchi e titoli brevi in Markdown quando aiutano la lettura.
- Basati sui dati reali dell'utente riportati nell'istantanea qui sotto. Se un dato manca, dillo e proponi come raccoglierlo nell'app.
- Quando pianifichi una giornata, rispetta gli eventi già fissati, metti prima le priorità alte e le scadenze passate, e indica fasce orarie concrete (es. 09:00–10:30).
- Quando generi idee (contenuti social, progetti, brainstorming), proponi opzioni numerate, ognuna con un titolo breve seguito da " — " e una riga di spiegazione o hook.
- Su salute, alimentazione e allenamento dai indicazioni generali di buon senso e suggerisci di consultare un professionista per esigenze specifiche. Su finanza non dare consigli d'investimento personalizzati: aiuta a leggere i numeri e a pianificare il budget.
- Non inventare dati che non sono presenti nell'istantanea.`;

function rows(sql: string, resource: keyof typeof RESOURCES, ...params: (string | number)[]) {
  return (db.prepare(sql).all(...params) as Row[]).map((r) => fromRow(RESOURCES[resource], r)!);
}

function line(obj: Row, keys: string[]) {
  return keys
    .filter((k) => obj[k] !== null && obj[k] !== undefined && obj[k] !== '')
    .map((k) => `${k}: ${typeof obj[k] === 'object' ? JSON.stringify(obj[k]) : obj[k]}`)
    .join(' | ');
}

/** Istantanea testuale dei dati dell'utente da passare al modello */
export function buildContext(date: string, now?: string): string {
  const s = getSettings();
  const parts: string[] = [];
  parts.push(`Data di oggi: ${date}${now ? ` (ora locale ${now.slice(11, 16)})` : ''}. Nome utente: ${s.name || 'non impostato'}. Valuta: ${s.currency}.`);

  const tasks = rows(
    "SELECT * FROM tasks WHERE status != 'done' ORDER BY due_date IS NULL, due_date, priority DESC LIMIT 40",
    'tasks',
  );
  parts.push(
    `## Task aperti (${tasks.length})\n` +
      (tasks.map((t) => '- ' + line(t, ['title', 'due_date', 'priority', 'status', 'area', 'estimate_min'])).join('\n') || 'nessuno'),
  );

  const events = rows('SELECT * FROM events WHERE date BETWEEN ? AND ? ORDER BY date, start_time', 'events', date, addDays(date, 7));
  parts.push(
    `## Agenda prossimi 7 giorni\n` +
      (events.map((e) => '- ' + line(e, ['date', 'start_time', 'end_time', 'title', 'location'])).join('\n') || 'nessun evento'),
  );

  const reminders = rows('SELECT * FROM reminders WHERE done = 0 ORDER BY remind_at LIMIT 15', 'reminders');
  parts.push(`## Promemoria attivi\n` + (reminders.map((r) => '- ' + line(r, ['remind_at', 'title', 'repeat'])).join('\n') || 'nessuno'));

  const goals = rows("SELECT * FROM goals WHERE status = 'attivo'", 'goals');
  parts.push(
    `## Obiettivi attivi\n` +
      (goals
        .map((g) => '- ' + line(g, ['title', 'area', 'target_date', 'progress', 'metric_current', 'metric_target', 'unit', 'description']))
        .join('\n') || 'nessuno'),
  );

  const habits = habitsOverview(date);
  parts.push(
    `## Abitudini\n` +
      (habits.map((h) => `- ${String(h.name)}: serie ${h.streak} giorni, completamento 30gg ${h.rate30}%, oggi ${h.doneToday ? 'fatto' : 'da fare'}`).join('\n') ||
        'nessuna'),
  );

  const fin = financeSummary(date.slice(0, 7));
  parts.push(
    `## Finanze mese ${fin.month}\nEntrate ${fin.income.toFixed(2)}, uscite ${fin.expense.toFixed(2)}, netto ${fin.net.toFixed(2)}, saldo totale ${fin.totalBalance.toFixed(2)}\n` +
      `Spese per categoria: ${fin.byCategory.map((c) => `${c.category} ${c.total.toFixed(2)}`).join(', ') || 'nessuna'}\n` +
      `Budget: ${fin.budgets.map((b) => `${b.category} ${b.spent.toFixed(2)}/${b.monthly_limit.toFixed(2)}`).join(', ') || 'nessuno'}`,
  );

  const n = nutritionDay(date);
  parts.push(
    `## Alimentazione oggi\n${n.calories} kcal su ${n.targets.calories}; proteine ${n.protein}/${n.targets.protein} g, carboidrati ${n.carbs}/${n.targets.carbs} g, grassi ${n.fat}/${n.targets.fat} g`,
  );

  const w = workoutsWeek(date);
  const recentWorkouts = rows('SELECT * FROM workouts WHERE date >= ? ORDER BY date DESC', 'workouts', addDays(date, -14));
  parts.push(
    `## Allenamenti\nQuesta settimana: ${w.count}/${w.target} sessioni, ${w.minutes} minuti.\nUltime 2 settimane:\n` +
      (recentWorkouts.map((x) => '- ' + line(x, ['date', 'title', 'type', 'duration_min'])).join('\n') || 'nessuno'),
  );

  const social = rows("SELECT * FROM social_posts WHERE status != 'pubblicato' ORDER BY publish_date IS NULL, publish_date LIMIT 20", 'social_posts');
  const published = rows("SELECT * FROM social_posts WHERE status = 'pubblicato' ORDER BY publish_date DESC LIMIT 10", 'social_posts');
  parts.push(
    `## Social (nicchia: ${s.social_niche || 'non impostata'})\nIn lavorazione:\n` +
      (social.map((p) => '- ' + line(p, ['title', 'platform', 'format', 'status', 'publish_date', 'pillar', 'score', 'hook'])).join('\n') || 'nessuno') +
      `\nPubblicati di recente:\n` +
      (published.map((p) => '- ' + line(p, ['title', 'platform', 'publish_date', 'views', 'likes'])).join('\n') || 'nessuno'),
  );

  const wd = weekdayOf(date);
  const plan = rows('SELECT * FROM meal_plan WHERE weekday = ? ORDER BY id', 'meal_plan', wd);
  const lowStock = db.prepare('SELECT name, quantity, unit FROM pantry_items WHERE min_quantity IS NOT NULL AND quantity < min_quantity').all() as Row[];
  const shopping = db.prepare('SELECT name, quantity, unit FROM shopping_items WHERE checked = 0').all() as Row[];
  parts.push(
    `## Piano alimentare di oggi\n` +
      (plan.map((p) => '- ' + line(p, ['meal_type', 'title', 'calories', 'protein'])).join('\n') || 'nessun piano impostato') +
      `\nScorte in esaurimento: ${lowStock.map((p) => `${p.name} (${p.quantity} ${p.unit})`).join(', ') || 'nessuna'}` +
      `\nLista della spesa: ${shopping.map((p) => p.name).join(', ') || 'vuota'}`,
  );

  const progress = workoutProgress({ date, weeks: 4 });
  parts.push(
    `## Progressi esercizi (massimale stimato)\n` +
      (progress.exercises
        .slice(0, 10)
        .map((e) => `- ${e.name}: ultimo ${e.last1rm} kg, record ${e.prWeight} kg x ${e.prReps}, variazione ${e.changePct ?? 0}% su ${e.sessionsCount} sessioni`)
        .join('\n') || 'nessun dato') +
      (progress.body.length ? `\nPeso corporeo: ${progress.body.slice(-5).map((b) => `${b.date} ${b.weight} kg`).join(', ')}` : ''),
  );

  const notes = rows('SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC LIMIT 12', 'notes');
  parts.push(
    `## Note e idee recenti\n` +
      (notes.map((x) => `- [${x.type}] ${x.title || '(senza titolo)'}: ${String(x.content ?? '').replace(/\s+/g, ' ').slice(0, 240)}`).join('\n') ||
        'nessuna'),
  );

  return parts.join('\n\n');
}

aiRouter.get('/ai/status', (_req, res) => {
  res.json({ enabled: aiEnabled(), model: MODEL });
});

aiRouter.post('/ai/chat', async (req, res) => {
  if (!aiEnabled()) {
    throw new HttpError(503, "Assistente AI non configurato: imposta ANTHROPIC_API_KEY nel file server/.env e riavvia il server.");
  }
  const body = req.body as { messages?: { role: string; content: string }[]; date?: string; now?: string };
  const input = (body.messages ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-30);
  while (input.length && input[0].role !== 'user') input.shift();
  if (!input.length || input[input.length - 1].role !== 'user') throw new HttpError(400, 'Serve almeno un messaggio utente');

  const date = isDate(body.date) ? body.date : todayLocal();
  const messages: Anthropic.Beta.BetaMessageParam[] = input.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  try {
    const response = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // se il modello declina la richiesta, l'API riprova automaticamente con un modello di riserva
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium' },
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: `# Istantanea dei dati dell'utente\n\n${buildContext(date, body.now)}` },
      ],
      messages,
    });

    if (response.stop_reason === 'refusal') {
      return res.json({ reply: 'Non posso aiutarti con questa richiesta. Prova a riformularla.', model: response.model });
    }
    const reply = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    res.json({ reply, model: response.model });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new HttpError(401, 'Chiave API Anthropic non valida');
    if (err instanceof Anthropic.RateLimitError) throw new HttpError(429, 'Troppe richieste all\'AI: riprova tra poco');
    if (err instanceof Anthropic.APIError) throw new HttpError(502, `Errore dell'AI (${err.status ?? 'rete'}): ${err.message}`);
    throw err;
  }
});
