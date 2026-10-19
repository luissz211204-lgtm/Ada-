import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import { listGoals, createGoal, GOAL_CATEGORIES } from '@/lib/services/life';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createBody = z.object({
  title: z.string().min(1, 'El objetivo necesita un título'),
  motivation: z.string().optional(),
  category: z.enum(GOAL_CATEGORIES as [string, ...string[]]).optional(),
  target_date: z.string().nullable().optional(),
  indicators: z.array(z.string()).optional(),
  target_amount: z.coerce.number().optional(),
});

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser, url }) => {
    initDatabase();
    return { data: listGoals(authedUser.user.id, url.searchParams.get('status') || undefined) };
  },
});

export const POST = defineHandler({
  method: 'POST',
  schema: createBody,
  handler: async ({ authedUser, body }) => {
    initDatabase();
    return { data: createGoal(authedUser.user.id, body), status: 201 };
  },
});
