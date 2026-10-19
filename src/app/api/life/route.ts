import { defineHandler } from '@/lib/api/handler';
import { listGoals, listHabits, routinesSummary, personalReview } from '@/lib/services/life';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser, url }) => {
    initDatabase();
    const userId = authedUser.user.id;
    const tz = authedUser.settings.timezone || 'America/Monterrey';
    const period = url.searchParams.get('period') === 'day' ? 'day' : 'week';
    return {
      data: {
        goals: listGoals(userId),
        habits: listHabits(userId, tz),
        routines: routinesSummary(userId, tz),
        review: personalReview(userId, tz, period),
      },
    };
  },
});
