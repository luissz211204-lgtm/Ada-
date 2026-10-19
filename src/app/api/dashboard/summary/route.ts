import { defineHandler } from '@/lib/api/handler';
import { dashboardSummary } from '@/lib/services/dashboard';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser }) => {
    initDatabase();
    const tz = authedUser.settings.timezone || 'America/Monterrey';
    return { data: dashboardSummary(authedUser.user.id, tz) };
  },
});
