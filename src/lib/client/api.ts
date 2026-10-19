'use client';

/**
 * Cliente HTTP para la interfaz. Todas las llamadas pasan por las rutas API
 * (que a su vez usan los servicios con control de permisos). Nunca se accede
 * a la base de datos desde el navegador.
 */

export class ApiRequestError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

async function parse(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function handle<T>(res: Response): Promise<T> {
  const payload = (await parse(res)) as
    | { ok: true; data: T }
    | { ok: false; error: { code: string; message: string; details?: unknown } }
    | null;
  if (!res.ok || !payload || payload.ok === false) {
    const err = payload && payload.ok === false ? payload.error : null;
    throw new ApiRequestError(
      err?.code || 'request_failed',
      err?.message || `La solicitud falló (${res.status}).`,
      err?.details,
    );
  }
  return payload.data;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: 'no-store' });
  return handle<T>(res);
}

export async function apiSend<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return handle<T>(res);
}

export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(path, { method: 'POST', body: form });
  return handle<T>(res);
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiRequestError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Ocurrió un error inesperado.';
}
