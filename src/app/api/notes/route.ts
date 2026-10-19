import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import { listNotes, createNote, NOTE_CATEGORIES } from '@/lib/services/notes';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createBody = z.object({
  title: z.string().min(1, 'La nota necesita un título'),
  content: z.string().optional(),
  category: z.enum(NOTE_CATEGORIES as [string, ...string[]]).optional(),
  project_id: z.string().nullable().optional(),
});

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser, url }) => {
    initDatabase();
    return {
      data: listNotes(authedUser.user.id, {
        q: url.searchParams.get('q') || undefined,
        category: url.searchParams.get('category') || undefined,
        project_id: url.searchParams.get('project_id') || undefined,
      }),
    };
  },
});

export const POST = defineHandler({
  method: 'POST',
  schema: createBody,
  handler: async ({ authedUser, body }) => {
    initDatabase();
    return { data: createNote(authedUser.user.id, body), status: 201 };
  },
});
