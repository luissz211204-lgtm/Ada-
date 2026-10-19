import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Capa de acceso a datos de E.V. sobre SQLite (módulo nativo `node:sqlite`
 * incluido en Node.js >= 22.5, sin dependencias nativas externas).
 *
 * Reglas:
 *  - Todas las consultas de dominio viven en `src/lib/services`, nunca en
 *    componentes ni en rutas API sin pasar por servicios.
 *  - Toda fila lleva `user_id` y TODAS las consultas de lectura/escritura
 *    filtran por usuario (aislamiento multiusuario verificado por pruebas).
 *  - Fechas: cadenas ISO-8601 en UTC (`YYYY-MM-DDTHH:mm:ss.sssZ`) para
 *    instantes; `YYYY-MM-DD` para fechas sin hora; `HH:mm` para horas locales.
 */

let instance: DatabaseSync | null = null;

export function dataDir(): string {
  return path.resolve(process.cwd(), process.env.EV_DATA_DIR || './data');
}

export function dbPath(): string {
  return path.join(dataDir(), process.env.EV_DB_FILE || 'ev.db');
}

export function uploadDir(): string {
  return path.resolve(process.cwd(), process.env.UPLOAD_DIR || './uploads');
}

export function getDb(): DatabaseSync {
  if (instance) return instance;
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.mkdirSync(uploadDir(), { recursive: true });
  const db = new DatabaseSync(dbPath());
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  instance = db;
  return instance;
}

/** Cierra la conexión (uso en pruebas). */
export function closeDb(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}

export type Param = string | number | bigint | null | Uint8Array;

export function all<T = Record<string, unknown>>(sql: string, params: Param[] = []): T[] {
  return getDb()
    .prepare(sql)
    .all(...params) as unknown as T[];
}

export function one<T = Record<string, unknown>>(
  sql: string,
  params: Param[] = [],
): T | undefined {
  return getDb()
    .prepare(sql)
    .get(...params) as unknown as T | undefined;
}

export function run(
  sql: string,
  params: Param[] = [],
): { changes: number; lastInsertRowid: number | bigint } {
  const res = getDb().prepare(sql).run(...params);
  return { changes: Number(res.changes), lastInsertRowid: res.lastInsertRowid };
}

/** Ejecuta varias operaciones en una transacción. Si alguna lanza, se revierte. */
export function tx<T>(fn: () => T): T {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* ya revertida */
    }
    throw err;
  }
}

export function newId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Lee y parsea una columna JSON tolerando valores nulos. */
export function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function toJson(value: unknown): string {
  return JSON.stringify(value ?? null);
}

/** Convierte 0/1 de SQLite en booleano. */
export function bool(value: unknown): boolean {
  return value === 1 || value === true || value === '1';
}
