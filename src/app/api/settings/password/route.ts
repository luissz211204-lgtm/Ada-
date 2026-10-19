import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import { changePassword } from '@/lib/services/account';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const body = z.object({
  current: z.string().min(1),
  next: z.string().min(8),
});

export const POST = defineHandler({
  method: 'POST',
  schema: body,
  handler: async ({ authedUser, body }) => {
    initDatabase();
    return { data: changePassword(authedUser.user.id, body.current, body.next) };
  },
});
