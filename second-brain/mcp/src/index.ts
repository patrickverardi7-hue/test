#!/usr/bin/env node
// Server MCP di Second Brain: permette a Claude (Desktop o Code) di leggere e scrivere
// nella tua seconda mente — spese, task, allenamenti, pasti, idee video, spesa…
// Comunica con l'app tramite la sua API locale (l'app deve essere aperta).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseEnv } from 'node:util';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// ---------- configurazione (stessa cartella dati dell'app: ~/SecondBrain/.env) ----------
const dataDir = process.env.SECOND_BRAIN_HOME ?? path.join(os.homedir(), 'SecondBrain');
let fileEnv: Record<string, string | undefined> = {};
try {
  fileEnv = parseEnv(fs.readFileSync(path.join(dataDir, '.env'), 'utf8'));
} catch {
  /* nessun file .env */
}
const PORT = process.env.SECOND_BRAIN_PORT ?? fileEnv.PORT ?? '3001';
const BASE = (process.env.SECOND_BRAIN_URL ?? `http://127.0.0.1:${PORT}`).replace(/\/$/, '');
const PASSWORD = process.env.SECOND_BRAIN_PASSWORD ?? fileEnv.APP_PASSWORD ?? '';

// ---------- utilità ----------
const pad = (n: number) => String(n).padStart(2, '0');
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

type Row = Record<string, any>;

async function api<T = any>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api${url}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(PASSWORD ? { Authorization: `Bearer ${PASSWORD}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new Error(`Second Brain non è raggiungibile su ${BASE}. Apri l'app desktop Second Brain (oppure avvia "npm run dev") e riprova.`);
  }
  if (res.status === 401) throw new Error('Accesso negato: imposta SECOND_BRAIN_PASSWORD con la password dell\'app.');
  if (!res.ok) {
    let msg = res.statusText;
    try {
      msg = (await res.json()).error ?? msg;
    } catch {
      /* risposta non JSON */
    }
    throw new Error(`Errore da Second Brain (${res.status}): ${msg}`);
  }
  if (res.status === 204) return undefined as T;
  const type = res.headers.get('content-type') ?? '';
  return (type.includes('json') ? res.json() : res.text()) as Promise<T>;
}

const qs = (p: Record<string, unknown>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  return sp.toString() ? `?${sp}` : '';
};

const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }] });
const json = (label: string, data: unknown) => text(`${label}\n${JSON.stringify(data, null, 2)}`);

/** Esegue lo strumento e trasforma gli errori in messaggi leggibili per Claude */
function safe<A>(fn: (args: A) => Promise<ReturnType<typeof text>>) {
  return async (args: A) => {
    try {
      return await fn(args);
    } catch (e) {
      return { ...text(e instanceof Error ? e.message : String(e)), isError: true };
    }
  };
}

const money = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n);
const strip = (r: Row, keys: string[]) => Object.fromEntries(keys.filter((k) => r[k] !== null && r[k] !== undefined && r[k] !== '').map((k) => [k, r[k]]));

// ---------- server ----------
const server = new McpServer(
  { name: 'second-brain', version: '0.2.0' },
  {
    instructions: `Second Brain è l'app personale dell'utente per gestire tutta la sua vita: task, agenda, promemoria, finanze, alimentazione con piano alimentare e lista della spesa, allenamenti con progressi, abitudini, note e idee per i video/social.
Regole:
- Quando l'utente racconta qualcosa che ha fatto o deve fare (una spesa, un allenamento, un pasto, un impegno, un'idea), salvalo con lo strumento adatto senza chiedere conferma, poi riassumi in una riga cosa hai salvato.
- Tutte le idee per video e contenuti social vanno salvate in Second Brain con "aggiungi_idee_video" (anche quando le generi tu su richiesta). Prima di proporne di nuove usa "elenca_idee_video" per evitare doppioni.
- Le date sono nel formato YYYY-MM-DD, gli orari HH:MM, nel fuso orario locale dell'utente. Oggi è ${today()}.
- Gli importi sono in euro salvo indicazione diversa. Le quantità della spesa usano g, ml o pz (kg e l vengono convertiti).`,
  },
);

// ---- panoramica ----
server.registerTool(
  'riepilogo_oggi',
  {
    title: 'Riepilogo della giornata',
    description: "Panoramica della giornata: task in scadenza e in ritardo, agenda, promemoria, abitudini, calorie, finanze del mese, allenamenti della settimana, obiettivi e contenuti social in programma.",
    inputSchema: { date: z.string().optional().describe('Data YYYY-MM-DD, default oggi') },
  },
  safe(async ({ date }) => {
    const d = await api<Row>('GET', `/dashboard${qs({ date: date ?? today() })}`);
    const out = {
      data: d.date,
      task: d.tasks.map((t: Row) => strip(t, ['id', 'title', 'due_date', 'priority', 'area'])),
      task_completati_oggi: d.tasksDoneToday,
      agenda: d.events.map((e: Row) => strip(e, ['id', 'title', 'start_time', 'end_time', 'location'])),
      prossimi_eventi: d.upcoming.map((e: Row) => strip(e, ['title', 'date', 'start_time'])),
      promemoria: d.reminders.map((r: Row) => strip(r, ['id', 'title', 'remind_at'])),
      abitudini: d.habits.map((h: Row) => ({ nome: h.name, fatta_oggi: h.doneToday, serie: h.streak })),
      alimentazione: d.nutrition,
      finanze_mese: { entrate: d.finance.income, uscite: d.finance.expense, netto: d.finance.net },
      allenamenti_settimana: d.workouts,
      obiettivi: d.goals.map((g: Row) => strip(g, ['title', 'target_date', 'progress', 'metric_current', 'metric_target', 'unit'])),
      social_in_programma: d.social.map((p: Row) => strip(p, ['title', 'platform', 'publish_date', 'status'])),
    };
    return json('Riepilogo di Second Brain:', out);
  }),
);

server.registerTool(
  'cerca',
  {
    title: 'Cerca',
    description: 'Cerca un testo in tutta la seconda mente: note, task, obiettivi, eventi, promemoria, idee video, movimenti, allenamenti, pasti.',
    inputSchema: { query: z.string().min(2) },
  },
  safe(async ({ query }) => json(`Risultati per "${query}":`, await api('GET', `/search${qs({ q: query })}`))),
);

// ---- finanze ----
server.registerTool(
  'registra_movimento',
  {
    title: 'Registra spesa o entrata',
    description: 'Registra una spesa (uscita) o un\'entrata di denaro. Esempi: "ho speso 23,50€ al supermercato", "mi è arrivato lo stipendio di 2100€".',
    inputSchema: {
      type: z.enum(['expense', 'income']).default('expense').describe('expense = spesa/uscita, income = entrata'),
      amount: z.number().positive().describe('Importo positivo in euro'),
      description: z.string().describe('Cosa è stato comprato o da dove arriva il denaro'),
      category: z
        .string()
        .optional()
        .describe('Categoria. Uscite: Casa, Spesa, Ristoranti, Trasporti, Salute, Sport, Svago, Abbonamenti, Shopping, Viaggi, Lavoro, Altro. Entrate: Stipendio, Freelance, Social / Sponsor, Investimenti, Rimborsi, Altro'),
      date: z.string().optional().describe('YYYY-MM-DD, default oggi'),
      account: z.string().optional().describe('Conto: Principale, Contanti, Carta di credito…'),
    },
  },
  safe(async (a) => {
    const r = await api<Row>('POST', '/transactions', { ...a, date: a.date ?? today(), category: a.category ?? 'Altro' });
    return text(`✓ ${r.type === 'income' ? 'Entrata' : 'Spesa'} registrata: ${money(r.amount)} — ${r.description} (${r.category}, ${r.date}) [id ${r.id}]`);
  }),
);

server.registerTool(
  'riepilogo_finanze',
  {
    title: 'Riepilogo finanze',
    description: 'Entrate, uscite, risparmio, spese per categoria, budget e andamento degli ultimi 6 mesi. Include gli ultimi movimenti del mese.',
    inputSchema: { month: z.string().optional().describe('Mese YYYY-MM, default il mese corrente') },
  },
  safe(async ({ month }) => {
    const m = month ?? today().slice(0, 7);
    const summary = await api<Row>('GET', `/finance/summary${qs({ month: m })}`);
    const tx = await api<Row[]>('GET', `/transactions${qs({ from: `${m}-01`, to: `${m}-31`, limit: 50 })}`);
    return json(`Finanze di ${m}:`, { ...summary, movimenti: tx.map((t) => strip(t, ['id', 'date', 'type', 'amount', 'category', 'description'])) });
  }),
);

// ---- task, agenda, promemoria ----
const PRIORITY = { alta: 3, media: 2, bassa: 1 } as const;

server.registerTool(
  'aggiungi_task',
  {
    title: 'Aggiungi task',
    description: 'Aggiunge una cosa da fare.',
    inputSchema: {
      title: z.string(),
      due_date: z.string().optional().describe('Scadenza YYYY-MM-DD (oggi se l\'utente dice "oggi")'),
      priority: z.enum(['alta', 'media', 'bassa']).optional(),
      area: z.enum(['personale', 'lavoro', 'salute', 'finanza', 'social', 'studio', 'casa', 'relazioni']).optional(),
      estimate_min: z.number().int().positive().optional().describe('Durata stimata in minuti'),
      notes: z.string().optional(),
    },
  },
  safe(async (a) => {
    const r = await api<Row>('POST', '/tasks', { ...a, priority: a.priority ? PRIORITY[a.priority] : 2 });
    return text(`✓ Task aggiunto: "${r.title}"${r.due_date ? ` per il ${r.due_date}` : ''} [id ${r.id}]`);
  }),
);

server.registerTool(
  'elenca_task',
  {
    title: 'Elenca task',
    description: 'Elenca i task: quelli di oggi (inclusi i ritardi), tutti quelli aperti o i completati di recente.',
    inputSchema: { filtro: z.enum(['oggi', 'aperti', 'completati']).default('oggi') },
  },
  safe(async ({ filtro }) => {
    const all = await api<Row[]>('GET', `/tasks${qs(filtro === 'completati' ? { status: 'done', order: '-completed_at', limit: 30 } : { status__ne: 'done' })}`);
    const list = filtro === 'oggi' ? all.filter((t) => t.due_date && t.due_date <= today()) : all;
    return json(`Task (${filtro}):`, list.map((t) => strip(t, ['id', 'title', 'due_date', 'priority', 'status', 'area', 'completed_at'])));
  }),
);

server.registerTool(
  'completa_task',
  {
    title: 'Completa task',
    description: 'Segna un task come fatto, indicando l\'id oppure parte del titolo.',
    inputSchema: { id: z.number().int().optional(), title: z.string().optional() },
  },
  safe(async ({ id, title }) => {
    let taskId = id;
    if (!taskId && title) {
      const found = await api<Row[]>('GET', `/tasks${qs({ q: title, status__ne: 'done' })}`);
      if (!found.length) return text(`Nessun task aperto contiene "${title}".`);
      if (found.length > 1) return json('Più task corrispondono, indica l\'id:', found.map((t) => strip(t, ['id', 'title', 'due_date'])));
      taskId = found[0].id;
    }
    if (!taskId) return text('Indica id o titolo del task.');
    const r = await api<Row>('PATCH', `/tasks/${taskId}`, { status: 'done' });
    return text(`✓ Completato: "${r.title}"`);
  }),
);

server.registerTool(
  'aggiungi_evento',
  {
    title: 'Aggiungi evento in agenda',
    description: 'Aggiunge un impegno o appuntamento in agenda (anche blocchi di tempo per lavorare).',
    inputSchema: {
      title: z.string(),
      date: z.string().describe('YYYY-MM-DD'),
      start_time: z.string().optional().describe('HH:MM'),
      end_time: z.string().optional().describe('HH:MM'),
      location: z.string().optional(),
      category: z.enum(['personale', 'lavoro', 'salute', 'finanza', 'social', 'studio', 'casa', 'relazioni']).optional(),
      notes: z.string().optional(),
    },
  },
  safe(async (a) => {
    const r = await api<Row>('POST', '/events', a);
    return text(`✓ In agenda: "${r.title}" il ${r.date}${r.start_time ? ` alle ${r.start_time}` : ''} [id ${r.id}]`);
  }),
);

server.registerTool(
  'agenda',
  {
    title: 'Mostra agenda',
    description: 'Mostra gli eventi in un intervallo di date.',
    inputSchema: { from: z.string().optional().describe('YYYY-MM-DD, default oggi'), to: z.string().optional().describe('YYYY-MM-DD, default from') },
  },
  safe(async ({ from, to }) => {
    const f = from ?? today();
    return json(`Agenda ${f}${to ? ` → ${to}` : ''}:`, (await api<Row[]>('GET', `/events${qs({ from: f, to: to ?? f })}`)).map((e) => strip(e, ['id', 'date', 'start_time', 'end_time', 'title', 'location'])));
  }),
);

server.registerTool(
  'aggiungi_promemoria',
  {
    title: 'Aggiungi promemoria',
    description: 'Crea un promemoria con notifica all\'ora indicata, anche ricorrente.',
    inputSchema: {
      title: z.string(),
      remind_at: z.string().describe('YYYY-MM-DDTHH:MM, ora locale'),
      repeat: z.enum(['none', 'daily', 'weekly', 'monthly']).default('none'),
      notes: z.string().optional(),
    },
  },
  safe(async (a) => {
    const r = await api<Row>('POST', '/reminders', a);
    return text(`✓ Promemoria "${r.title}" impostato per ${r.remind_at.replace('T', ' alle ')}${r.repeat !== 'none' ? ` (ripetuto: ${r.repeat})` : ''}`);
  }),
);

// ---- allenamenti ----
const exerciseSchema = z.object({
  name: z.string().describe('Nome esercizio, es. "Panca piana"'),
  sets: z.number().int().positive().optional(),
  reps: z.number().int().positive().optional(),
  weight: z.number().nonnegative().optional().describe('Carico in kg'),
});

server.registerTool(
  'registra_allenamento',
  {
    title: 'Registra allenamento',
    description: 'Registra una sessione di allenamento con gli esercizi (serie, ripetizioni, carico). Usa nomi degli esercizi coerenti con quelli già registrati per tracciare i progressi.',
    inputSchema: {
      title: z.string().describe('Es. "Push", "Gambe", "Corsa 5 km"'),
      date: z.string().optional().describe('YYYY-MM-DD, default oggi'),
      type: z.enum(['forza', 'cardio', 'mobilità', 'sport', 'altro']).default('forza'),
      duration_min: z.number().int().positive().optional(),
      calories: z.number().positive().optional(),
      exercises: z.array(exerciseSchema).default([]),
      notes: z.string().optional(),
    },
  },
  safe(async (a) => {
    const r = await api<Row>('POST', '/workouts', {
      ...a,
      date: a.date ?? today(),
      exercises: a.exercises.map((e) => ({ name: e.name, sets: e.sets ?? null, reps: e.reps ?? null, weight: e.weight ?? null })),
    });
    // confronto con i record per dare un feedback immediato
    const progress = await api<Row>('GET', `/workouts/progress${qs({ weeks: 4 })}`);
    const prs = (a.exercises ?? [])
      .map((e) => progress.exercises.find((x: Row) => x.name.toLowerCase() === e.name.toLowerCase()))
      .filter((x: Row | undefined): x is Row => Boolean(x && x.prDate === r.date && x.sessionsCount > 1))
      .map((x) => `🏆 nuovo record su ${x.name}: ${x.prWeight} kg × ${x.prReps}`);
    return text(`✓ Allenamento "${r.title}" registrato il ${r.date} (${(r.exercises ?? []).length} esercizi) [id ${r.id}]${prs.length ? '\n' + prs.join('\n') : ''}`);
  }),
);

server.registerTool(
  'progressi_allenamento',
  {
    title: 'Progressi negli allenamenti',
    description: 'Andamento degli esercizi (massimale stimato, record, variazione %), volume e sessioni settimanali, peso corporeo.',
    inputSchema: {
      exercise: z.string().optional().describe('Filtra per nome esercizio, es. "squat"'),
      weeks: z.number().int().min(4).max(52).default(12),
    },
  },
  safe(async ({ exercise, weeks }) => {
    const p = await api<Row>('GET', `/workouts/progress${qs({ exercise, weeks })}`);
    const exercises = p.exercises.map((e: Row) => ({
      esercizio: e.name,
      sessioni: e.sessionsCount,
      massimale_stimato_ultimo: e.last1rm,
      massimale_stimato_primo: e.first1rm,
      variazione_pct: e.changePct,
      record: `${e.prWeight} kg × ${e.prReps} (${e.prDate})`,
      ultime_sessioni: e.history.slice(-6).map((h: Row) => `${h.date}: ${h.sets}×${h.reps} @ ${h.weight} kg`),
    }));
    return json('Progressi:', { esercizi: exercises, settimane_con_allenamenti: p.weekly.filter((w: Row) => w.sessions > 0), peso_corporeo: p.body.slice(-10) });
  }),
);

server.registerTool(
  'registra_misure',
  {
    title: 'Registra peso e misure',
    description: 'Registra il peso corporeo e, se disponibili, massa grassa e circonferenza vita.',
    inputSchema: {
      weight: z.number().positive().optional().describe('kg'),
      body_fat: z.number().positive().optional().describe('%'),
      waist: z.number().positive().optional().describe('cm'),
      date: z.string().optional(),
      notes: z.string().optional(),
    },
  },
  safe(async (a) => {
    const r = await api<Row>('POST', '/body_metrics', { ...a, date: a.date ?? today() });
    return text(`✓ Misure registrate il ${r.date}: ${[r.weight && `${r.weight} kg`, r.body_fat && `${r.body_fat}% grasso`, r.waist && `vita ${r.waist} cm`].filter(Boolean).join(', ')}`);
  }),
);

// ---- alimentazione e spesa ----
const mealType = z.enum(['colazione', 'pranzo', 'spuntino', 'cena']);
const ingredientSchema = z.object({
  name: z.string(),
  quantity: z.number().positive().optional(),
  unit: z.enum(['g', 'kg', 'ml', 'l', 'pz']).optional(),
});

server.registerTool(
  'registra_pasto',
  {
    title: 'Registra pasto',
    description: 'Registra cosa ha mangiato l\'utente con calorie e macronutrienti (stimali tu se non li dà). Se il pasto corrisponde a uno del piano alimentare, usa invece "mangiato_dal_piano" così la dispensa si aggiorna.',
    inputSchema: {
      description: z.string(),
      meal_type: mealType,
      date: z.string().optional(),
      calories: z.number().nonnegative().optional(),
      protein: z.number().nonnegative().optional(),
      carbs: z.number().nonnegative().optional(),
      fat: z.number().nonnegative().optional(),
      consumed_ingredients: z.array(ingredientSchema).optional().describe('Ingredienti da scalare dalla dispensa (opzionale)'),
    },
  },
  safe(async ({ consumed_ingredients, ...a }) => {
    const r = await api<Row>('POST', '/meals', { ...a, date: a.date ?? today() });
    let extra = '';
    if (consumed_ingredients?.length) {
      // pasto "una tantum" nel piano non serve: scaliamo direttamente gli ingredienti
      const pantry = await api<Row[]>('GET', '/pantry_items');
      const changed: string[] = [];
      for (const ing of consumed_ingredients) {
        const p = pantry.find((x) => x.name.toLowerCase() === ing.name.toLowerCase());
        if (!p) continue;
        const factor = ing.unit === 'kg' || ing.unit === 'l' ? 1000 : 1;
        const left = Math.max(0, p.quantity - (ing.quantity ?? 1) * factor);
        await api('PATCH', `/pantry_items/${p.id}`, { quantity: left });
        changed.push(`${p.name}: restano ${left} ${p.unit}`);
      }
      if (changed.length) extra = `\nDispensa aggiornata — ${changed.join('; ')}`;
    }
    const day = await api<Row>('GET', `/dashboard${qs({ date: r.date })}`);
    const n = day.nutrition;
    return text(`✓ ${r.meal_type} registrato: ${r.description}. Oggi: ${Math.round(n.calories)}/${n.targets.calories} kcal, proteine ${Math.round(n.protein)}/${n.targets.protein} g.${extra}`);
  }),
);

server.registerTool(
  'piano_alimentare',
  {
    title: 'Mostra piano alimentare',
    description: 'Mostra il piano alimentare settimanale (o di un giorno) con ingredienti e macro.',
    inputSchema: { weekday: z.number().int().min(1).max(7).optional().describe('1 = lunedì … 7 = domenica') },
  },
  safe(async ({ weekday }) => {
    const plan = await api<Row[]>('GET', `/meal_plan${qs({ weekday })}`);
    return json('Piano alimentare:', plan.map((p) => strip(p, ['id', 'weekday', 'meal_type', 'title', 'ingredients', 'calories', 'protein', 'carbs', 'fat'])));
  }),
);

server.registerTool(
  'aggiungi_pasti_al_piano',
  {
    title: 'Aggiungi pasti al piano alimentare',
    description: 'Inserisce uno o più pasti nel piano alimentare settimanale, con ingredienti per porzione. Utile per caricare la dieta del nutrizionista: la lista della spesa verrà calcolata da qui.',
    inputSchema: {
      meals: z.array(
        z.object({
          weekday: z.number().int().min(1).max(7).describe('1 = lunedì … 7 = domenica'),
          meal_type: mealType,
          title: z.string(),
          ingredients: z.array(ingredientSchema).default([]),
          calories: z.number().optional(),
          protein: z.number().optional(),
          carbs: z.number().optional(),
          fat: z.number().optional(),
        }),
      ),
    },
  },
  safe(async ({ meals }) => {
    for (const m of meals) await api('POST', '/meal_plan', m);
    return text(`✓ ${meals.length} pasti aggiunti al piano alimentare.`);
  }),
);

server.registerTool(
  'mangiato_dal_piano',
  {
    title: 'Segna pasto del piano come mangiato',
    description: 'Registra un pasto del piano alimentare come mangiato e scala i suoi ingredienti dalla dispensa. Senza id usa il pasto del piano di oggi per il momento indicato.',
    inputSchema: { id: z.number().int().optional(), meal_type: mealType.optional(), date: z.string().optional() },
  },
  safe(async ({ id, meal_type, date }) => {
    const d = date ?? today();
    let planId = id;
    if (!planId) {
      const t = await api<Row>('GET', `/meal_plan/today${qs({ date: d })}`);
      const match = t.items.filter((p: Row) => !meal_type || p.meal_type === meal_type);
      if (match.length !== 1) return json('Indica quale pasto (id):', t.items.map((p: Row) => strip(p, ['id', 'meal_type', 'title'])));
      planId = match[0].id;
    }
    const r = await api<Row>('POST', `/meal_plan/${planId}/eat`, { date: d });
    return text(`✓ Registrato "${r.meal.description}". Dispensa: ${r.consumed.map((c: Row) => `${c.name} → restano ${c.left} ${c.unit}`).join('; ') || 'nessun ingrediente in dispensa da scalare'}`);
  }),
);

server.registerTool(
  'lista_spesa',
  {
    title: 'Lista della spesa',
    description:
      'Gestisce la lista della spesa. azione: "mostra" (elenco attuale), "aggiungi" (articoli in testo libero, es. "2 kg mele"), "genera" (calcola dal piano alimentare dei prossimi giorni meno la dispensa, più le scorte sotto il minimo), "completa" (gli articoli spuntati vanno in dispensa), "spunta" (segna come presi gli articoli indicati).',
    inputSchema: {
      azione: z.enum(['mostra', 'aggiungi', 'genera', 'spunta', 'completa']).default('mostra'),
      articoli: z.array(z.string()).optional().describe('Per "aggiungi" e "spunta": es. ["2 kg mele", "latte", "6 uova"]'),
      giorni: z.number().int().min(1).max(31).optional().describe('Per "genera": quanti giorni coprire (default 7)'),
    },
  },
  safe(async ({ azione, articoli, giorni }) => {
    if (azione === 'aggiungi') {
      await api('POST', '/shopping/add', { items: (articoli ?? []).map(parseItem) });
    } else if (azione === 'genera') {
      const r = await api<Row>('POST', '/shopping/generate', { from: today(), days: giorni ?? 7 });
      return text(`✓ Lista generata per ${r.from} → ${r.to}: ${r.added} articoli dal piano/scorte.\n\n${await api<string>('GET', '/shopping/text')}`);
    } else if (azione === 'spunta') {
      const items = await api<Row[]>('GET', '/shopping_items?checked=false');
      for (const a of articoli ?? []) {
        const name = parseItem(a).name.toLowerCase();
        const it = items.find((i) => i.name.toLowerCase().includes(name));
        if (it) await api('PATCH', `/shopping_items/${it.id}`, { checked: true });
      }
    } else if (azione === 'completa') {
      const r = await api<Row>('POST', '/shopping/complete', {});
      return text(`✓ ${r.moved} articoli spostati in dispensa.`);
    }
    return text(`Lista della spesa:\n\n${await api<string>('GET', '/shopping/text')}`);
  }),
);

server.registerTool(
  'dispensa',
  {
    title: 'Dispensa',
    description: 'Mostra cosa c\'è in casa oppure imposta la quantità di un prodotto (azione "imposta") — es. "ho 2 litri di latte", "è finito il riso".',
    inputSchema: {
      azione: z.enum(['mostra', 'imposta']).default('mostra'),
      name: z.string().optional(),
      quantity: z.number().nonnegative().optional(),
      unit: z.enum(['g', 'kg', 'ml', 'l', 'pz']).optional(),
      min_quantity: z.number().nonnegative().optional().describe('Scorta minima: sotto questa soglia il prodotto va in lista della spesa'),
    },
  },
  safe(async ({ azione, name, quantity, unit, min_quantity }) => {
    if (azione === 'imposta' && name) {
      const pantry = await api<Row[]>('GET', '/pantry_items');
      const p = pantry.find((x) => x.name.toLowerCase() === name.toLowerCase());
      const body = { name, quantity: quantity ?? 0, unit: unit ?? p?.unit ?? 'pz', ...(min_quantity !== undefined ? { min_quantity } : {}) };
      const r = p ? await api<Row>('PATCH', `/pantry_items/${p.id}`, body) : await api<Row>('POST', '/pantry_items', body);
      return text(`✓ Dispensa: ${r.name} = ${r.quantity} ${r.unit}`);
    }
    const pantry = await api<Row[]>('GET', '/pantry_items');
    return json('Dispensa:', pantry.map((p) => strip(p, ['name', 'quantity', 'unit', 'min_quantity', 'category', 'expires_on'])));
  }),
);

// ---- idee video e social ----
const videoIdea = z.object({
  title: z.string().describe('Titolo dell\'idea'),
  hook: z.string().optional().describe('Le prime parole / i primi 3 secondi'),
  platform: z.enum(['instagram', 'tiktok', 'youtube', 'linkedin', 'x', 'altro']).optional(),
  format: z.enum(['reel', 'short', 'video lungo', 'carosello', 'post', 'live', 'story']).optional(),
  pillar: z.string().optional().describe('Rubrica o tema ricorrente'),
  score: z.number().int().min(1).max(5).optional().describe('Potenziale da 1 a 5'),
  script: z.string().optional().describe('Script o scaletta'),
  shot_list: z.string().optional().describe('Scene da girare'),
  thumbnail_idea: z.string().optional(),
  notes: z.string().optional(),
});

server.registerTool(
  'aggiungi_idee_video',
  {
    title: 'Salva idee video',
    description: 'Salva una o più idee per video/contenuti social nella banca idee di Second Brain. Usalo SEMPRE quando l\'utente ha o chiede idee per video.',
    inputSchema: { ideas: z.array(videoIdea).min(1) },
  },
  safe(async ({ ideas }) => {
    const saved: string[] = [];
    for (const { script, ...i } of ideas) {
      const r = await api<Row>('POST', '/social_posts', { ...i, caption: script, platform: i.platform ?? 'instagram', format: i.format ?? 'reel', status: 'idea', source: 'Claude' });
      saved.push(`- ${r.title} [id ${r.id}]`);
    }
    return text(`✓ ${saved.length} idee salvate nella banca idee:\n${saved.join('\n')}`);
  }),
);

server.registerTool(
  'elenca_idee_video',
  {
    title: 'Elenca idee video',
    description: 'Elenca le idee video e i contenuti social, filtrando per stato o testo. Stati: idea, bozza, pronto, programmato, pubblicato.',
    inputSchema: {
      status: z.enum(['idea', 'bozza', 'pronto', 'programmato', 'pubblicato']).optional(),
      query: z.string().optional(),
      limit: z.number().int().min(1).max(200).default(50),
    },
  },
  safe(async ({ status, query, limit }) => {
    const rows = await api<Row[]>('GET', `/social_posts${qs({ status, q: query, limit })}`);
    return json(`${rows.length} contenuti:`, rows.map((p) => strip(p, ['id', 'title', 'status', 'platform', 'format', 'pillar', 'score', 'hook', 'publish_date', 'views', 'likes'])));
  }),
);

server.registerTool(
  'aggiorna_idea_video',
  {
    title: 'Aggiorna idea video',
    description: 'Aggiorna un contenuto: stato (es. pubblicato), data di pubblicazione, script, hook, metriche…',
    inputSchema: {
      id: z.number().int(),
      status: z.enum(['idea', 'bozza', 'pronto', 'programmato', 'pubblicato']).optional(),
      publish_date: z.string().optional(),
      title: z.string().optional(),
      hook: z.string().optional(),
      script: z.string().optional(),
      shot_list: z.string().optional(),
      score: z.number().int().min(1).max(5).optional(),
      views: z.number().int().nonnegative().optional(),
      likes: z.number().int().nonnegative().optional(),
      notes: z.string().optional(),
    },
  },
  safe(async ({ id, script, ...rest }) => {
    const r = await api<Row>('PATCH', `/social_posts/${id}`, { ...rest, ...(script !== undefined ? { caption: script } : {}) });
    return text(`✓ Aggiornato "${r.title}" (stato: ${r.status})`);
  }),
);

// ---- note, abitudini ----
server.registerTool(
  'aggiungi_nota',
  {
    title: 'Aggiungi nota',
    description: 'Salva una nota, un\'idea, un brainstorming o una pagina di diario. Supporta Markdown e collegamenti [[Titolo]].',
    inputSchema: {
      title: z.string(),
      content: z.string().default(''),
      type: z.enum(['inbox', 'nota', 'idea', 'brainstorm', 'diario']).default('nota'),
      tags: z.string().optional().describe('Separati da virgola'),
    },
  },
  safe(async (a) => {
    const r = await api<Row>('POST', '/notes', a);
    return text(`✓ Nota salvata: "${r.title}" [id ${r.id}]`);
  }),
);

server.registerTool(
  'segna_abitudine',
  {
    title: 'Segna abitudine fatta',
    description: 'Segna come fatta un\'abitudine (es. "meditazione", "leggere") per oggi o per una data.',
    inputSchema: { name: z.string(), date: z.string().optional() },
  },
  safe(async ({ name, date }) => {
    const d = date ?? today();
    const habits = await api<Row[]>('GET', `/habits/overview${qs({ date: d })}`);
    const h = habits.find((x) => x.name.toLowerCase().includes(name.toLowerCase()));
    if (!h) return json(`Nessuna abitudine "${name}". Abitudini esistenti:`, habits.map((x) => x.name));
    const done = h.last7.find((x: Row) => x.date === d)?.done;
    if (!done) await api('POST', `/habits/${h.id}/toggle`, { date: d });
    return text(`✓ ${h.name}: fatto il ${d}. Serie attuale: ${done ? h.streak : h.streak + (d === today() ? 1 : 0)} giorni 🔥`);
  }),
);

// "2 kg mele" → { name, quantity, unit }
function parseItem(t: string): { name: string; quantity: number | null; unit: string | null } {
  const s = t.trim();
  const u = '(kg|g|gr|l|lt|ml|cl|pz|pezzi|x)?';
  const norm = (x?: string) => (!x || x.toLowerCase() === 'x' || x.toLowerCase().startsWith('pez') ? 'pz' : x.toLowerCase());
  const a = s.match(new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*${u}\\s+(.+)$`, 'i'));
  if (a) return { name: a[3].trim(), quantity: Number(a[1].replace(',', '.')), unit: norm(a[2]) };
  const b = s.match(new RegExp(`^(.+?)\\s+(\\d+(?:[.,]\\d+)?)\\s*${u}$`, 'i'));
  if (b) return { name: b[1].trim(), quantity: Number(b[2].replace(',', '.')), unit: norm(b[3]) };
  return { name: s, quantity: null, unit: null };
}

await server.connect(new StdioServerTransport());
console.error(`Second Brain MCP pronto (API: ${BASE})`);
