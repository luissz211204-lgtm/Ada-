import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import { getEvent, updateEvent, deleteEvent, findConflicts } from '@/lib/services/calendar';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser, params }) => {
    initDatabase();
    return { data: getEvent(authedUser.user.id, params.id) };
  },
});

const patchBody = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  starts_at: z.string().optional(),
  ends_at: z.string().optional(),
  all_day: z.boolean().optional(),
  project_id: z.string().nullable().optional(),
});

export const PATCH = defineHandler({
  method: 'PATCH',
  schema: patchBody,
  handler: async ({ authedUser, params, body }) => {
    initDatabase();
    const userId = authedUser.user.id;
    const before = getEvent(userId, params.id);
    const starts = body.starts_at || before.starts_at;
    const ends = body.ends_at || before.ends_at;
    const conflicts = findConflicts(userId, starts, ends, params.id);
    return { data: { event: updateEvent(userId, params.id, body), conflicts } };
  },
});

export const DELETE = defineHandler({
  method: 'DELETE',
  handler: async ({ authedUser, params }) => {
    initDatabase();
    deleteEvent(authedUser.user.id, params.id);
    return { data: { ok: true } };
  },
});
