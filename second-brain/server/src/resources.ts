// Definizione di tutte le "collezioni" dell'app.
// Ogni risorsa diventa una tabella SQLite e ottiene automaticamente
// le API REST: GET/POST /api/<nome>, GET/PATCH/DELETE /api/<nome>/:id
// Aggiungere un campo qui = aggiungere una colonna (la migrazione è automatica).

export type FieldType = 'text' | 'int' | 'real' | 'bool' | 'json';

export interface ResourceDef {
  table: string;
  fields: Record<string, FieldType>;
  required?: string[];
  defaults?: Record<string, unknown>;
  /** Campo data usato dai filtri ?from=YYYY-MM-DD&to=YYYY-MM-DD */
  dateField?: string;
  /** Campi testuali usati dal filtro ?q= */
  searchFields?: string[];
  /** Ordinamento SQL di default */
  defaultOrder: string;
  indexes?: string[];
  /** Righe figlie da eliminare insieme a questa */
  cascade?: { table: string; fk: string }[];
  /** Hook eseguito prima di salvare (create e update) */
  beforeSave?: (data: Record<string, unknown>, existing?: Record<string, unknown>) => void;
}

const nowIso = () => new Date().toISOString();

export const RESOURCES: Record<string, ResourceDef> = {
  tasks: {
    table: 'tasks',
    fields: {
      title: 'text',
      notes: 'text',
      status: 'text', // todo | doing | done
      priority: 'int', // 1 bassa, 2 media, 3 alta
      due_date: 'text', // YYYY-MM-DD
      area: 'text',
      goal_id: 'int',
      estimate_min: 'int',
      completed_at: 'text',
    },
    required: ['title'],
    defaults: { status: 'todo', priority: 2, area: 'personale' },
    dateField: 'due_date',
    searchFields: ['title', 'notes'],
    defaultOrder: "CASE status WHEN 'done' THEN 1 ELSE 0 END, due_date IS NULL, due_date, priority DESC, id DESC",
    indexes: ['due_date', 'status', 'goal_id'],
    beforeSave(data, existing) {
      if (data.status === undefined) return;
      if (data.status === 'done' && existing?.status !== 'done') data.completed_at = nowIso();
      if (data.status !== 'done') data.completed_at = null;
    },
  },

  events: {
    table: 'events',
    fields: {
      title: 'text',
      date: 'text', // YYYY-MM-DD
      start_time: 'text', // HH:MM
      end_time: 'text',
      location: 'text',
      category: 'text',
      notes: 'text',
      task_id: 'int',
    },
    required: ['title', 'date'],
    defaults: { category: 'personale' },
    dateField: 'date',
    searchFields: ['title', 'notes', 'location'],
    defaultOrder: 'date, start_time IS NULL, start_time',
    indexes: ['date'],
  },

  reminders: {
    table: 'reminders',
    fields: {
      title: 'text',
      remind_at: 'text', // YYYY-MM-DDTHH:MM (ora locale)
      repeat: 'text', // none | daily | weekly | monthly
      done: 'bool',
      notes: 'text',
    },
    required: ['title', 'remind_at'],
    defaults: { repeat: 'none', done: false },
    dateField: 'remind_at',
    searchFields: ['title', 'notes'],
    defaultOrder: 'done, remind_at',
    indexes: ['remind_at'],
  },

  transactions: {
    table: 'transactions',
    fields: {
      date: 'text',
      amount: 'real', // sempre positivo; il segno dipende da type
      type: 'text', // income | expense
      category: 'text',
      account: 'text',
      description: 'text',
    },
    required: ['date', 'amount', 'type'],
    defaults: { type: 'expense', category: 'Altro', account: 'Principale' },
    dateField: 'date',
    searchFields: ['description', 'category'],
    defaultOrder: 'date DESC, id DESC',
    indexes: ['date'],
  },

  budgets: {
    table: 'budgets',
    fields: { category: 'text', monthly_limit: 'real' },
    required: ['category', 'monthly_limit'],
    defaultOrder: 'category',
  },

  goals: {
    table: 'goals',
    fields: {
      title: 'text',
      description: 'text',
      area: 'text',
      status: 'text', // attivo | completato | in pausa
      target_date: 'text',
      progress: 'int', // 0-100 (manuale)
      metric_current: 'real',
      metric_target: 'real',
      unit: 'text',
      milestones: 'json', // [{ text, done }]
    },
    required: ['title'],
    defaults: { status: 'attivo', progress: 0, area: 'personale', milestones: [] },
    dateField: 'target_date',
    searchFields: ['title', 'description'],
    defaultOrder: "CASE status WHEN 'attivo' THEN 0 WHEN 'in pausa' THEN 1 ELSE 2 END, target_date IS NULL, target_date",
  },

  habits: {
    table: 'habits',
    fields: { name: 'text', icon: 'text', color: 'text', archived: 'bool' },
    required: ['name'],
    defaults: { icon: '✅', color: '#7c5cff', archived: false },
    defaultOrder: 'archived, id',
    cascade: [{ table: 'habit_logs', fk: 'habit_id' }],
  },

  habit_logs: {
    table: 'habit_logs',
    fields: { habit_id: 'int', date: 'text' },
    required: ['habit_id', 'date'],
    dateField: 'date',
    defaultOrder: 'date DESC',
    indexes: ['habit_id', 'date'],
  },

  notes: {
    table: 'notes',
    fields: {
      title: 'text',
      content: 'text',
      type: 'text', // inbox | nota | idea | brainstorm | diario
      tags: 'text', // separati da virgola
      pinned: 'bool',
    },
    defaults: { type: 'nota', title: '', content: '', tags: '', pinned: false },
    searchFields: ['title', 'content', 'tags'],
    defaultOrder: 'pinned DESC, updated_at DESC',
    indexes: ['type'],
  },

  meals: {
    table: 'meals',
    fields: {
      date: 'text',
      meal_type: 'text', // colazione | pranzo | cena | spuntino
      description: 'text',
      calories: 'real',
      protein: 'real',
      carbs: 'real',
      fat: 'real',
    },
    required: ['date', 'description'],
    defaults: { meal_type: 'pranzo' },
    dateField: 'date',
    searchFields: ['description'],
    defaultOrder: "date DESC, CASE meal_type WHEN 'colazione' THEN 0 WHEN 'pranzo' THEN 1 WHEN 'spuntino' THEN 2 ELSE 3 END",
    indexes: ['date'],
  },

  workouts: {
    table: 'workouts',
    fields: {
      date: 'text',
      title: 'text',
      type: 'text', // forza | cardio | mobilità | sport | altro
      duration_min: 'int',
      calories: 'real',
      exercises: 'json', // [{ name, sets, reps, weight }]
      notes: 'text',
    },
    required: ['date', 'title'],
    defaults: { type: 'forza', exercises: [] },
    dateField: 'date',
    searchFields: ['title', 'notes'],
    defaultOrder: 'date DESC, id DESC',
    indexes: ['date'],
  },

  social_posts: {
    table: 'social_posts',
    fields: {
      title: 'text',
      platform: 'text', // instagram | tiktok | youtube | linkedin | x | altro
      status: 'text', // idea | bozza | pronto | programmato | pubblicato
      publish_date: 'text',
      hook: 'text',
      caption: 'text',
      hashtags: 'text',
      notes: 'text',
      views: 'int',
      likes: 'int',
    },
    required: ['title'],
    defaults: { platform: 'instagram', status: 'idea' },
    dateField: 'publish_date',
    searchFields: ['title', 'hook', 'caption', 'notes'],
    defaultOrder: 'publish_date IS NULL, publish_date, id DESC',
  },

  feeds: {
    table: 'feeds',
    fields: { name: 'text', url: 'text', category: 'text', enabled: 'bool' },
    required: ['name', 'url'],
    defaults: { category: 'Generale', enabled: true },
    defaultOrder: 'category, name',
  },
};

export const DEFAULT_SETTINGS: Record<string, unknown> = {
  name: '',
  currency: 'EUR',
  calorie_target: 2200,
  protein_target: 140,
  carbs_target: 250,
  fat_target: 70,
  workouts_per_week: 4,
  social_niche: '',
};

export const DEFAULT_FEEDS = [
  { name: 'Il Post', url: 'https://www.ilpost.it/feed/', category: 'Attualità' },
  { name: 'ANSA', url: 'https://www.ansa.it/sito/ansait_rss.xml', category: 'Attualità' },
  { name: 'Wired Italia', url: 'https://www.wired.it/feed/rss', category: 'Tecnologia' },
  { name: 'Hacker News', url: 'https://hnrss.org/frontpage', category: 'Tecnologia' },
];
