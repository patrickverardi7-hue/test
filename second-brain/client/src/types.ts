export interface Base {
  id: number;
  created_at: string;
  updated_at: string;
}
export interface Task extends Base {
  title: string;
  notes: string | null;
  status: 'todo' | 'doing' | 'done';
  priority: number;
  due_date: string | null;
  area: string | null;
  goal_id: number | null;
  estimate_min: number | null;
  completed_at: string | null;
}
export interface EventItem extends Base {
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  category: string | null;
  notes: string | null;
  task_id: number | null;
}
export interface Reminder extends Base {
  title: string;
  remind_at: string;
  repeat: 'none' | 'daily' | 'weekly' | 'monthly';
  done: boolean;
  notes: string | null;
}
export interface Transaction extends Base {
  date: string;
  amount: number;
  type: 'income' | 'expense';
  category: string | null;
  account: string | null;
  description: string | null;
}
export interface Budget extends Base {
  category: string;
  monthly_limit: number;
}
export interface Milestone {
  text: string;
  done: boolean;
}
export interface Goal extends Base {
  title: string;
  description: string | null;
  area: string | null;
  status: 'attivo' | 'completato' | 'in pausa';
  target_date: string | null;
  progress: number | null;
  metric_current: number | null;
  metric_target: number | null;
  unit: string | null;
  milestones: Milestone[] | null;
}
export interface Habit extends Base {
  name: string;
  icon: string | null;
  color: string | null;
  archived: boolean;
}
export interface HabitOverview extends Habit {
  doneToday: boolean;
  last7: { date: string; done: boolean }[];
  streak: number;
  rate30: number;
}
export interface Note extends Base {
  title: string;
  content: string;
  type: string;
  tags: string;
  pinned: boolean;
}
export interface Meal extends Base {
  date: string;
  meal_type: string;
  description: string;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}
export interface Exercise {
  name: string;
  sets: number | null;
  reps: number | null;
  weight: number | null;
}
export interface Workout extends Base {
  date: string;
  title: string;
  type: string;
  duration_min: number | null;
  calories: number | null;
  exercises: Exercise[] | null;
  notes: string | null;
}
export interface SocialPost extends Base {
  title: string;
  platform: string;
  status: string;
  publish_date: string | null;
  hook: string | null;
  caption: string | null;
  hashtags: string | null;
  notes: string | null;
  views: number | null;
  likes: number | null;
  format: string | null;
  pillar: string | null;
  score: number | null;
  duration_sec: number | null;
  shot_list: string | null;
  thumbnail_idea: string | null;
  inspiration: string | null;
  source: string | null;
}
export interface Feed extends Base {
  name: string;
  url: string;
  category: string;
  enabled: boolean;
}
export interface Settings {
  name: string;
  currency: string;
  calorie_target: number;
  protein_target: number;
  carbs_target: number;
  fat_target: number;
  workouts_per_week: number;
  social_niche: string;
}
export interface FinanceSummary {
  month: string;
  income: number;
  expense: number;
  net: number;
  totalBalance: number;
  byCategory: { category: string; total: number }[];
  budgets: { id: number; category: string; monthly_limit: number; spent: number }[];
  trend: { month: string; income: number; expense: number }[];
}
export interface NutritionDay {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  meals: number;
  targets: { calories: number; protein: number; carbs: number; fat: number };
}
export interface Dashboard {
  date: string;
  settings: Settings;
  tasks: Task[];
  tasksDoneToday: number;
  events: EventItem[];
  upcoming: EventItem[];
  reminders: Reminder[];
  habits: HabitOverview[];
  finance: FinanceSummary;
  nutrition: NutritionDay;
  workouts: { from: string; to: string; count: number; minutes: number; target: number };
  goals: Goal[];
  social: SocialPost[];
  notes: Note[];
  inboxCount: number;
}

export function goalProgress(g: Goal): number {
  const ms = g.milestones ?? [];
  if (ms.length) return Math.round((ms.filter((m) => m.done).length / ms.length) * 100);
  if (g.metric_target) return Math.min(100, Math.round(((g.metric_current ?? 0) / g.metric_target) * 100));
  return g.progress ?? 0;
}

export interface BodyMetric extends Base {
  date: string;
  weight: number | null;
  body_fat: number | null;
  waist: number | null;
  notes: string | null;
}
export interface Ingredient {
  name: string;
  quantity: number | null;
  unit: string | null;
}
export interface PlanMeal extends Base {
  weekday: number;
  meal_type: string;
  title: string;
  ingredients: Ingredient[] | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  notes: string | null;
}
export interface PantryItem extends Base {
  name: string;
  quantity: number;
  unit: string;
  category: string | null;
  min_quantity: number | null;
  expires_on: string | null;
  notes: string | null;
}
export interface ShoppingItem extends Base {
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  checked: boolean;
  source: 'manuale' | 'piano' | 'scorta';
  notes: string | null;
}
export interface ExerciseProgress {
  name: string;
  sessionsCount: number;
  lastDate: string;
  prWeight: number;
  prReps: number;
  prDate: string;
  best1rm: number;
  first1rm: number;
  last1rm: number;
  changePct: number | null;
  history: { date: string; weight: number; reps: number; sets: number; e1rm: number; volume: number }[];
}
export interface WorkoutProgress {
  exercises: ExerciseProgress[];
  weekly: { week: string; sessions: number; minutes: number; volume: number }[];
  body: { date: string; weight: number | null; body_fat: number | null; waist: number | null }[];
}
