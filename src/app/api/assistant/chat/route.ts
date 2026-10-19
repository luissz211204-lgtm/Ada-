import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import { runAssistantTurn } from '@/lib/ai/brain';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const body = z.object({
  message: z.string().min(1, 'El mensaje no puede estar vacío'),
  conversationId: z.string().optional().nullable(),
});

export const POST = defineHandler({
  method: 'POST',
  schema: body,
  handler: async ({ authedUser, body, ip }) => {
    initDatabase();
    const result = await runAssistantTurn(authedUser.user.id, {
      message: body.message,
      conversationId: body.conversationId ?? null,
      ip,
    });
    return { data: result };
  },
});
