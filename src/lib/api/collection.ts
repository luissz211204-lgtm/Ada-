import { z } from 'zod';
import { defineHandler } from './handler';
import { badRequest, notFound } from './errors';
import { all, one, run, newId, nowIso, type Param } from '@/lib/db';
import { audit } from '@/lib/services/audit';
import { initDatabase } from '@/lib/server/bootstrap';

/**
 * Fábrica de rutas CRUD para colecciones propiedad del usuario.
 * Garantiza: aislamiento por user_id, validación Zod, auditoría y errores
 * uniformes. Las tablas son nombres internos fijos (sin inyección SQL).
 */

const SAFE = /^[a-z_]+$/;

export interface CollectionOptions<S extends z.ZodTypeAny> {
  table: string;
  schema: S;
  /** Columnas consultables por igualdad desde la query string. */
  filters?: string[];
  orderBy?: string;
  entity: string;
  /** Verificaciones adicionales (propiedad de FKs, reglas de negocio). */
  prepare?: (userId: string, input: z.infer<S>, mode: 'create' | 'update') => Record<string, unknown>;
  /** Ajustes posteriores a la escritura (p. ej. recalcular progreso). */
  afterWrite?: (userId: string, id: string) => void;
  /** Búsqueda de texto libre en estas columnas. */
  searchColumns?: string[];
}

function guard(table: string) {
  if (!SAFE.test(table)) throw new Error(`Tabla inválida: ${table}`);
}

export function defineCollection<S extends z.ZodTypeAny>(opts: CollectionOptions<S>) {
  guard(opts.table);
  const orderBy = opts.orderBy || 'created_at DESC';

  const GET = defineHandler({
    method: 'GET',
    handler: async ({ authedUser, url }) => {
      initDatabase();
      const clauses = ['user_id = ?'];
      const params: Param[] = [authedUser.user.id];
      for (const f of opts.filters ?? []) {
        const value = url.searchParams.get(f);
        if (value !== null && value !== '') {
          clauses.push(`${f} = ?`);
          params.push(value);
        }
      }
      const q = url.searchParams.get('q');
      if (q && opts.searchColumns?.length) {
        clauses.push(`(${opts.searchColumns.map((c) => `${c} LIKE ?`).join(' OR ')})`);
        for (const _ of opts.searchColumns) params.push(`%${q}%`);
      }
      const limit = Math.min(Number(url.searchParams.get('limit') || 200), 500);
      const rows = all(
        `SELECT * FROM ${opts.table} WHERE ${clauses.join(' AND ')} ORDER BY ${orderBy} LIMIT ?`,
        [...params, limit],
      );
      return { data: rows };
    },
  });

  const POST = defineHandler({
    method: 'POST',
    schema: opts.schema,
    handler: async ({ authedUser, body, ip }) => {
      initDatabase();
      const userId = authedUser.user.id;
      const prepared = opts.prepare ? opts.prepare(userId, body, 'create') : (body as Record<string, unknown>);
      const data: Record<string, unknown> = { id: newId(), user_id: userId, ...prepared };
      const keys = Object.keys(data);
      for (const k of keys) {
        if (!SAFE.test(k)) throw badRequest(`Campo no permitido: ${k}`);
      }
      const row = one(
        `INSERT INTO ${opts.table} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')}) RETURNING *`,
        keys.map((k) => data[k] as Param),
      );
      if (!row) throw new Error('No se pudo crear el registro.');
      const id = (row as { id: string }).id;
      opts.afterWrite?.(userId, id);
      audit({ userId, action: 'data.create', entity: opts.entity, entityId: id, ip });
      return { data: row, status: 201 };
    },
  });

  return { GET, POST };
}

export function defineItem<S extends z.ZodTypeAny>(opts: {
  table: string;
  schema: S;
  entity: string;
  prepare?: (userId: string, input: z.infer<S>) => Record<string, unknown>;
  afterWrite?: (userId: string, id: string) => void;
}) {
  guard(opts.table);

  const GET = defineHandler({
    method: 'GET',
    handler: async ({ authedUser, params }) => {
      initDatabase();
      const row = one(`SELECT * FROM ${opts.table} WHERE id = ? AND user_id = ?`, [
        params.id,
        authedUser.user.id,
      ]);
      if (!row) throw notFound('Registro no encontrado.');
      return { data: row };
    },
  });

  const PATCH = defineHandler({
    method: 'PATCH',
    schema: opts.schema,
    handler: async ({ authedUser, params, body, ip }) => {
      initDatabase();
      const userId = authedUser.user.id;
      const patch = opts.prepare ? opts.prepare(userId, body) : (body as Record<string, unknown>);
      const keys = Object.keys(patch);
      if (keys.length === 0) throw badRequest('No hay cambios que aplicar.');
      for (const k of keys) {
        if (!SAFE.test(k)) throw badRequest(`Campo no permitido: ${k}`);
      }
      const row = one(
        `UPDATE ${opts.table} SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = ?
         WHERE id = ? AND user_id = ? RETURNING *`,
        [...keys.map((k) => patch[k] as Param), nowIso(), params.id, userId],
      );
      if (!row) throw notFound('Registro no encontrado.');
      opts.afterWrite?.(userId, params.id);
      audit({ userId, action: 'data.update', entity: opts.entity, entityId: params.id, ip });
      return { data: row };
    },
  });

  const DELETE = defineHandler({
    method: 'DELETE',
    handler: async ({ authedUser, params, ip }) => {
      initDatabase();
      const res = run(`DELETE FROM ${opts.table} WHERE id = ? AND user_id = ?`, [
        params.id,
        authedUser.user.id,
      ]);
      if (res.changes === 0) throw notFound('Registro no encontrado.');
      audit({
        userId: authedUser.user.id,
        action: 'data.delete',
        entity: opts.entity,
        entityId: params.id,
        ip,
      });
      return { data: { ok: true } };
    },
  });

  return { GET, PATCH, DELETE };
}
