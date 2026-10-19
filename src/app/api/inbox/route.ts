import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import { inboxList, inboxAdd, inboxConvert, inboxDiscard } from '@/lib/services/tasks';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser, url }) => {
    initDatabase();
    const status = url.searchParams.get('status') || 'pending';
    return { data: inboxList(authedUser.user.id, status) };
  },
});

const body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('add'), content: z.string().min(1) }),
  z.object({
    action: z.literal('convert'),
    id: z.string().min(1),
    task: z
      .object({
        title: z.string().optional(),
        priority: z.coerce.number().optional(),
        due_date: z.string().optional(),
        due_time: z.string().optional(),
        project_id: z.string().optional(),
      })
      .default({}),
  }),
  z.object({ action: z.literal('discard'), id: z.string().min(1) }),
]);

export const POST = defineHandler({
  method: 'POST',
  schema: body,
  handler: async ({ authedUser, body }) => {
    initDatabase();
    const userId = authedUser.user.id;
    if (body.action === 'add') {
      return { data: inboxAdd(userId, body.content), status: 201 };
    }
    if (body.action === 'discard') {
      return { data: inboxDiscard(userId, body.id) };
    }
    return { data: inboxConvert(userId, body.id, body.task) };
  },
});
