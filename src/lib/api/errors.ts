export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function badRequest(message: string, details?: unknown): ApiError {
  return new ApiError(400, 'bad_request', message, details);
}

export function unauthorized(message = 'Debes iniciar sesión.'): ApiError {
  return new ApiError(401, 'unauthorized', message);
}

export function forbidden(message = 'No tienes permiso para esta operación.'): ApiError {
  return new ApiError(403, 'forbidden', message);
}

export function notFound(message = 'Recurso no encontrado.'): ApiError {
  return new ApiError(404, 'not_found', message);
}

export function conflict(message: string): ApiError {
  return new ApiError(409, 'conflict', message);
}

export function tooMany(message = 'Demasiadas solicitudes. Intenta más tarde.'): ApiError {
  return new ApiError(429, 'rate_limited', message);
}

export function serviceUnavailable(message: string, details?: unknown): ApiError {
  return new ApiError(503, 'service_unavailable', message, details);
}
