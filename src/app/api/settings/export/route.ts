import { defineHandler } from '@/lib/api/handler';
import { exportUserData } from '@/lib/services/account';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser }) => {
    initDatabase();
    return { data: exportUserData(authedUser.user.id) };
  },
});
