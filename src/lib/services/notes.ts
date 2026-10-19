import { all, one, newId } from '@/lib/db';
import { badRequest } from '@/lib/api/errors';
import { getOwned, updateOwned, deleteOwned } from './crud';
import { audit } from './audit';

export interface NoteRow {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: string;
  project_id: string | null;
  pinned: number;
  created_at: string;
  updated_at: string;
}

export const NOTE_CATEGORIES = ['idea', 'reflexion', 'decision', 'aprendizaje', 'pendiente', 'referencia'];

export function listNotes(
  userId: string,
  opts: { q?: string; category?: string; project_id?: string; limit?: number } = {},
): NoteRow[] {
  const clauses = ['user_id = ?'];
  const params: (string | number)[] = [userId];
  if (opts.q) {
    clauses.push('(title LIKE ? OR content LIKE ?)');
    params.push(`%${opts.q}%`, `%${opts.q}%`);
  }
  if (opts.category) {
    clauses.push('category = ?');
    params.push(opts.category);
  }
  if (opts.project_id) {
    clauses.push('project_id = ?');
    params.push(opts.project_id);
  }
  return all<NoteRow>(
    `SELECT * FROM notes WHERE ${clauses.join(' AND ')} ORDER BY pinned DESC, updated_at DESC LIMIT ?`,
    [...params, opts.limit ?? 200],
  );
}

export function getNote(userId: string, id: string): NoteRow {
  return getOwned<NoteRow>('notes', id, userId);
}

export function createNote(
  userId: string,
  input: { title: string; content?: string; category?: string; project_id?: string | null },
): NoteRow {
  if (!input.title?.trim()) throw badRequest('La nota necesita un título.');
  const category = NOTE_CATEGORIES.includes(input.category || '') ? input.category! : 'idea';
  if (input.project_id) getOwned('projects', input.project_id, userId);
  const row = one<NoteRow>(
    `INSERT INTO notes (id, user_id, title, content, category, project_id)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
    [newId(), userId, input.title.trim(), input.content || '', category, input.project_id ?? null],
  );
  if (!row) throw new Error('No se pudo crear la nota.');
  audit({ userId, action: 'data.create', entity: 'note', entityId: row.id });
  return row;
}

export function updateNote(
  userId: string,
  id: string,
  patch: Partial<{ title: string; content: string; category: string; pinned: boolean; project_id: string | null }>,
): NoteRow {
  getNote(userId, id);
  const clean: Record<string, unknown> = {};
  if (patch.title !== undefined) clean.title = patch.title;
  if (patch.content !== undefined) clean.content = patch.content;
  if (patch.category !== undefined) {
    if (!NOTE_CATEGORIES.includes(patch.category)) throw badRequest('Categoría de nota inválida.');
    clean.category = patch.category;
  }
  if (patch.pinned !== undefined) clean.pinned = patch.pinned ? 1 : 0;
  if (patch.project_id !== undefined) {
    if (patch.project_id) getOwned('projects', patch.project_id, userId);
    clean.project_id = patch.project_id;
  }
  const row = updateOwned<NoteRow>('notes', id, userId, clean);
  audit({ userId, action: 'data.update', entity: 'note', entityId: id });
  return row;
}

export function deleteNote(userId: string, id: string): void {
  deleteOwned('notes', id, userId);
  audit({ userId, action: 'data.delete', entity: 'note', entityId: id });
}
