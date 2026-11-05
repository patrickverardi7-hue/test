// Definizioni dei form riutilizzate da pagine, dashboard e cattura rapida.
import type { FieldSpec } from './components/ui';
import type { Goal } from './types';
import { AREAS, EXPENSE_CATEGORIES, INCOME_CATEGORIES, MEAL_TYPES, NOTE_TYPES, PLATFORMS, POST_STATUSES, PRIORITIES } from './utils';

export const taskFields = (goals: Goal[] = []): FieldSpec[] => [
  { name: 'title', label: 'Titolo', required: true, placeholder: 'Cosa devi fare?' },
  { name: 'due_date', label: 'Scadenza', type: 'date', half: true },
  { name: 'priority', label: 'Priorità', type: 'select', options: PRIORITIES, required: true, half: true },
  { name: 'area', label: 'Area', type: 'select', options: AREAS, half: true },
  { name: 'estimate_min', label: 'Durata stimata (min)', type: 'number', min: 0, step: 5, half: true },
  { name: 'status', label: 'Stato', type: 'select', options: [{ value: 'todo', label: 'Da fare' }, { value: 'doing', label: 'In corso' }, { value: 'done', label: 'Fatto' }], required: true, half: true },
  { name: 'goal_id', label: 'Obiettivo collegato', type: 'select', options: goals.map((g) => ({ value: g.id, label: g.title })), half: true },
  { name: 'notes', label: 'Note', type: 'textarea', rows: 3 },
];

export const eventFields: FieldSpec[] = [
  { name: 'title', label: 'Titolo', required: true },
  { name: 'date', label: 'Data', type: 'date', required: true, half: true },
  { name: 'category', label: 'Categoria', type: 'select', options: AREAS, half: true },
  { name: 'start_time', label: 'Inizio', type: 'time', half: true },
  { name: 'end_time', label: 'Fine', type: 'time', half: true },
  { name: 'location', label: 'Luogo' },
  { name: 'notes', label: 'Note', type: 'textarea', rows: 3 },
];

export const reminderFields: FieldSpec[] = [
  { name: 'title', label: 'Promemoria', required: true },
  { name: 'remind_at', label: 'Quando', type: 'datetime', required: true, half: true },
  {
    name: 'repeat',
    label: 'Ripeti',
    type: 'select',
    required: true,
    half: true,
    options: [
      { value: 'none', label: 'Mai' },
      { value: 'daily', label: 'Ogni giorno' },
      { value: 'weekly', label: 'Ogni settimana' },
      { value: 'monthly', label: 'Ogni mese' },
    ],
  },
  { name: 'notes', label: 'Note', type: 'textarea', rows: 2 },
];

export const transactionFields = (type: 'income' | 'expense', categories: string[] = []): FieldSpec[] => [
  { name: 'type', label: 'Tipo', type: 'select', required: true, half: true, options: [{ value: 'expense', label: 'Uscita' }, { value: 'income', label: 'Entrata' }] },
  { name: 'amount', label: 'Importo', type: 'number', step: 0.01, min: 0, required: true, half: true },
  { name: 'date', label: 'Data', type: 'date', required: true, half: true },
  {
    name: 'category',
    label: 'Categoria',
    half: true,
    suggestions: [...new Set([...(type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES), ...categories])],
  },
  { name: 'description', label: 'Descrizione' },
  { name: 'account', label: 'Conto', suggestions: ['Principale', 'Contanti', 'Carta di credito', 'Risparmi'] },
];

export const goalFields: FieldSpec[] = [
  { name: 'title', label: 'Obiettivo', required: true },
  { name: 'area', label: 'Area', type: 'select', options: AREAS, half: true },
  { name: 'status', label: 'Stato', type: 'select', options: ['attivo', 'in pausa', 'completato'], required: true, half: true },
  { name: 'target_date', label: 'Scadenza', type: 'date', half: true },
  { name: 'progress', label: 'Progresso manuale (%)', type: 'number', min: 0, step: 5, half: true },
  { name: 'metric_current', label: 'Valore attuale', type: 'number', step: 0.1, half: true },
  { name: 'metric_target', label: 'Valore obiettivo', type: 'number', step: 0.1, half: true },
  { name: 'unit', label: 'Unità (es. kg, €, follower)', half: true },
  { name: 'description', label: 'Perché è importante / descrizione', type: 'textarea', rows: 3 },
];

export const mealFields: FieldSpec[] = [
  { name: 'description', label: 'Cosa hai mangiato', required: true },
  { name: 'date', label: 'Data', type: 'date', required: true, half: true },
  { name: 'meal_type', label: 'Pasto', type: 'select', options: MEAL_TYPES, required: true, half: true },
  { name: 'calories', label: 'Calorie (kcal)', type: 'number', min: 0, half: true },
  { name: 'protein', label: 'Proteine (g)', type: 'number', min: 0, step: 0.1, half: true },
  { name: 'carbs', label: 'Carboidrati (g)', type: 'number', min: 0, step: 0.1, half: true },
  { name: 'fat', label: 'Grassi (g)', type: 'number', min: 0, step: 0.1, half: true },
];

export const postFields: FieldSpec[] = [
  { name: 'title', label: 'Titolo / idea', required: true },
  { name: 'platform', label: 'Piattaforma', type: 'select', options: PLATFORMS, required: true, half: true },
  { name: 'status', label: 'Stato', type: 'select', options: POST_STATUSES, required: true, half: true },
  { name: 'publish_date', label: 'Data di pubblicazione', type: 'date', half: true },
  { name: 'hashtags', label: 'Hashtag', half: true },
  { name: 'hook', label: 'Hook (prime parole)', type: 'textarea', rows: 2 },
  { name: 'caption', label: 'Script / caption', type: 'textarea', rows: 6 },
  { name: 'notes', label: 'Note', type: 'textarea', rows: 2 },
  { name: 'views', label: 'Visualizzazioni', type: 'number', min: 0, half: true },
  { name: 'likes', label: 'Like', type: 'number', min: 0, half: true },
];

export const noteTypeOptions = NOTE_TYPES;
