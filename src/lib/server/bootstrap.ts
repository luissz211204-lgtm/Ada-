import { migrate } from '@/lib/db/migrate';
import { getDb } from '@/lib/db';
import { createTask } from '@/lib/services/tasks';
import { createReminder, processDueReminders } from '@/lib/services/notifications';
import { newId, nowIso } from '@/lib/services/crud';
import { hashPassword, validatePassword } from '@/lib/auth/password';
import { createSession, purgeExpiredSessions } from '@/lib/auth/session';

export function initDatabase(): void {
  migrate();
  purgeExpiredSessions();
}

/** Crea el usuario demo (solo para desarrollo local). */
export function ensureDemoUser() {
  const db = getDb();
  const exists = db.prepare('SELECT 1 FROM users LIMIT 1').get();
  if (exists) return null;
  const id = newId();
  const hash = hashPassword('evdemo123');
  db.prepare(
    `INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(id, 'demo@ev.local', hash, 'Demo E.V.', nowIso(), nowIso());
  db.prepare(
    `INSERT INTO user_settings (user_id) VALUES (?)`,
  ).run(id);
  // Datos de ejemplo para verificar que la app funciona con datos reales.
  const task1 = createTask(id, {
    title: 'Crear plan de hoy',
    description: 'Revisar pendientes y organizar el día.',
    priority: 1,
  });
  const task2 = createTask(id, {
    title: 'Leer 10 minutos',
    description: 'Rutina mínima para generar constancia.',
    due_date: new Date().toISOString().slice(0, 10),
  });
  createReminder(id, {
    title: 'Revisar agenda',
    message: 'Comprueba las tareas prioritarias de hoy',
    remind_at: new Date(Date.now() + 60 * 1000).toISOString(),
    channels: ['web'],
  });
  return { id, task1, task2 };
}

/**
 * Procesa recordatorios (para invocarse desde cron externo o worker).
 */
export async function tickWorker(): Promise<TickResult> {
  return processDueReminders();
}

import type { TickResult } from '@/lib/services/notifications';
