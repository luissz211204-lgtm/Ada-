import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import { loginUser } from '@/lib/auth/flows';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';

const body = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

export const POST = defineHandler({
  method: 'POST',
  auth: false,
  schema: body,
  handler: async ({ body, ip, req }) => {
    initDatabase();
    const result = loginUser(body, { ip, userAgent: req.headers.get('user-agent') });
    if (!result.ok) return { data: { error: result.error }, status: result.status };
    return { data: { token: result.token, expiresAt: result.expiresAt } };
  },
});
