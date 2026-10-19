import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import { pendingWebDeliveries, acknowledgeDelivery, listDeliveries } from '@/lib/services/notifications';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser, url }) => {
    initDatabase();
    const userId = authedUser.user.id;
    if (url.searchParams.get('all') === '1') {
      return { data: { deliveries: listDeliveries(userId) } };
    }
    return { data: { deliveries: pendingWebDeliveries(userId) } };
  },
});

const body = z.object({ deliveryId: z.string().min(1) });

export const POST = defineHandler({
  method: 'POST',
  schema: body,
  handler: async ({ authedUser, body }) => {
    initDatabase();
    acknowledgeDelivery(authedUser.user.id, body.deliveryId);
    return { data: { ok: true } };
  },
});
