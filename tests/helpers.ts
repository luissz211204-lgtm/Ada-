import { migrate } from '@/lib/db/migrate';
import { registerUser } from '@/lib/auth/flows';
import { SESSION_COOKIE } from '@/lib/auth/session';

/**
 * Utilidades compartidas por las pruebas. Cada archivo de prueba recibe su
 * propia base de datos temporal (ver tests/setup.ts), así que aquí solo
 * nos aseguramos de aplicar las migraciones una vez por proceso.
 */

let migrated = false;

export function setupDb(): void {
  if (!migrated) {
    migrate();
    migrated = true;
  }
}

export interface TestUser {
  id: string;
  email: string;
  token: string;
}

export function makeUser(prefix = 'user'): TestUser {
  setupDb();
  const email = `${prefix}-${Math.random().toString(36).slice(2, 10)}@test.local`;
  const res = registerUser({ name: `Prueba ${prefix}`, email, password: 'clave12345' });
  if (!res.ok) throw new Error(`No se pudo crear el usuario de prueba: ${res.error}`);
  return { id: res.userId, email, token: res.token };
}

/** Construye una Request con la cookie de sesión y (opcionalmente) cuerpo JSON. */
export function apiRequest(
  url: string,
  opts: {
    method?: string;
    token?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Request {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (opts.token) headers.cookie = `${SESSION_COOKIE}=${opts.token}`;
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  return new Request(`http://localhost${url}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

export async function readJson<T = any>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

export function paramsCtx(params: Record<string, string>): {
  params: Promise<Record<string, string>>;
} {
  return { params: Promise.resolve(params) };
}

/** Contexto de ruta vacío (rutas sin segmentos dinámicos). */
export function noParams(): { params: Promise<Record<string, string>> } {
  return paramsCtx({});
}
