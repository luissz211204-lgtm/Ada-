import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import { listApprovals, decideApproval, pendingApprovalsCount } from '@/lib/services/approvals';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser }) => {
    initDatabase();
    const userId = authedUser.user.id;
    return {
      data: {
        pending: listApprovals(userId, 'pending'),
        recent: listApprovals(userId, 'approved').slice(0, 10),
        pendingCount: pendingApprovalsCount(userId),
      },
    };
  },
});

const body = z.object({
  approvalId: z.string().min(1),
  decision: z.enum(['approve', 'reject']),
});

export const POST = defineHandler({
  method: 'POST',
  schema: body,
  handler: async ({ authedUser, body, ip }) => {
    initDatabase();
    const result = await decideApproval(authedUser.user.id, body.approvalId, body.decision, ip);
    return { data: result };
  },
});
