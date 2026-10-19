import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import {
  listGoals,
  updateGoal,
  deleteGoal,
  addGoalMilestone,
  logGoalProgress,
  goalHistory,
} from '@/lib/services/life';
import { notFound } from '@/lib/api/errors';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser, params }) => {
    initDatabase();
    const userId = authedUser.user.id;
    const goal = listGoals(userId).find((g) => g.id === params.id);
    if (!goal) throw notFound('Objetivo no encontrado.');
    return { data: { goal, history: goalHistory(userId, params.id) } };
  },
});

const patchBody = z.object({
  title: z.string().optional(),
  motivation: z.string().optional(),
  category: z.string().optional(),
  target_date: z.string().nullable().optional(),
  status: z.enum(['active', 'paused', 'done', 'cancelled']).optional(),
  progress: z.coerce.number().optional(),
});

export const PATCH = defineHandler({
  method: 'PATCH',
  schema: patchBody,
  handler: async ({ authedUser, params, body }) => {
    initDatabase();
    return { data: updateGoal(authedUser.user.id, params.id, body) };
  },
});

const actionBody = z.discriminatedUnion('action', [
  z.object({ action: z.literal('addMilestone'), title: z.string().min(1), due_date: z.string().nullable().optional() }),
  z.object({ action: z.literal('logProgress'), note: z.string().min(1), progress: z.coerce.number().optional() }),
]);

export const POST = defineHandler({
  method: 'POST',
  schema: actionBody,
  handler: async ({ authedUser, params, body }) => {
    initDatabase();
    const userId = authedUser.user.id;
    if (body.action === 'addMilestone') {
      return { data: addGoalMilestone(userId, params.id, body), status: 201 };
    }
    return { data: logGoalProgress(userId, params.id, body.note, body.progress) };
  },
});

export const DELETE = defineHandler({
  method: 'DELETE',
  handler: async ({ authedUser, params }) => {
    initDatabase();
    deleteGoal(authedUser.user.id, params.id);
    return { data: { ok: true } };
  },
});
