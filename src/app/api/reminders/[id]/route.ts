import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import {
  getReminder,
  updateReminder,
  cancelReminder,
  snoozeReminder,
  dismissReminder,
} from '@/lib/services/notifications';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser, params }) => {
    initDatabase();
    return { data: getReminder(authedUser.user.id, params.id) };
  },
});

const patchBody = z.object({
  title: z.string().optional(),
  message: z.string().optional(),
  remind_at: z.string().optional(),
  lead_minutes: z.coerce.number().optional(),
  priority: z.coerce.number().optional(),
});

export const PATCH = defineHandler({
  method: 'PATCH',
  schema: patchBody,
  handler: async ({ authedUser, params, body }) => {
    initDatabase();
    return { data: updateReminder(authedUser.user.id, params.id, body) };
  },
});

const actionBody = z.discriminatedUnion('action', [
  z.object({ action: z.literal('snooze'), minutes: z.coerce.number().optional() }),
  z.object({ action: z.literal('dismiss') }),
]);

export const POST = defineHandler({
  method: 'POST',
  schema: actionBody,
  handler: async ({ authedUser, params, body }) => {
    initDatabase();
    const userId = authedUser.user.id;
    if (body.action === 'snooze') {
      return { data: snoozeReminder(userId, params.id, body.minutes ?? 10) };
    }
    return { data: dismissReminder(userId, params.id) };
  },
});

export const DELETE = defineHandler({
  method: 'DELETE',
  handler: async ({ authedUser, params }) => {
    initDatabase();
    return { data: cancelReminder(authedUser.user.id, params.id) };
  },
});
