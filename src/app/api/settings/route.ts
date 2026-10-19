import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import { getProfile, updateSettings, updateProfile } from '@/lib/services/account';
import { listSessions } from '@/lib/auth/session';
import { one } from '@/lib/db';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser }) => {
    initDatabase();
    const userId = authedUser.user.id;
    const usage = one<{ cost: number; prompts: number }>(
      `SELECT COALESCE(SUM(cost_cents),0) AS cost, COUNT(*) AS prompts FROM ai_usage_logs
       WHERE user_id = ? AND substr(created_at,1,7) = ?`,
      [userId, new Date().toISOString().slice(0, 7)],
    );
    return {
      data: {
        ...getProfile(userId),
        sessions: listSessions(userId),
        aiUsage: { costCents: Number(usage?.cost ?? 0), requests: Number(usage?.prompts ?? 0) },
      },
    };
  },
});

const body = z.discriminatedUnion('target', [
  z.object({
    target: z.literal('settings'),
    values: z.record(z.unknown()),
  }),
  z.object({
    target: z.literal('profile'),
    name: z.string().optional(),
    email: z.string().optional(),
  }),
]);

export const PATCH = defineHandler({
  method: 'PATCH',
  schema: body,
  handler: async ({ authedUser, body }) => {
    initDatabase();
    const userId = authedUser.user.id;
    if (body.target === 'settings') {
      return { data: { settings: updateSettings(userId, body.values) } };
    }
    return { data: updateProfile(userId, { name: body.name, email: body.email }) };
  },
});
