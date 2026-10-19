export type Task = {
  id: string;
  title: string;
  status: string;
  priority: number;
  due_date: string | null;
  due_time: string | null;
  project_id: string | null;
  description?: string;
  category?: string;
};

export type Reminder = {
  id: string;
  title: string;
  remind_at: string;
  status: string;
  priority: number;
  channels?: unknown;
};

export type Delivery = {
  id: string;
  reminder_id: string | null;
  title: string;
  body: string;
  priority: number;
  scheduled_for: string;
  status: string;
  created_at: string;
};

export type Project = {
  id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  goal: string;
  start_date: string | null;
  due_date: string | null;
  progress: number;
  open_tasks?: number;
  done_tasks?: number;
  tasks?: any[];
  milestones?: any[];
  notes?: any[];
  documents?: any[];
  decisions?: any[];
};

export type Note = {
  id: string;
  title: string;
  content: string;
  category: string;
  pinned: number | boolean;
  project_id: string | null;
  updated_at: string;
};

export type Memory = {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  confirmed: number | boolean;
  source: string;
  created_at: string;
};

export type CalendarEvent = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  all_day: number | boolean;
  project_id: string | null;
  location?: string;
};

export type AgendaDay = {
  date: string;
  events: CalendarEvent[];
};

export type Goal = {
  id: string;
  title: string;
  motivation: string;
  category: string;
  status: string;
  progress: number;
  target_date: string | null;
};

export type Habit = {
  id: string;
  name: string;
  frequency: string;
  category: string;
  active: number | boolean;
  last_log_at: string | null;
  streak_days: number;
};

export type Transaction = {
  id: string;
  type: 'income' | 'expense';
  amount_cents: number;
  description: string;
  category: string;
  txn_date: string;
  project_id: string | null;
};

export type Debt = {
  id: string;
  name: string;
  total_cents: number;
  remaining_cents: number;
  due_day: number | null;
  creditor: string;
};

export type SavingsGoal = {
  id: string;
  name: string;
  target_cents: number;
  current_cents: number;
  target_date: string | null;
};

export type Budget = {
  id: string;
  category: string;
  month: string;
  amount_cents: number;
  spent_cents: number;
};

export type Workout = {
  id: string;
  name: string;
  description: string;
  active: number | boolean;
  exercises?: any[];
};

export type WorkoutLog = {
  id: string;
  workout_id: string | null;
  workout_name: string;
  performed_at: string;
  duration_minutes: number;
  notes: string;
};

export type Measurement = {
  id: string;
  measured_at: string;
  weight_kg: number | null;
  waist_cm: number | null;
  notes: string;
};

export type Recipe = {
  id: string;
  name: string;
  ingredients: string[];
  instructions: string;
  prep_minutes: number | null;
  servings: number | null;
  tags: string[];
};

export type Meal = {
  id: string;
  meal_type: string;
  name: string;
  meal_date: string;
  calories_estimate: number | null;
  notes: string;
  recipe_id: string | null;
};

export type ShoppingList = {
  id: string;
  name: string;
  items?: any[];
};

export type ShoppingItem = {
  id: string;
  name: string;
  quantity: string;
  checked: number | boolean;
};

export type NutritionSummary = {
  caloriesByMeal: Record<string, number>;
  totalCalories: number;
  mealCount: number;
};

export type WorkClient = {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
};

export type WorkOrder = {
  id: string;
  title: string;
  status: string;
  quote_cents: number | null;
  due_date: string | null;
  client_id: string | null;
  items?: any[];
};

export type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  min_quantity: number;
  low: boolean;
};

export type Document = {
  id: string;
  name: string;
  mime_type: string;
  size_bytes: number;
  folder: string;
  project_id: string | null;
  created_at: string;
};

export type Integration = {
  provider: string;
  status: string;
  configured: boolean;
  connected: boolean;
};

export type InboxItem = {
  id: string;
  content: string;
  status: string;
  created_at: string;
  converted_task_id: string | null;
};

export type Approval = {
  id: string;
  tool: string;
  reason: string;
  status: string;
  risk: number;
  proposed_input: unknown;
  decided_at: string | null;
  decided_by: string | null;
};

export type Conversation = {
  id: string;
  title: string;
  model: string;
  created_at: string;
};

export type AssistantMessage = {
  role: string;
  content: string;
  toolCalls?: any[];
};