import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import {
  getProjectDetail,
  updateProject,
  deleteProject,
  addMilestone,
  setMilestoneStatus,
  deleteMilestone,
  addDecision,
  projectProgressLog,
} from '@/lib/services/projects';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateBody = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(['planning', 'active', 'paused', 'done', 'archived']).optional(),
  goal: z.string().optional(),
  start_date: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  progress: z.coerce.number().optional(),
});

const actionBody = z.discriminatedUnion('action', [
  z.object({ action: z.literal('addMilestone'), title: z.string().min(1), due_date: z.string().nullable().optional() }),
  z.object({ action: z.literal('toggleMilestone'), milestoneId: z.string().min(1), done: z.boolean() }),
  z.object({ action: z.literal('deleteMilestone'), milestoneId: z.string().min(1) }),
  z.object({ action: z.literal('addDecision'), title: z.string().min(1), content: z.string().optional() }),
]);

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser, params, url }) => {
    initDatabase();
    const userId = authedUser.user.id;
    if (url.searchParams.get('view') === 'progress') {
      return { data: projectProgressLog(userId, params.id) };
    }
    return { data: getProjectDetail(userId, params.id) };
  },
});

export const PATCH = defineHandler({
  method: 'PATCH',
  schema: updateBody,
  handler: async ({ authedUser, params, body }) => {
    initDatabase();
    return { data: updateProject(authedUser.user.id, params.id, body) };
  },
});

export const POST = defineHandler({
  method: 'POST',
  schema: actionBody,
  handler: async ({ authedUser, params, body }) => {
    initDatabase();
    const userId = authedUser.user.id;
    switch (body.action) {
      case 'addMilestone':
        return { data: addMilestone(userId, params.id, { title: body.title, due_date: body.due_date }), status: 201 };
      case 'toggleMilestone':
        return { data: setMilestoneStatus(userId, params.id, body.milestoneId, body.done) };
      case 'deleteMilestone':
        deleteMilestone(userId, params.id, body.milestoneId);
        return { data: { ok: true } };
      case 'addDecision':
        return { data: addDecision(userId, params.id, { title: body.title, content: body.content }), status: 201 };
    }
  },
});

export const DELETE = defineHandler({
  method: 'DELETE',
  handler: async ({ authedUser, params }) => {
    initDatabase();
    deleteProject(authedUser.user.id, params.id);
    return { data: { ok: true } };
  },
});
