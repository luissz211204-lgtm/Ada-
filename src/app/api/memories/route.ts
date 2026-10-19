import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import { listMemories, createMemory, memoryToJson } from '@/lib/services/memories';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createBody = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  category: z.string().optional(),
  source: z.enum(['user', 'assistant']).optional(),
  confirmed: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
});

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser, url }) => {
    initDatabase();
    const rows = listMemories(authedUser.user.id, {
      q: url.searchParams.get('q') || undefined,
      category: url.searchParams.get('category') || undefined,
    });
    return { data: rows.map(memoryToJson) };
  },
});

export const POST = defineHandler({
  method: 'POST',
  schema: createBody,
  handler: async ({ authedUser, body }) => {
    initDatabase();
    return { data: memoryToJson(createMemory(authedUser.user.id, body)), status: 201 };
  },
});
