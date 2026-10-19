import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import { getTaskDetail, updateTask, completeTask, deleteTask } from '@/lib/services/tasks';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';

const params = z.object({ id: z.string() });

const updateBody = z.object({
  title: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'done', 'cancelled']).optional(),
  priority: z.coerce.number().optional(),
  due_date: z.string().nullable().optional(),
});

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser, params }) => {
    initDatabase();
    const task = getTaskDetail(authedUser.user.id, params.id);
    return { data: task };
  },
});

export const PATCH = defineHandler({
  method: 'PATCH',
  schema: updateBody,
  handler: async ({ authedUser, params, body, ip }) => {
    initDatabase();
    const task = updateTask(authedUser.user.id, params.id, body, { ip });
    return { data: task };
  },
});

export const DELETE = defineHandler({
  method: 'DELETE',
  handler: async ({ authedUser, params }) => {
    initDatabase();
    deleteTask(authedUser.user.id, params.id);
    return { data: { ok: true } };
  },
});
