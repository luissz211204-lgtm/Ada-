import fs from 'node:fs';
import path from 'node:path';
import { all, one, run, uploadDir } from '@/lib/db';
import { badRequest, forbidden } from '@/lib/api/errors';
import { audit } from './audit';
import { hashPassword, verifyPassword, validatePassword } from '@/lib/auth/password';
import { revokeAllSessions, loadSettings } from '@/lib/auth/session';

export function getProfile(userId: string) {
  const user = one<{ id: string; email: string; name: string; created_at: string }>(
    'SELECT id, email, name, created_at FROM users WHERE id = ?',
    [userId],
  );
  return { user, settings: loadSettings(userId) };
}

function validTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('es-MX', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function updateSettings(userId: string, patch: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};
  const textFields = [
    'assistant_name',
    'assistant_style',
    'response_length',
    'proactivity',
    'quiet_hours_start',
    'quiet_hours_end',
    'theme',
    'ai_provider',
    'ai_model',
  ];
  for (const key of textFields) {
    if (patch[key] !== undefined) clean[key] = patch[key] === null ? null : String(patch[key]);
  }
  if (patch.timezone !== undefined) {
    const tz = String(patch.timezone);
    if (!validTimezone(tz)) throw badRequest(`Zona horaria no válida: ${tz}`);
    clean.timezone = tz;
  }
  if (patch.formality !== undefined) clean.formality = Math.max(0, Math.min(2, Number(patch.formality)));
  if (patch.voice_enabled !== undefined) clean.voice_enabled = patch.voice_enabled ? 1 : 0;
  if (patch.ai_monthly_budget_cents !== undefined) {
    clean.ai_monthly_budget_cents = Math.max(0, Number(patch.ai_monthly_budget_cents));
  }
  if (patch.notification_channels !== undefined) {
    const channels = Array.isArray(patch.notification_channels) ? patch.notification_channels : [];
    clean.notification_channels = JSON.stringify(channels.filter((c) => ['web', 'email', 'whatsapp', 'voice'].includes(String(c))));
  }
  if (patch.memory_categories !== undefined) {
    const cats = Array.isArray(patch.memory_categories) ? patch.memory_categories : [];
    clean.memory_categories = JSON.stringify(cats.map(String));
  }
  if (patch.onboarded !== undefined) clean.onboarded = patch.onboarded ? 1 : 0;
  if (Object.keys(clean).length === 0) throw badRequest('No hay ajustes que guardar.');
  run(`UPDATE user_settings SET ${Object.keys(clean).map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE user_id = ?`, [
    ...Object.values(clean) as never[],
    new Date().toISOString(),
    userId,
  ]);
  audit({ userId, action: 'settings.update', entity: 'user_settings', detail: { fields: Object.keys(clean) } });
  return loadSettings(userId);
}

export function updateProfile(userId: string, patch: { name?: string; email?: string }) {
  const clean: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    if (!patch.name.trim()) throw badRequest('El nombre no puede estar vacío.');
    clean.name = patch.name.trim();
  }
  if (patch.email !== undefined) {
    const email = patch.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw badRequest('Correo electrónico no válido.');
    const exists = one('SELECT id FROM users WHERE email = ? COLLATE NOCASE AND id <> ?', [email, userId]);
    if (exists) throw badRequest('Ese correo ya está en uso.');
    clean.email = email;
  }
  if (Object.keys(clean).length === 0) throw badRequest('No hay cambios que guardar.');
  run(`UPDATE users SET ${Object.keys(clean).map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`, [
    ...Object.values(clean) as never[],
    new Date().toISOString(),
    userId,
  ]);
  return getProfile(userId);
}

export function changePassword(userId: string, current: string, next: string) {
  const user = one<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [userId]);
  if (!user) throw forbidden();
  if (!verifyPassword(current, user.password_hash)) throw badRequest('La contraseña actual no es correcta.');
  const error = validatePassword(next);
  if (error) throw badRequest(error);
  run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', [
    hashPassword(next),
    new Date().toISOString(),
    userId,
  ]);
  revokeAllSessions(userId);
  audit({ userId, action: 'auth.password_change' });
  return { ok: true, sessionsRevoked: true };
}

const EXPORT_TABLES = [
  'user_settings',
  'tasks',
  'task_dependencies',
  'task_activity',
  'inbox_items',
  'projects',
  'project_milestones',
  'project_decisions',
  'calendar_events',
  'reminders',
  'notification_deliveries',
  'memories',
  'notes',
  'goals',
  'goal_milestones',
  'goal_progress_logs',
  'habits',
  'habit_logs',
  'workouts',
  'workout_exercises',
  'workout_logs',
  'body_measurements',
  'recipes',
  'meals',
  'shopping_lists',
  'shopping_items',
  'transactions',
  'budgets',
  'debts',
  'savings_goals',
  'clients',
  'work_orders',
  'work_order_items',
  'inventory_items',
  'documents',
  'document_chunks',
  'conversations',
  'messages',
  'memories',
  'automation_rules',
  'automation_runs',
  'connected_devices',
  'approvals',
  'assistant_tool_runs',
  'audit_logs',
  'ai_usage_logs',
];

/** Exportación completa de los datos del usuario en JSON. */
export function exportUserData(userId: string) {
  const data: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    user: one('SELECT id, email, name, created_at FROM users WHERE id = ?', [userId]),
  };
  for (const table of new Set(EXPORT_TABLES)) {
    if (table === 'user_settings') {
      data[table] = one(`SELECT * FROM user_settings WHERE user_id = ?`, [userId]);
      continue;
    }
    data[table] = all(`SELECT * FROM ${table} WHERE user_id = ?`, [userId]);
  }
  audit({ userId, action: 'data.export', entity: 'user', entityId: userId });
  return data;
}

/** Eliminación definitiva de la cuenta y sus datos. Requiere contraseña. */
export function deleteAccount(userId: string, password: string, confirmation: string) {
  if (confirmation !== 'ELIMINAR') {
    throw badRequest('Escribe ELIMINAR para confirmar la eliminación definitiva.');
  }
  const user = one<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', [userId]);
  if (!user) throw forbidden();
  if (!verifyPassword(password, user.password_hash)) throw badRequest('Contraseña incorrecta.');

  audit({ userId, action: 'data.purge', entity: 'user', entityId: userId });
  run('DELETE FROM users WHERE id = ?', [userId]);

  try {
    const dir = path.join(uploadDir(), userId);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    /* los archivos huérfanos se limpian aparte */
  }
  return { deleted: true };
}

export function recordConsent(userId: string, key: string, value: boolean) {
  audit({ userId, action: 'settings.update', entity: 'consent', detail: { key, value } });
  return { ok: true };
}
