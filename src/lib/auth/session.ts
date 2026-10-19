import crypto from 'node:crypto';
import { all, newId, nowIso, one, run, parseJson } from '@/lib/db';

export const SESSION_COOKIE = 'ev_session';

/** Opciones de la cookie de sesión (una sola fuente de verdad). */
export function sessionCookieOptions(): {
  httpOnly: boolean;
  sameSite: 'lax';
  path: string;
  secure: boolean;
  maxAge: number;
} {
  return {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * sessionTtlDays(),
  };
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface SettingsRow {
  user_id: string;
  timezone: string;
  theme: 'system' | 'light' | 'dark';
  assistant_name: string;
  assistant_style: 'natural' | 'formal' | 'direct' | 'friendly';
  response_length: 'short' | 'medium' | 'long';
  formality: number;
  proactivity: 'off' | 'normal' | 'high';
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  notification_channels: string;
  memory_categories: string;
  voice_enabled: number;
  ai_provider: string | null;
  ai_model: string | null;
  ai_monthly_budget_cents: number;
  onboarded: number;
}

export interface SessionUser {
  user: UserRow;
  settings: Omit<SettingsRow, 'notification_channels' | 'memory_categories'> & {
    notification_channels: string[];
    memory_categories: string[];
  };
  sessionId: string;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function sessionTtlDays(): number {
  return Number(process.env.SESSION_TTL_DAYS || 30);
}

export function createSession(
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): { token: string; expiresAt: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(
    Date.now() + sessionTtlDays() * 24 * 60 * 60 * 1000,
  ).toISOString();
  run(
    `INSERT INTO sessions (id, user_id, token_hash, user_agent, ip, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [newId(), userId, hashToken(token), meta.userAgent ?? null, meta.ip ?? null, expiresAt],
  );
  return { token, expiresAt };
}

export function loadSettings(userId: string): SessionUser['settings'] | null {
  const row = one<SettingsRow>('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
  if (!row) return null;
  return {
    ...row,
    notification_channels: parseJson<string[]>(row.notification_channels, ['web']),
    memory_categories: parseJson<string[]>(row.memory_categories, []),
  };
}

/** Resuelve un token de sesión en usuario, o null si es inválida/expirada. */
export function getSessionUser(token: string | undefined | null): SessionUser | null {
  if (!token) return null;
  const session = one<{ id: string; user_id: string; expires_at: string; revoked_at: string | null }>(
    'SELECT id, user_id, expires_at, revoked_at FROM sessions WHERE token_hash = ?',
    [hashToken(token)],
  );
  if (!session) return null;
  if (session.revoked_at) return null;
  if (new Date(session.expires_at).getTime() < Date.now()) return null;
  const user = one<UserRow>('SELECT * FROM users WHERE id = ?', [session.user_id]);
  if (!user) return null;
  const settings = loadSettings(user.id);
  if (!settings) return null;
  return { user, settings, sessionId: session.id };
}

export function revokeSession(token: string): void {
  run('UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL', [
    nowIso(),
    hashToken(token),
  ]);
}

export function revokeAllSessions(userId: string): number {
  const res = run('UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL', [
    nowIso(),
    userId,
  ]);
  return res.changes;
}

export function listSessions(userId: string) {
  return all<{
    id: string;
    user_agent: string | null;
    ip: string | null;
    created_at: string;
    expires_at: string;
    revoked_at: string | null;
  }>(
    `SELECT id, user_agent, ip, created_at, expires_at, revoked_at
     FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
    [userId],
  );
}

/** Borra sesiones expiradas (higiene, se ejecuta al iniciar sesión). */
export function purgeExpiredSessions(): void {
  run('DELETE FROM sessions WHERE expires_at < ?', [nowIso()]);
}
