import { all, one, newId, nowIso, run } from '@/lib/db';
import { badRequest } from '@/lib/api/errors';
import { getOwned, updateOwned, deleteOwned } from './crud';
import { audit } from './audit';

export interface ProjectRow {
  id: string;
  user_id: string;
  name: string;
  description: string;
  category: string;
  status: 'planning' | 'active' | 'paused' | 'done' | 'archived';
  goal: string;
  start_date: string | null;
  due_date: string | null;
  progress: number;
  created_at: string;
  updated_at: string;
}

export const PROJECT_CATEGORIES = ['personal', 'universidad', 'trabajo', 'negocio', 'salud', 'otro'];
export const PROJECT_STATUSES = ['planning', 'active', 'paused', 'done', 'archived'];

export function listProjects(userId: string, opts: { status?: string; category?: string } = {}) {
  const clauses = ['user_id = ?'];
  const params: string[] = [userId];
  if (opts.status) {
    clauses.push('status = ?');
    params.push(opts.status);
  }
  if (opts.category) {
    clauses.push('category = ?');
    params.push(opts.category);
  }
  const projects = all<ProjectRow>(
    `SELECT * FROM projects WHERE ${clauses.join(' AND ')} ORDER BY status, due_date IS NULL, due_date`,
    params,
  );
  return projects.map((p) => ({
    ...p,
    open_tasks: Number(
      one<{ c: number }>(
        `SELECT COUNT(*) AS c FROM tasks WHERE project_id = ? AND user_id = ? AND status IN ('pending','in_progress')`,
        [p.id, userId],
      )?.c ?? 0,
    ),
    done_tasks: Number(
      one<{ c: number }>(
        `SELECT COUNT(*) AS c FROM tasks WHERE project_id = ? AND user_id = ? AND status = 'done'`,
        [p.id, userId],
      )?.c ?? 0,
    ),
  }));
}

export function getProject(userId: string, id: string): ProjectRow {
  return getOwned<ProjectRow>('projects', id, userId);
}

export function getProjectDetail(userId: string, id: string) {
  const project = getProject(userId, id);
  const milestones = all<{ id: string; title: string; due_date: string | null; status: string; position: number }>(
    'SELECT id, title, due_date, status, position FROM project_milestones WHERE project_id = ? AND user_id = ? ORDER BY position, created_at',
    [id, userId],
  );
  const tasks = all<{ id: string; title: string; status: string; priority: number; due_date: string | null }>(
    'SELECT id, title, status, priority, due_date FROM tasks WHERE project_id = ? AND user_id = ? ORDER BY status, priority',
    [id, userId],
  );
  const decisions = all<{ id: string; title: string; content: string; decided_at: string }>(
    'SELECT id, title, content, decided_at FROM project_decisions WHERE project_id = ? AND user_id = ? ORDER BY decided_at DESC LIMIT 30',
    [id, userId],
  );
  const notes = all<{ id: string; title: string; category: string; updated_at: string }>(
    'SELECT id, title, category, updated_at FROM notes WHERE project_id = ? AND user_id = ? ORDER BY updated_at DESC LIMIT 30',
    [id, userId],
  );
  const documents = all<{ id: string; name: string; mime_type: string; size_bytes: number; created_at: string }>(
    'SELECT id, name, mime_type, size_bytes, created_at FROM documents WHERE project_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT 30',
    [id, userId],
  );
  const nextSteps = all<{ id: string; title: string; due_date: string | null }>(
    `SELECT id, title, due_date FROM tasks
     WHERE project_id = ? AND user_id = ? AND status IN ('pending','in_progress')
     ORDER BY priority ASC, due_date IS NULL, due_date ASC LIMIT 5`,
    [id, userId],
  );
  return { ...project, milestones, tasks, decisions, notes, documents, nextSteps };
}

export function createProject(
  userId: string,
  input: Partial<ProjectRow> & { name: string },
  meta: { source?: 'user' | 'assistant' } = {},
): ProjectRow {
  if (!input.name?.trim()) throw badRequest('El proyecto necesita un nombre.');
  const row = one<ProjectRow>(
    `INSERT INTO projects (id, user_id, name, description, category, status, goal, start_date, due_date, progress)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [
      newId(),
      userId,
      input.name.trim(),
      input.description || '',
      PROJECT_CATEGORIES.includes(input.category || '') ? input.category! : 'personal',
      PROJECT_STATUSES.includes(input.status || '') ? input.status! : 'active',
      input.goal || '',
      input.start_date ?? null,
      input.due_date ?? null,
      input.progress ?? 0,
    ],
  );
  if (!row) throw new Error('No se pudo crear el proyecto.');
  audit({ userId, action: 'data.create', entity: 'project', entityId: row.id, detail: { source: meta.source ?? 'user' } });
  return row;
}

export function updateProject(userId: string, id: string, patch: Record<string, unknown>): ProjectRow {
  getProject(userId, id);
  const clean: Record<string, unknown> = {};
  const allowed = ['name', 'description', 'category', 'status', 'goal', 'start_date', 'due_date', 'progress'];
  for (const key of allowed) {
    if (patch[key] !== undefined) clean[key] = patch[key] as never;
  }
  if (clean.name !== undefined && !String(clean.name).trim()) throw badRequest('El nombre no puede estar vacío.');
  const row = updateOwned<ProjectRow>('projects', id, userId, clean);
  audit({ userId, action: 'data.update', entity: 'project', entityId: id });
  return row;
}

export function deleteProject(userId: string, id: string): void {
  deleteOwned('projects', id, userId);
  audit({ userId, action: 'data.delete', entity: 'project', entityId: id });
}

/** Progreso calculado desde milestones + tareas (nunca inventado). */
export function recalcProjectProgress(userId: string, id: string): number {
  const tasks = one<{ total: number; done: number }>(
    `SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END),0) AS done
     FROM tasks WHERE project_id = ? AND user_id = ? AND status <> 'cancelled'`,
    [id, userId],
  );
  const ms = one<{ total: number; done: number }>(
    `SELECT COUNT(*) AS total, COALESCE(SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END),0) AS done
     FROM project_milestones WHERE project_id = ? AND user_id = ?`,
    [id, userId],
  );
  const totalItems = Number(tasks?.total ?? 0) + Number(ms?.total ?? 0);
  if (totalItems === 0) return getProject(userId, id).progress;
  const doneItems = Number(tasks?.done ?? 0) + Number(ms?.done ?? 0);
  const progress = Math.round((doneItems / totalItems) * 100);
  updateOwned('projects', id, userId, { progress });
  return progress;
}

export function addMilestone(
  userId: string,
  projectId: string,
  input: { title: string; due_date?: string | null; position?: number },
) {
  getProject(userId, projectId);
  if (!input.title?.trim()) throw badRequest('El hito necesita un título.');
  const row = one(
    `INSERT INTO project_milestones (id, project_id, user_id, title, due_date, position)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
    [newId(), projectId, userId, input.title.trim(), input.due_date ?? null, input.position ?? 0],
  );
  recalcProjectProgress(userId, projectId);
  return row;
}

export function setMilestoneStatus(userId: string, projectId: string, milestoneId: string, done: boolean) {
  const ms = one<{ id: string }>(
    'SELECT id FROM project_milestones WHERE id = ? AND project_id = ? AND user_id = ?',
    [milestoneId, projectId, userId],
  );
  if (!ms) throw badRequest('Hito no encontrado.');
  const row = updateOwned(
    'project_milestones',
    milestoneId,
    userId,
    { status: done ? 'done' : 'pending' },
  );
  recalcProjectProgress(userId, projectId);
  return row;
}

export function addDecision(userId: string, projectId: string, input: { title: string; content?: string }) {
  getProject(userId, projectId);
  if (!input.title?.trim()) throw badRequest('La decisión necesita un título.');
  return one(
    `INSERT INTO project_decisions (id, project_id, user_id, title, content)
     VALUES (?, ?, ?, ?, ?) RETURNING *`,
    [newId(), projectId, userId, input.title.trim(), input.content || ''],
  );
}

export function projectProgressLog(userId: string, projectId: string) {
  const project = getProject(userId, projectId);
  const tasks = all<{ id: string; title: string; status: string; due_date: string | null; priority: number }>(
    'SELECT id, title, status, due_date, priority FROM tasks WHERE project_id = ? AND user_id = ?',
    [projectId, userId],
  );
  return {
    project,
    generatedAt: nowIso(),
    totalTasks: tasks.length,
    openTasks: tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length,
    doneTasks: tasks.filter((t) => t.status === 'done').length,
    nextSteps: tasks
      .filter((t) => t.status !== 'done' && t.status !== 'cancelled')
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 5),
  };
}

export function projectsOverview(userId: string) {
  const rows = all<{ status: string; c: number }>(
    'SELECT status, COUNT(*) AS c FROM projects WHERE user_id = ? GROUP BY status',
    [userId],
  );
  const active = listProjects(userId, { status: 'active' }).slice(0, 6);
  return { byStatus: rows, active };
}

export function deleteMilestone(userId: string, projectId: string, milestoneId: string) {
  const res = run('DELETE FROM project_milestones WHERE id = ? AND project_id = ? AND user_id = ?', [
    milestoneId,
    projectId,
    userId,
  ]);
  if (res.changes === 0) throw badRequest('Hito no encontrado.');
  recalcProjectProgress(userId, projectId);
}
