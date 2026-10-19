import { z } from 'zod';
import type { NextRequest } from 'next/server';
import { getSessionUser, SESSION_COOKIE, type SessionUser } from '@/lib/auth/session';
import { ApiError, tooMany, unauthorized } from './errors';

export interface HandlerCtx<B = unknown, Q = unknown> {
  req: Request;
  url: URL;
  user: SessionUser | null;
  /** Usuario autenticado; lanza 401 si `auth` es true y no hay sesión. */
  authedUser: SessionUser;
  body: B;
  query: Q;
  params: Record<string, string>;
  ip: string;
}

export type HandlerResult = { data: unknown; status?: number };

interface HandlerOptions<B extends z.ZodTypeAny, Q extends z.ZodTypeAny> {
  method?: string | string[];
  /** Requiere sesión válida (por defecto sí). */
  auth?: boolean;
  schema?: B;
  query?: Q;
  handler: (
    ctx: HandlerCtx<z.infer<B>, z.infer<Q>>,
  ) => Promise<HandlerResult> | HandlerResult;
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') || 'local';
}

export function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return Response.json({ ok: true, data }, { status, headers });
}

export function errorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    return Response.json(
      { ok: false, error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status },
    );
  }
  const message = err instanceof Error ? err.message : 'Error interno del servidor.';
  console.error('[api] error no controlado:', err);
  return Response.json(
    { ok: false, error: { code: 'internal_error', message } },
    { status: 500 },
  );
}

/**
 * Limitador de solicitudes en memoria (ventana fija).
 * Nota: en despliegues serverless con varias instancias es un límite
 * aproximado por instancia; documentado en docs/SECURITY.md.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  existing.count += 1;
  if (existing.count > limit) throw tooMany();
}

export function resetRateLimits(): void {
  buckets.clear();
}

/**
 * Envuelve un manejador de ruta con validación, autenticación, manejo de
 * errores y formato de respuesta uniforme.
 */
export function defineHandler<B extends z.ZodTypeAny, Q extends z.ZodTypeAny = z.ZodTypeAny>(
  opts: HandlerOptions<B, Q>,
) {
  const methods = opts.method
    ? Array.isArray(opts.method)
      ? opts.method
      : [opts.method]
    : null;
  const requireAuth = opts.auth !== false;

  return async function route(
    req: Request,
    routeCtx: { params: Promise<Record<string, string>> },
  ): Promise<Response> {
    try {
      if (methods && !methods.includes(req.method)) {
        throw new ApiError(405, 'method_not_allowed', 'Método no permitido.');
      }
      const url = new URL(req.url);
      // Next.js 15 entrega `params` como Promise; aceptamos también objetos
      // planos para poder invocar los manejadores directamente en pruebas.
      const rawParams = routeCtx?.params ? await Promise.resolve(routeCtx.params) : {};
      const params = (rawParams || {}) as Record<string, string>;

      const token = readCookie(req, SESSION_COOKIE);
      const user = getSessionUser(token);

      if (requireAuth && !user) throw unauthorized();

      let body: unknown = undefined;
      if (opts.schema) {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          const text = await req.text();
          let parsed: unknown;
          try {
            parsed = text ? JSON.parse(text) : {};
          } catch {
            throw new ApiError(400, 'invalid_json', 'El cuerpo no es JSON válido.');
          }
          const result = opts.schema.safeParse(parsed);
          if (!result.success) {
            throw new ApiError(422, 'validation_error', 'Datos no válidos.', {
              issues: result.error.issues.map((i) => ({
                path: i.path.join('.'),
                message: i.message,
              })),
            });
          }
          body = result.data;
        } else {
          body = undefined;
        }
      }

      let query: unknown = {};
      if (opts.query) {
        const result = opts.query.safeParse(Object.fromEntries(url.searchParams));
        if (!result.success) {
          throw new ApiError(422, 'validation_error', 'Parámetros no válidos.', {
            issues: result.error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          });
        }
        query = result.data;
      }

      const ctx: HandlerCtx<z.infer<B>, z.infer<Q>> = {
        req,
        url,
        user,
        authedUser: user as SessionUser,
        body: body as z.infer<B>,
        query: query as z.infer<Q>,
        params,
        ip: clientIp(req),
      };
      const result = await opts.handler(ctx);
      return json(result.data, result.status ?? 200);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Extrae el usuario de sesión de una petición (para páginas/RSC). */
export function userFromRequest(req: Request | NextRequest): SessionUser | null {
  return getSessionUser(readCookie(req, SESSION_COOKIE));
}

export { z };
