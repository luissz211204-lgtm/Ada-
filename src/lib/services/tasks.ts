import { all, one, parseJson, toJson, newId, nowIso, run, tx, type Param } from '@/lib/db';
import { badRequest, notFound } from '@/lib/api/errors';
import { getOwned, updateOwned } from './crud';
import { audit } from './audit';
import { todayInTz, addDays, localToUtcIso } from '@/lib/time';
import { loadSettings } from '@/lib/auth/session';

export interface TaskRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  priority: number;
  status: 'pending' | 'in_progress' | 'done' | 'cancelled';
  due_date: string | null;
  due_time: string | null;
  duration_minutes: number | null;
  project_id: string | null;
  parent_task_id: string | null;
  recurrence: string | null;
  reminder_lead_minutes: number | null;
  position: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  category?: string;
  priority?: number;
  status?: TaskRow['status'];
  due_date?: string | null;
  due_time?: string | null;
  duration_minutes?: number | null;
  project_id?: string | null;
  parent_task_id?: string | null;
  recurrence?: { freq: 'daily' | 'weekly' | 'monthly'; interval?: number } | null;
  reminder_lead_minutes?: number | null;
  position?: number;
}

export interface TaskFilters {
  status?: TaskRow['status'][];
  priority?: number;
  category?: string;
  project_id?: string;
  due_before?: string;
  due_after?: string;
  search?: string;
  parent_id?: string | 'none';
  overdue?: boolean;
}

function taskActivity(taskId: string, userId: string, action: string, detail = ''): void {
  run(`INSERT INTO task_activity (id, task_id, user_id, action, detail) VALUES (?, ?, ?, ?, ?)`, [
    newId(),
    taskId,
    userId,
    action,
    detail,
  ]);
}

export function listTasks(userId: string, filters: TaskFilters = {}): TaskRow[] {
  const clauses: string[] = [];
  const params: Param[] = [];

  if (filters.status && filters.status.length > 0) {
    clauses.push(`status IN (${filters.status.map(() => '?').join(',')})`);
    params.push(...filters.status);
  }
  if (filters.priority) {
    clauses.push('priority <= ?');
    params.push(filters.priority);
  }
  if (filters.category) {
    clauses.push('category = ?');
    params.push(filters.category);
  }
  if (filters.project_id) {
    clauses.push('project_id = ?');
    params.push(filters.project_id);
  }
  if (filters.due_before) {
    clauses.push('due_date IS NOT NULL AND due_date <= ?');
    params.push(filters.due_before);
  }
  if (filters.due_after) {
    clauses.push('due_date IS NOT NULL AND due_date >= ?');
    params.push(filters.due_after);
  }
  if (filters.search) {
    clauses.push('(title LIKE ? OR description LIKE ?)');
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  if (filters.parent_id === 'none') {
    clauses.push('parent_task_id IS NULL');
  } else if (filters.parent_id) {
    clauses.push('parent_task_id = ?');
    params.push(filters.parent_id);
  }
  if (filters.overdue) {
    const today = todayInTz('America/Monterrey');
    clauses.push(`status IN ('pending','in_progress') AND due_date IS NOT NULL AND due_date < ?`);
    params.push(today);
  }

  const where = clauses.length ? `WHERE user_id = ? AND ${clauses.join(' AND ')}` : 'WHERE user_id = ?';
  return all<TaskRow>(
    `SELECT * FROM tasks ${where}
     ORDER BY
       CASE status WHEN 'done' THEN 1 WHEN 'cancelled' THEN 1 ELSE 0 END,
       priority ASC,
       due_date IS NULL, due_date ASC,
       due_time IS NULL, due_time ASC,
       position ASC, created_at ASC`,
    [userId, ...params],
  );
}

export function getTask(userId: string, id: string): TaskRow {
  return getOwned<TaskRow>('tasks', id, userId);
}

export function getTaskDetail(userId: string, id: string) {
  const task = getTask(userId, id);
  const subtasks = all<TaskRow>(
    'SELECT * FROM tasks WHERE parent_task_id = ? AND user_id = ? ORDER BY position, created_at',
    [id, userId],
  );
  const dependencies = all<{ id: string; title: string; status: string }>(
    `SELECT t.id, t.title, t.status FROM task_dependencies d
     JOIN tasks t ON t.id = d.depends_on_id
     WHERE d.task_id = ? AND t.user_id = ?`,
    [id, userId],
  );
  const dependents = all<{ id: string; title: string; status: string }>(
    `SELECT t.id, t.title, t.status FROM task_dependencies d
     JOIN tasks t ON t.id = d.task_id
     WHERE d.depends_on_id = ? AND t.user_id = ?`,
    [id, userId],
  );
  const activity = all<{
    id: string;
    action: string;
    detail: string;
    created_at: string;
  }>(
    'SELECT id, action, detail, created_at FROM task_activity WHERE task_id = ? ORDER BY created_at DESC LIMIT 50',
    [id],
  );
  const project = task.project_id
    ? one<{ id: string; name: string; status: string }>(
        'SELECT id, name, status FROM projects WHERE id = ? AND user_id = ?',
        [task.project_id, userId],
      )
    : null;
  return { ...task, subtasks, dependencies, dependents, activity, project };
}

export function createTask(
  userId: string,
  input: CreateTaskInput,
  meta: { source?: 'user' | 'assistant'; ip?: string; skipAudit?: boolean } = {},
): TaskRow {
  if (!input.title || !input.title.trim()) throw badRequest('La tarea necesita un título.');
  if (input.project_id) getOwned('projects', input.project_id, userId);
  if (input.parent_task_id) getOwned('tasks', input.parent_task_id, userId);

  const row = insertTaskRow({
    user_id: userId,
    title: input.title.trim(),
    description: input.description?.trim() || '',
    category: input.category || 'general',
    priority: input.priority ?? 2,
    status: input.status || 'pending',
    due_date: input.due_date ?? null,
    due_time: input.due_time ?? null,
    duration_minutes: input.duration_minutes ?? null,
    project_id: input.project_id ?? null,
    parent_task_id: input.parent_task_id ?? null,
    recurrence: input.recurrence ? toJson(input.recurrence) : null,
    reminder_lead_minutes: input.reminder_lead_minutes ?? null,
    position: input.position ?? 0,
  });

  taskActivity(row.id, userId, input.parent_task_id ? 'subtask_created' : 'created', meta.source === 'assistant' ? 'Creada por el asistente' : '');
  if (!meta.skipAudit) {
    audit({
      userId,
      action: 'data.create',
      entity: 'task',
      entityId: row.id,
      detail: { source: meta.source ?? 'user' },
      ip: meta.ip,
    });
  }
  syncTaskReminder(userId, row);
  return row;
}

function insertTaskRow(data: Record<string, unknown>): TaskRow {
  // SQLite permite NULL en una columna PRIMARY KEY que no sea INTEGER, así que
  // el identificador se genera siempre aquí (nunca se deja al azar).
  const withId: Record<string, unknown> = { id: newId(), ...data };
  const keys = Object.keys(withId);
  const sql = `INSERT INTO tasks (${keys.join(', ')}, created_at, updated_at)
               VALUES (${keys.map(() => '?').join(', ')}, ?, ?) RETURNING *`;
  const row = one<TaskRow>(sql, [
    ...(keys.map((k) => withId[k]) as Param[]),
    nowIso(),
    nowIso(),
  ]);
  if (!row) throw new Error('No se pudo crear la tarea.');
  return row;
}

const UPDATABLE = new Set([
  'title',
  'description',
  'category',
  'priority',
  'status',
  'due_date',
  'due_time',
  'duration_minutes',
  'project_id',
  'parent_task_id',
  'recurrence',
  'reminder_lead_minutes',
  'position',
  'completed_at',
]);

export function updateTask(
  userId: string,
  id: string,
  patch: Partial<CreateTaskInput> & { status?: TaskRow['status'] },
  meta: { source?: 'user' | 'assistant'; ip?: string } = {},
): TaskRow {
  const before = getTask(userId, id);
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (!UPDATABLE.has(k)) continue;
    clean[k] = k === 'recurrence' ? (v ? toJson(v) : null) : (v as Param);
  }
  if ('project_id' in clean && clean.project_id) getOwned('projects', String(clean.project_id), userId);
  if (clean.title !== undefined && !String(clean.title).trim()) throw badRequest('El título no puede estar vacío.');
  if (clean.status === 'done' && !clean.completed_at) clean.completed_at = nowIso();
  if (clean.status && clean.status !== 'done') clean.completed_at = null;

  const after = updateOwned<TaskRow>('tasks', id, userId, clean);

  const changes: string[] = [];
  for (const k of Object.keys(clean)) {
    const b = (before as unknown as Record<string, unknown>)[k];
    const a = (after as unknown as Record<string, unknown>)[k];
    if (String(b ?? '') !== String(a ?? '')) changes.push(`${k}: ${String(b ?? '—')} → ${String(a ?? '—')}`);
  }
  if (changes.length) taskActivity(id, userId, 'updated', changes.join('\n'));
  audit({
    userId,
    action: 'data.update',
    entity: 'task',
    entityId: id,
    detail: { changes: changes.length, source: meta.source ?? 'user' },
    ip: meta.ip,
  });
  syncTaskReminder(userId, after);
  return after;
}

export function completeTask(userId: string, id: string, meta: { source?: 'user' | 'assistant' } = {}) {
  const task = getTask(userId, id);
  if (task.status === 'done') return { task, next: null };

  // Validación de dependencias: no completar si una dependencia sigue abierta.
  const pendingDeps = all<{ title: string }>(
    `SELECT t.title FROM task_dependencies d JOIN tasks t ON t.id = d.depends_on_id
     WHERE d.task_id = ? AND t.user_id = ? AND t.status NOT IN ('done','cancelled')`,
    [id, userId],
  );
  if (pendingDeps.length > 0) {
    throw badRequest(
      `Tareas pendientes antes de completar esta: ${pendingDeps.map((d) => d.title).join(', ')}`,
    );
  }

  const done = updateOwned<TaskRow>('tasks', id, userId, {
    status: 'done',
    completed_at: nowIso(),
  });
  taskActivity(id, userId, 'completed', '');

  // Avance de recurrencia: crea la siguiente ocurrencia.
  let next: TaskRow | null = null;
  const recurrence = parseJson<{ freq: string; interval?: number } | null>(task.recurrence, null);
  if (recurrence && task.due_date) {
    const interval = recurrence.interval && recurrence.interval > 0 ? recurrence.interval : 1;
    const step = recurrence.freq === 'daily' ? interval : recurrence.freq === 'weekly' ? 7 * interval : 30 * interval;
    const newDue = addDays(task.due_date, step);
    next = insertTaskRow({
      user_id: userId,
      title: task.title,
      description: task.description,
      category: task.category,
      priority: task.priority,
      status: 'pending',
      due_date: newDue,
      due_time: task.due_time,
      duration_minutes: task.duration_minutes,
      project_id: task.project_id,
      parent_task_id: task.parent_task_id,
      recurrence: task.recurrence,
      reminder_lead_minutes: task.reminder_lead_minutes,
      position: task.position,
    });
    taskActivity(next.id, userId, 'created', `Siguiente ocurrencia de la tarea recurrente (${recurrence.freq}).`);
    syncTaskReminder(userId, next);
  }

  audit({ userId, action: 'data.update', entity: 'task', entityId: id, detail: { completed: true } });
  return { task: done, next };
}

export function reopenTask(userId: string, id: string): TaskRow {
  getTask(userId, id);
  const task = updateOwned<TaskRow>('tasks', id, userId, { status: 'pending', completed_at: null });
  taskActivity(id, userId, 'reopened', '');
  return task;
}

export function deleteTask(userId: string, id: string): void {
  getTask(userId, id);
  run(
    `UPDATE reminders SET status = 'cancelled', updated_at = ?
     WHERE user_id = ? AND related_type = 'task' AND related_id = ?`,
    [nowIso(), userId, id],
  );
  run('DELETE FROM tasks WHERE id = ? AND user_id = ?', [id, userId]);
  audit({ userId, action: 'data.delete', entity: 'task', entityId: id });
}

/** Crea/actualiza el recordatorio asociado a una tarea con fecha. */
function syncTaskReminder(userId: string, task: TaskRow): void {
  if (!task.due_date || task.reminder_lead_minutes === null || task.status !== 'pending') {
    run(
      `UPDATE reminders SET status = 'cancelled', updated_at = ?
       WHERE user_id = ? AND related_type = 'task' AND related_id = ? AND status IN ('scheduled','snoozed')`,
      [nowIso(), userId, task.id],
    );
    return;
  }
  const tz = loadSettings(userId)?.timezone || 'America/Monterrey';
  const dueIso = localToUtcIso(task.due_date, task.due_time || '09:00', tz);
  const remindAt = new Date(new Date(dueIso).getTime() - task.reminder_lead_minutes * 60000).toISOString();
  const existing = one<{ id: string }>(
    `SELECT id FROM reminders WHERE user_id = ? AND related_type = 'task' AND related_id = ? AND status IN ('scheduled','snoozed')`,
    [userId, task.id],
  );
  if (existing) {
    run('UPDATE reminders SET title = ?, remind_at = ?, updated_at = ? WHERE id = ?', [
      `Tarea: ${task.title}`,
      remindAt,
      nowIso(),
      existing.id,
    ]);
  } else {
    run(
      `INSERT INTO reminders (id, user_id, title, message, remind_at, timezone, related_type, related_id, priority, channels)
       VALUES (?, ?, ?, ?, ?, 'America/Monterrey', 'task', ?, ?, '["web"]')`,
      [newId(), userId, `Tarea: ${task.title}`, task.description || '', remindAt, task.id, task.priority],
    );
  }
}

// ---------- Dependencias ----------

export function setDependencies(userId: string, taskId: string, dependsOnIds: string[]): void {
  getTask(userId, taskId);
  for (const dep of dependsOnIds) {
    if (dep === taskId) throw badRequest('Una tarea no puede depender de sí misma.');
    getTask(userId, dep);
  }
  tx(() => {
    run('DELETE FROM task_dependencies WHERE task_id = ?', [taskId]);
    for (const dep of dependsOnIds) {
      run('INSERT INTO task_dependencies (task_id, depends_on_id) VALUES (?, ?)', [taskId, dep]);
    }
  });
  taskActivity(taskId, userId, 'dependencies_updated', dependsOnIds.join(', '));
}

// ---------- Bandeja de entrada (inbox) ----------

export interface InboxRow {
  id: string;
  user_id: string;
  content: string;
  source: string;
  status: 'pending' | 'converted' | 'discarded';
  converted_task_id: string | null;
  created_at: string;
  updated_at: string;
}

export function inboxList(userId: string, status = 'pending'): InboxRow[] {
  return all<InboxRow>(
    'SELECT * FROM inbox_items WHERE user_id = ? AND status = ? ORDER BY created_at DESC',
    [userId, status],
  );
}

export function inboxAdd(userId: string, content: string, source: InboxRow['source'] = 'manual'): InboxRow {
  if (!content.trim()) throw badRequest('El elemento de la bandeja está vacío.');
  const row = one<InboxRow>(
    `INSERT INTO inbox_items (id, user_id, content, source) VALUES (?, ?, ?, ?) RETURNING *`,
    [newId(), userId, content.trim(), source],
  );
  if (!row) throw new Error('No se pudo añadir a la bandeja.');
  audit({ userId, action: 'data.create', entity: 'inbox_item', entityId: row.id });
  return row;
}

export function inboxConvert(
  userId: string,
  id: string,
  taskInput: Omit<CreateTaskInput, 'title'> & { title?: string },
): { item: InboxRow; task: TaskRow } {
  const item = getOwned<InboxRow>('inbox_items', id, userId);
  if (item.status !== 'pending') throw badRequest('Este elemento ya fue procesado.');
  const task = createTask(userId, {
    ...taskInput,
    title: taskInput.title || item.content.slice(0, 120),
  });
  const updated = updateOwned<InboxRow>('inbox_items', id, userId, {
    status: 'converted',
    converted_task_id: task.id,
  });
  return { item: updated, task };
}

export function inboxDiscard(userId: string, id: string): InboxRow {
  const item = getOwned<InboxRow>('inbox_items', id, userId);
  if (item.status !== 'pending') throw badRequest('Este elemento ya fue procesado.');
  return updateOwned<InboxRow>('inbox_items', id, userId, { status: 'discarded' });
}

// ---------- Resumen para dashboard y asistente ----------

export function taskSummary(userId: string, tz: string) {
  const today = todayInTz(tz);
  const tasks = listTasks(userId, { status: ['pending', 'in_progress'] });
  const overdue = tasks.filter((t) => t.due_date && t.due_date < today);
  const dueToday = tasks.filter((t) => t.due_date === today);
  const highPriority = tasks.filter((t) => t.priority <= 2 && !t.due_date);
  return {
    today,
    overdue: overdue.slice(0, 20),
    dueToday: dueToday.slice(0, 20),
    highPriorityWithoutDate: highPriority.slice(0, 10),
    totals: {
      open: tasks.length,
      overdue: overdue.length,
      dueToday: dueToday.length,
      doneToday: all<{ c: number }>(
        `SELECT COUNT(*) AS c FROM tasks WHERE user_id = ? AND status = 'done' AND completed_at LIKE ?`,
        [userId, `${today}%`],
      )[0]?.c ?? 0,
    },
  };
}
