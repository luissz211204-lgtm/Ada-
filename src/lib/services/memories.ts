import { all, one, parseJson, newId, nowIso } from '@/lib/db';
import { badRequest } from '@/lib/api/errors';
import { getOwned, updateOwned, deleteOwned } from './crud';
import { audit } from './audit';

export interface MemoryRow {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: string;
  source: 'user' | 'assistant';
  confirmed: number;
  tags: string | null;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = ['perfil', 'notas', 'proyectos', 'objetivos', 'referencia', 'aprendizajes', 'conversaciones'];

export function listMemories(
  userId: string,
  opts: { q?: string; category?: string; limit?: number } = {},
): MemoryRow[] {
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
  return all<MemoryRow>(
    `SELECT * FROM memories WHERE ${clauses.join(' AND ')}
     ORDER BY updated_at DESC LIMIT ?`,
    [...params, opts.limit ?? 100],
  );
}

export function getMemory(userId: string, id: string): MemoryRow {
  return getOwned<MemoryRow>('memories', id, userId);
}

/**
 * Crea un recuerdo. Los generados por la asistente quedan `confirmed = 0`
 * (NO se guardan como hechos confirmados hasta que el usuario lo valide).
 */
export function createMemory(
  userId: string,
  input: {
    title: string;
    content: string;
    category?: string;
    source?: 'user' | 'assistant';
    confirmed?: boolean;
    tags?: string[];
  },
): MemoryRow {
  if (!input.title?.trim() || !input.content?.trim()) {
    throw badRequest('El recuerdo necesita título y contenido.');
  }
  const category = CATEGORIES.includes(input.category || '')
    ? (input.category as string)
    : 'notas';
  const row = one<MemoryRow>(
    `INSERT INTO memories (id, user_id, title, content, category, source, confirmed, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [
      newId(),
      userId,
      input.title.trim(),
      input.content.trim(),
      category,
      input.source || 'user',
      input.confirmed ? 1 : 0,
      input.tags ? JSON.stringify(input.tags) : null,
    ],
  );
  if (!row) throw new Error('No se pudo guardar el recuerdo.');
  audit({ userId, action: 'data.create', entity: 'memory', entityId: row.id, detail: { source: input.source || 'user' } });
  return row;
}

export function updateMemory(
  userId: string,
  id: string,
  patch: Partial<{ title: string; content: string; category: string; confirmed: boolean; tags: string[] }>,
): MemoryRow {
  getMemory(userId, id);
  const clean: Record<string, unknown> = {};
  if (patch.title !== undefined) clean.title = patch.title;
  if (patch.content !== undefined) clean.content = patch.content;
  if (patch.category !== undefined) {
    if (!CATEGORIES.includes(patch.category)) throw badRequest('Categoría inválida.');
    clean.category = patch.category;
  }
  if (patch.confirmed !== undefined) clean.confirmed = patch.confirmed ? 1 : 0;
  if (patch.tags !== undefined) clean.tags = JSON.stringify(patch.tags);
  const row = updateOwned<MemoryRow>('memories', id, userId, clean);
  audit({ userId, action: 'data.update', entity: 'memory', entityId: id });
  return row;
}

export function deleteMemory(userId: string, id: string): void {
  deleteOwned('memories', id, userId);
  audit({ userId, action: 'data.delete', entity: 'memory', entityId: id });
}

export function memoryToJson(row: MemoryRow) {
  return { ...row, tags: parseJson<string[]>(row.tags, []), confirmed: row.confirmed === 1 };
}
