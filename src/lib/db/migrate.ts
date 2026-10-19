import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { getDb, dataDir } from './index';

export interface MigrationResult {
  applied: string[];
  skipped: string[];
}

function migrationsDir(): string {
  return path.join(process.cwd(), 'src', 'lib', 'db', 'migrations');
}

/**
 * Aplica las migraciones pendientes de forma reproducible:
 * cada archivo SQL se ejecuta una sola vez y queda registrado con su huella
 * SHA-256. Funciona sobre una base de datos vacía y es idempotente.
 */
export function migrate(): MigrationResult {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      checksum   TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `);

  const dir = migrationsDir();
  if (!fs.existsSync(dir)) {
    throw new Error(`No se encontró el directorio de migraciones: ${dir}`);
  }

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const appliedRows = db
    .prepare('SELECT name, checksum FROM _migrations')
    .all() as unknown as { name: string; checksum: string }[];
  const appliedMap = new Map(appliedRows.map((r) => [r.name, r.checksum]));

  const result: MigrationResult = { applied: [], skipped: [] };

  // Durante la creación del esquema desactivamos FK para permitir orden de
  // declaración en cualquier sentido (práctica estándar con SQLite).
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(dir, file), 'utf8');
      const checksum = crypto.createHash('sha256').update(sql).digest('hex');
      const existing = appliedMap.get(file);
      if (existing) {
        if (existing !== checksum) {
          throw new Error(
            `La migración ya aplicada cambió de contenido: ${file}. ` +
              `Crea una nueva migración en lugar de modificarla.`,
          );
        }
        result.skipped.push(file);
        continue;
      }
      db.exec('BEGIN IMMEDIATE');
      try {
        db.exec(sql);
        db.prepare('INSERT INTO _migrations (id, name, checksum) VALUES (?, ?, ?)').run(
          crypto.randomUUID(),
          file,
          checksum,
        );
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw new Error(`Error aplicando la migración ${file}: ${(err as Error).message}`);
      }
      result.applied.push(file);
    }
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }

  return result;
}

/** Comprueba si todas las migraciones están aplicadas. */
export function migrationStatus(): { pending: string[]; applied: string[] } {
  const db = getDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      checksum   TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    )
  `);
  const files = fs
    .readdirSync(migrationsDir())
    .filter((f) => f.endsWith('.sql'))
    .sort();
  const rows = db.prepare('SELECT name FROM _migrations').all() as unknown as {
    name: string;
  }[];
  const applied = rows.map((r) => r.name);
  return { applied, pending: files.filter((f) => !applied.includes(f)) };
}

export { dataDir };
