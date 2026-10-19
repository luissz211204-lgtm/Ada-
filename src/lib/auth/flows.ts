import { one, run, nowIso, newId } from '@/lib/db';
import { hashPassword, verifyPassword, validatePassword } from './password';
import { createSession, purgeExpiredSessions } from './session';
import { audit } from '@/lib/services/audit';

/**
 * Flujos de autenticación reutilizables tanto por las rutas API como por las
 * Server Actions de las páginas. Así el navegador nunca necesita llamar a la
 * API por HTTP con una URL absoluta (que se rompería en producción).
 */

export type AuthResult =
  | { ok: true; token: string; expiresAt: string; userId: string }
  | { ok: false; status: number; error: string };

export interface AuthMeta {
  ip?: string | null;
  userAgent?: string | null;
}

export function registerUser(
  input: { name: string; email: string; password: string },
  meta: AuthMeta = {},
): AuthResult {
  purgeExpiredSessions();
  const error = validatePassword(input.password);
  if (error) return { ok: false, status: 400, error };
  const email = input.email.trim().toLowerCase();
  const exists = one<{ id: string }>('SELECT id FROM users WHERE email = ? COLLATE NOCASE', [email]);
  if (exists) return { ok: false, status: 409, error: 'El correo ya está registrado.' };

  const userId = newId();
  run(
    `INSERT INTO users (id, email, password_hash, name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, email, hashPassword(input.password), input.name.trim(), nowIso(), nowIso()],
  );
  run(`INSERT INTO user_settings (user_id) VALUES (?)`, [userId]);
  const session = createSession(userId, { ip: meta.ip ?? null, userAgent: meta.userAgent ?? null });
  audit({ userId, action: 'auth.register', ip: meta.ip ?? null });
  return { ok: true, token: session.token, expiresAt: session.expiresAt, userId };
}

export function loginUser(input: { email: string; password: string }, meta: AuthMeta = {}): AuthResult {
  purgeExpiredSessions();
  const user = one<{ id: string; password_hash: string }>(
    'SELECT id, password_hash FROM users WHERE email = ? COLLATE NOCASE',
    [input.email.trim()],
  );
  if (!user || !verifyPassword(input.password, user.password_hash)) {
    return { ok: false, status: 401, error: 'Credenciales inválidas.' };
  }
  const session = createSession(user.id, { ip: meta.ip ?? null, userAgent: meta.userAgent ?? null });
  run('UPDATE users SET updated_at = ? WHERE id = ?', [nowIso(), user.id]);
  audit({ userId: user.id, action: 'auth.login', ip: meta.ip ?? null });
  return { ok: true, token: session.token, expiresAt: session.expiresAt, userId: user.id };
}
