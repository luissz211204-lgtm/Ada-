import { defineHandler } from '@/lib/api/handler';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser }) => {
    initDatabase();
    return { data: { user: authedUser.user, settings: authedUser.settings } };
  },
});
