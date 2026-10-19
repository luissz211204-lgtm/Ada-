import { defineHandler } from '@/lib/api/handler';
import { listConversations, listMessages, toolRunHistory } from '@/lib/ai/brain';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser, url }) => {
    initDatabase();
    const userId = authedUser.user.id;
    const conversationId = url.searchParams.get('conversationId');
    if (conversationId) {
      return { data: { messages: listMessages(userId, conversationId) } };
    }
    return { data: { conversations: listConversations(userId), toolRuns: toolRunHistory(userId, 25) } };
  },
});
