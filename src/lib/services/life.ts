import { all, one, newId, nowIso, run } from '@/lib/db';
import { badRequest } from '@/lib/api/errors';
import { getOwned, updateOwned, deleteOwned } from './crud';
import { audit } from './audit';
import { todayInTz, addDays } from '@/lib/time';

/** Vida personal: objetivos, hitos, avances, hábitos y cumplimiento. */

export interface GoalRow {
  id: string;
  user_id: string;
  title: string;
  motivation: string;
  category: string;
  target_date: string | null;
  status: 'active' | 'paused' | 'done' | 'cancelled';
  progress: number;
  indicators: string | null;
  target_amount_cents: number | null;
  created_at: string;
  updated_at: string;
}

export const GOAL_CATEGORIES = ['personal', 'salud', 'finanzas', 'trabajo', 'estudios', 'otro'];

export function listGoals(userId: string, status?: string) {
  const goals = status
    ? all<GoalRow>('SELECT * FROM goals WHERE user_id = ? AND status = ? ORDER BY target_date IS NULL, target_date', [userId, status])
    : all<GoalRow>('SELECT * FROM goals WHERE user_id = ? ORDER BY status, target_date IS NULL, target_date', [userId]);
  return goals.map((g) => ({
    ...g,
    milestones: all<{ id: string; title: string; status: string; due_date: string | null }>(
      'SELECT id, title, status, due_date FROM goal_milestones WHERE goal_id = ? AND user_id = ? ORDER BY due_date IS NULL, due_date',
      [g.id, userId],
    ),
  }));
}

export function createGoal(
  userId: string,
  input: {
    title: string;
    motivation?: string;
    category?: string;
    target_date?: string | null;
    indicators?: string[];
    target_amount?: number;
  },
) {
  if (!input.title?.trim()) throw badRequest('El objetivo necesita un título.');
  const row = one<GoalRow>(
    `INSERT INTO goals (id, user_id, title, motivation, category, target_date, indicators, target_amount_cents)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [
      newId(),
      userId,
      input.title.trim(),
      input.motivation || '',
      GOAL_CATEGORIES.includes(input.category || '') ? input.category! : 'personal',
      input.target_date ?? null,
      input.indicators ? JSON.stringify(input.indicators) : null,
      input.target_amount !== undefined ? Math.round(input.target_amount * 100) : null,
    ],
  );
  audit({ userId, action: 'data.create', entity: 'goal', entityId: row!.id });
  return row;
}

export function updateGoal(userId: string, id: string, patch: Record<string, unknown>) {
  getOwned('goals', id, userId);
  const clean: Record<string, unknown> = {};
  for (const key of ['title', 'motivation', 'category', 'target_date', 'status', 'progress']) {
    if (patch[key] !== undefined) clean[key] = patch[key] as never;
  }
  if (clean.progress !== undefined) clean.progress = Math.max(0, Math.min(100, Number(clean.progress)));
  return updateOwned<GoalRow>('goals', id, userId, clean);
}

export function deleteGoal(userId: string, id: string): void {
  deleteOwned('goals', id, userId);
  audit({ userId, action: 'data.delete', entity: 'goal', entityId: id });
}

export function addGoalMilestone(userId: string, goalId: string, input: { title: string; due_date?: string | null }) {
  getOwned('goals', goalId, userId);
  if (!input.title?.trim()) throw badRequest('El hito necesita un título.');
  return one(
    `INSERT INTO goal_milestones (id, goal_id, user_id, title, due_date) VALUES (?, ?, ?, ?, ?) RETURNING *`,
    [newId(), goalId, userId, input.title.trim(), input.due_date ?? null],
  );
}

export function logGoalProgress(userId: string, goalId: string, note: string, progress?: number) {
  getOwned('goals', goalId, userId);
  if (!note?.trim()) throw badRequest('El avance necesita una nota.');
  const row = one(
    `INSERT INTO goal_progress_logs (id, goal_id, user_id, note, progress) VALUES (?, ?, ?, ?, ?) RETURNING *`,
    [newId(), goalId, userId, note.trim(), progress ?? null],
  );
  if (progress !== undefined) {
    updateOwned('goals', goalId, userId, { progress: Math.max(0, Math.min(100, progress)) });
  }
  return row;
}

export function goalHistory(userId: string, goalId: string) {
  getOwned('goals', goalId, userId);
  return all(
    'SELECT id, note, progress, created_at FROM goal_progress_logs WHERE goal_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 100',
    [goalId, userId],
  );
}

// ---------------- Hábitos ----------------

export interface HabitRow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  category: string;
  frequency: 'daily' | 'weekly';
  target_per_week: number;
  active: number;
  created_at: string;
  updated_at: string;
}

export function listHabits(userId: string, tz: string, includeInactive = false) {
  const habits = includeInactive
    ? all<HabitRow>('SELECT * FROM habits WHERE user_id = ? ORDER BY active DESC, name', [userId])
    : all<HabitRow>('SELECT * FROM habits WHERE user_id = ? AND active = 1 ORDER BY name', [userId]);
  const today = todayInTz(tz);
  const weekStart = addDays(today, -6);
  return habits.map((h) => {
    const doneToday = one<{ c: number }>(
      'SELECT COUNT(*) AS c FROM habit_logs WHERE habit_id = ? AND user_id = ? AND log_date = ? AND done = 1',
      [h.id, userId, today],
    );
    const weekCount = one<{ c: number }>(
      `SELECT COUNT(*) AS c FROM habit_logs WHERE habit_id = ? AND user_id = ? AND done = 1 AND log_date >= ?`,
      [h.id, userId, weekStart],
    )?.c ?? 0;
    return {
      ...h,
      completedToday: Number(doneToday?.c ?? 0) > 0,
      weekCount: Number(weekCount),
      target: h.target_per_week,
      compliance: Math.min(100, Math.round((Number(weekCount) / h.target_per_week) * 100)),
    };
  });
}

export function createHabit(
  userId: string,
  input: { name: string; description?: string; category?: string; frequency?: 'daily' | 'weekly'; target_per_week?: number },
) {
  if (!input.name?.trim()) throw badRequest('El hábito necesita un nombre.');
  return one<HabitRow>(
    `INSERT INTO habits (id, user_id, name, description, category, frequency, target_per_week)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [
      newId(),
      userId,
      input.name.trim(),
      input.description || '',
      input.category || 'general',
      input.frequency === 'weekly' ? 'weekly' : 'daily',
      Math.min(7, Math.max(1, input.target_per_week ?? 7)),
    ],
  );
}

export function updateHabit(userId: string, id: string, patch: Record<string, unknown>) {
  getOwned('habits', id, userId);
  const clean: Record<string, unknown> = {};
  for (const key of ['name', 'description', 'category', 'frequency', 'target_per_week', 'active']) {
    if (patch[key] !== undefined) clean[key] = patch[key] as never;
  }
  if (clean.target_per_week !== undefined) clean.target_per_week = Math.min(7, Math.max(1, Number(clean.target_per_week)));
  if (clean.active !== undefined) clean.active = clean.active ? 1 : 0;
  return updateOwned<HabitRow>('habits', id, userId, clean);
}

export function deleteHabit(userId: string, id: string): void {
  deleteOwned('habits', id, userId);
}

/** Marca/desmarca el hábito para una fecha local (por defecto hoy). */
export function toggleHabitLog(userId: string, habitId: string, date: string | undefined, tz: string) {
  getOwned('habits', habitId, userId);
  const logDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayInTz(tz);
  const existing = one<{ id: string; done: number }>(
    'SELECT id, done FROM habit_logs WHERE habit_id = ? AND user_id = ? AND log_date = ?',
    [habitId, userId, logDate],
  );
  if (existing) {
    const newDone = existing.done === 1 ? 0 : 1;
    run('UPDATE habit_logs SET done = ? WHERE id = ?', [newDone, existing.id]);
    return { date: logDate, done: newDone === 1 };
  }
  const id = newId();
  run(
    'INSERT INTO habit_logs (id, habit_id, user_id, log_date, done) VALUES (?, ?, ?, ?, 1)',
    [id, habitId, userId, logDate],
  );
  return { date: logDate, done: true };
}

export function habitStreak(userId: string, habitId: string, tz: string): number {
  const logs = all<{ log_date: string; done: number }>(
    'SELECT log_date, done FROM habit_logs WHERE habit_id = ? AND user_id = ? ORDER BY log_date DESC LIMIT 120',
    [habitId, userId],
  );
  const doneDates = new Set(logs.filter((l) => l.done === 1).map((l) => l.log_date));
  let streak = 0;
  let cursor = todayInTz(tz);
  while (doneDates.has(cursor) && streak < 120) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export function routinesSummary(userId: string, tz: string) {
  const habits = listHabits(userId, tz);
  return {
    total: habits.length,
    pendingToday: habits.filter((h) => !h.completedToday).map((h) => ({ id: h.id, name: h.name })),
    completedToday: habits.filter((h) => h.completedToday).length,
    weeklyCompliance: habits.length
      ? Math.round(habits.reduce((acc, h) => acc + h.compliance, 0) / habits.length)
      : 0,
  };
}

export function personalReview(userId: string, tz: string, period: 'day' | 'week') {
  const goals = listGoals(userId, 'active');
  const habits = listHabits(userId, tz);
  const today = todayInTz(tz);
  const since = period === 'week' ? addDays(today, -7) : today;
  const tasksDone = all<{ title: string; completed_at: string }>(
    `SELECT title, completed_at FROM tasks WHERE user_id = ? AND status = 'done' AND substr(completed_at,1,10) >= ?
     ORDER BY completed_at DESC LIMIT 50`,
    [userId, since],
  );
  return {
    period,
    since,
    goalsActive: goals.length,
    habitsPending: habits.filter((h) => !h.completedToday).length,
    tasksCompleted: tasksDone.length,
    tasksCompletedList: tasksDone,
  };
}
