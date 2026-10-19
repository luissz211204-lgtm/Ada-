import { all, newId, nowIso, one, run, type Param } from '@/lib/db';
import { notFound } from '@/lib/api/errors';

/**
 * Operaciones CRUD genéricas SIEMPRE restringidas por usuario.
 * El aislamiento de datos se consigue obligando a que toda consulta filtre
 * por `user_id`; las tablas se referencian con nombres internos fijos
 * (nunca con entrada de usuario), por lo que no hay inyección SQL.
 */

const TABLE_RE = /^[a-z_]+$/;

function assertTable(table: string): void {
  if (!TABLE_RE.test(table)) throw new Error(`Nombre de tabla inválido: ${table}`);
}

export function getOwned<T = Record<string, unknown>>(
  table: string,
  id: string,
  userId: string,
): T {
  assertTable(table);
  const row = one<T>(`SELECT * FROM ${table} WHERE id = ? AND user_id = ?`, [id, userId]);
  if (!row) throw notFound('Registro no encontrado o sin permiso.');
  return row;
}

export function listOwned<T = Record<string, unknown>>(
  table: string,
  userId: string,
  opts: { where?: string; params?: Param[]; orderBy?: string; limit?: number; offset?: number } = {},
): T[] {
  assertTable(table);
  const clauses = ['user_id = ?'];
  const params: Param[] = [userId];
  if (opts.where) {
    clauses.push(`(${opts.where})`);
    params.push(...(opts.params ?? []));
  }
  let sql = `SELECT * FROM ${table} WHERE ${clauses.join(' AND ')}`;
  if (opts.orderBy) sql += ` ORDER BY ${opts.orderBy}`;
  if (opts.limit) {
    sql += ' LIMIT ?';
    params.push(opts.limit);
    if (opts.offset) {
      sql += ' OFFSET ?';
      params.push(opts.offset);
    }
  }
  return all<T>(sql, params);
}

export function countOwned(table: string, userId: string, where?: string, params: Param[] = []): number {
  assertTable(table);
  const sql = where
    ? `SELECT COUNT(*) AS c FROM ${table} WHERE user_id = ? AND (${where})`
    : `SELECT COUNT(*) AS c FROM ${table} WHERE user_id = ?`;
  const row = one<{ c: number }>(sql, [userId, ...params]);
  return Number(row?.c ?? 0);
}

export function insertRow<T = Record<string, unknown>>(
  table: string,
  data: Record<string, unknown>,
): T {
  assertTable(table);
  const keys = Object.keys(data);
  if (keys.length === 0) throw new Error('insertRow: sin datos.');
  for (const k of keys) if (!/^[a-z_]+$/.test(k)) throw new Error(`Columna inválida: ${k}`);
  const cols = keys.join(', ');
  const placeholders = keys.map(() => '?').join(', ');
  const sql = `INSERT INTO ${table} (${cols}) VALUES (${placeholders}) RETURNING *`;
  const row = one<T>(sql, keys.map((k) => data[k] as Param));
  if (!row) throw new Error(`No se pudo insertar en ${table}.`);
  return row;
}

export function updateOwned<T = Record<string, unknown>>(
  table: string,
  id: string,
  userId: string,
  patch: Record<string, unknown>,
): T {
  assertTable(table);
  const keys = Object.keys(patch);
  if (keys.length === 0) return getOwned<T>(table, id, userId);
  for (const k of keys) if (!/^[a-z_]+$/.test(k)) throw new Error(`Columna inválida: ${k}`);
  const sets = keys.map((k) => `${k} = ?`).join(', ');
  const row = one<T>(
    `UPDATE ${table} SET ${sets}, updated_at = ? WHERE id = ? AND user_id = ? RETURNING *`,
    [...keys.map((k) => patch[k] as Param), nowIso(), id, userId],
  );
  if (!row) throw notFound('Registro no encontrado o sin permiso.');
  return row;
}

export function deleteOwned(table: string, id: string, userId: string): void {
  assertTable(table);
  const res = run(`DELETE FROM ${table} WHERE id = ? AND user_id = ?`, [id, userId]);
  if (res.changes === 0) throw notFound('Registro no encontrado o sin permiso.');
}

export function existsOwned(table: string, id: string, userId: string): boolean {
  assertTable(table);
  return !!one(`SELECT 1 FROM ${table} WHERE id = ? AND user_id = ?`, [id, userId]);
}

export { newId, nowIso };
