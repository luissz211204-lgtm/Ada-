import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import { completeTask } from '@/lib/services/tasks';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';

const params = z.object({ id: z.string() });

export const POST = defineHandler({
  method: 'POST',
  handler: async ({ authedUser, params }) => {
    initDatabase();
    const res = completeTask(authedUser.user.id, params.id);
    return { data: res };
  },
});
