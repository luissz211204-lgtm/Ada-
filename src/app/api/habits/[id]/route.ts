import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import { updateHabit, deleteHabit, toggleHabitLog, habitStreak } from '@/lib/services/life';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser, params }) => {
    initDatabase();
    const tz = authedUser.settings.timezone || 'America/Monterrey';
    return { data: { streak: habitStreak(authedUser.user.id, params.id, tz) } };
  },
});

const patchBody = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  frequency: z.enum(['daily', 'weekly']).optional(),
  target_per_week: z.coerce.number().optional(),
  active: z.boolean().optional(),
});

export const PATCH = defineHandler({
  method: 'PATCH',
  schema: patchBody,
  handler: async ({ authedUser, params, body }) => {
    initDatabase();
    return { data: updateHabit(authedUser.user.id, params.id, body) };
  },
});

const actionBody = z.object({ date: z.string().optional() });

export const POST = defineHandler({
  method: 'POST',
  schema: actionBody,
  handler: async ({ authedUser, params, body }) => {
    initDatabase();
    const tz = authedUser.settings.timezone || 'America/Monterrey';
    return { data: toggleHabitLog(authedUser.user.id, params.id, body.date, tz) };
  },
});

export const DELETE = defineHandler({
  method: 'DELETE',
  handler: async ({ authedUser, params }) => {
    initDatabase();
    deleteHabit(authedUser.user.id, params.id);
    return { data: { ok: true } };
  },
});
