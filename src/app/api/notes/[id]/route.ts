import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import { getNote, updateNote, deleteNote, NOTE_CATEGORIES } from '@/lib/services/notes';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser, params }) => {
    initDatabase();
    return { data: getNote(authedUser.user.id, params.id) };
  },
});

const patchBody = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  category: z.enum(NOTE_CATEGORIES as [string, ...string[]]).optional(),
  pinned: z.boolean().optional(),
  project_id: z.string().nullable().optional(),
});

export const PATCH = defineHandler({
  method: 'PATCH',
  schema: patchBody,
  handler: async ({ authedUser, params, body }) => {
    initDatabase();
    return { data: updateNote(authedUser.user.id, params.id, body) };
  },
});

export const DELETE = defineHandler({
  method: 'DELETE',
  handler: async ({ authedUser, params }) => {
    initDatabase();
    deleteNote(authedUser.user.id, params.id);
    return { data: { ok: true } };
  },
});
