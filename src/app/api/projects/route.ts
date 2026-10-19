import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import { listProjects, createProject } from '@/lib/services/projects';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createBody = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  description: z.string().optional(),
  category: z.enum(['personal', 'universidad', 'trabajo', 'negocio', 'salud', 'otro']).optional(),
  status: z.enum(['planning', 'active', 'paused', 'done', 'archived']).optional(),
  goal: z.string().optional(),
  start_date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
});

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser, url }) => {
    initDatabase();
    const status = url.searchParams.get('status') || undefined;
    const category = url.searchParams.get('category') || undefined;
    return { data: listProjects(authedUser.user.id, { status, category }) };
  },
});

export const POST = defineHandler({
  method: 'POST',
  schema: createBody,
  handler: async ({ authedUser, body, ip }) => {
    initDatabase();
    return { data: createProject(authedUser.user.id, body), status: 201 };
  },
});
