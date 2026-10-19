import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import { listHabits, createHabit, routinesSummary } from '@/lib/services/life';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createBody = z.object({
  name: z.string().min(1, 'El hábito necesita un nombre'),
  description: z.string().optional(),
  category: z.string().optional(),
  frequency: z.enum(['daily', 'weekly']).optional(),
  target_per_week: z.coerce.number().optional(),
});

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser, url }) => {
    initDatabase();
    const userId = authedUser.user.id;
    const tz = authedUser.settings.timezone || 'America/Monterrey';
    const includeInactive = url.searchParams.get('all') === '1';
    return {
      data: {
        habits: listHabits(userId, tz, includeInactive),
        summary: routinesSummary(userId, tz),
      },
    };
  },
});

export const POST = defineHandler({
  method: 'POST',
  schema: createBody,
  handler: async ({ authedUser, body }) => {
    initDatabase();
    return { data: createHabit(authedUser.user.id, body), status: 201 };
  },
});
