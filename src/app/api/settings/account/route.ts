import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import { deleteAccount } from '@/lib/services/account';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const body = z.object({
  password: z.string().min(1),
  confirmation: z.literal('ELIMINAR'),
});

export const DELETE = defineHandler({
  method: 'DELETE',
  schema: body,
  handler: async ({ authedUser, body }) => {
    initDatabase();
    const result = deleteAccount(authedUser.user.id, body.password, body.confirmation);
    const headers = new Headers();
    headers.append(
      'set-cookie',
      `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    );
    return { data: result, status: 200 };
  },
});
