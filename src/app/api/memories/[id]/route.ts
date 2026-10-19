import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import { getMemory, updateMemory, deleteMemory, memoryToJson } from '@/lib/services/memories';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser, params }) => {
    initDatabase();
    return { data: memoryToJson(getMemory(authedUser.user.id, params.id)) };
  },
});

const patchBody = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  category: z.string().optional(),
  confirmed: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

export const PATCH = defineHandler({
  method: 'PATCH',
  schema: patchBody,
  handler: async ({ authedUser, params, body }) => {
    initDatabase();
    return { data: memoryToJson(updateMemory(authedUser.user.id, params.id, body)) };
  },
});

export const DELETE = defineHandler({
  method: 'DELETE',
  handler: async ({ authedUser, params }) => {
    initDatabase();
    deleteMemory(authedUser.user.id, params.id);
    return { data: { ok: true } };
  },
});
