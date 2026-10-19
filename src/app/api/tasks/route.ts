import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import { listTasks, getTaskDetail, createTask, updateTask, completeTask } from '@/lib/services/tasks';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';

const listQuery = z.object({
  status: z.string().optional(),
  overdue: z.string().optional(),
});

const createBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.coerce.number().optional(),
  due_date: z.string().optional(),
  due_time: z.string().optional(),
  project_id: z.string().optional(),
  parent_task_id: z.string().optional(),
});

const updateBody = createBody.partial();

export const GET = defineHandler({
  method: 'GET',
  query: listQuery,
  handler: async ({ authedUser, query }) => {
    initDatabase();
    const status = query.status ? (query.status.split(',') as any) : undefined;
    const tasks = listTasks(authedUser.user.id, {
      status,
      overdue: query.overdue === '1',
    });
    return { data: tasks };
  },
});

export const POST = defineHandler({
  method: 'POST',
  schema: createBody,
  handler: async ({ authedUser, body, ip }) => {
    initDatabase();
    const task = createTask(authedUser.user.id, body, { ip });
    return { data: task, status: 201 };
  },
});
