import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import { listReminders, createReminder } from '@/lib/services/notifications';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createBody = z.object({
  title: z.string().min(1),
  remind_at: z.string(),
  message: z.string().optional(),
  lead_minutes: z.coerce.number().optional(),
  channels: z.array(z.string()).optional(),
  recurrence: z
    .object({ freq: z.enum(['daily', 'weekly', 'monthly']), interval: z.coerce.number().optional() })
    .nullable()
    .optional(),
  priority: z.coerce.number().optional(),
});

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser, url }) => {
    initDatabase();
    const status = url.searchParams.get('status');
    const reminders = listReminders(authedUser.user.id, {
      status: status ? status.split(',') : undefined,
      from: url.searchParams.get('from') || undefined,
      to: url.searchParams.get('to') || undefined,
    });
    return { data: reminders };
  },
});

export const POST = defineHandler({
  method: 'POST',
  schema: createBody,
  handler: async ({ authedUser, body }) => {
    initDatabase();
    const reminder = createReminder(authedUser.user.id, body);
    return { data: reminder, status: 201 };
  },
});
