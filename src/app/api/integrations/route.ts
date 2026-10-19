import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import { integrationStatuses, upsertIntegration, type Provider } from '@/lib/services/integrations';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser }) => {
    initDatabase();
    const settings = authedUser.settings;
    return {
      data: {
        integrations: integrationStatuses(authedUser.user.id),
        aiConfigured: Boolean(process.env.AI_API_KEY),
        aiModel: settings.ai_model || process.env.AI_MODEL || null,
        voiceEnabled: settings.voice_enabled === 1,
      },
    };
  },
});

const body = z.object({
  provider: z.enum(['ai', 'email', 'whatsapp', 'voice', 'google_calendar', 'telegram']),
  status: z.enum(['disconnected', 'configured', 'connected']).optional(),
  config: z.record(z.unknown()).optional(),
});

export const PATCH = defineHandler({
  method: 'PATCH',
  schema: body,
  handler: async ({ authedUser, body }) => {
    initDatabase();
    return {
      data: upsertIntegration(authedUser.user.id, body.provider as Provider, {
        status: body.status,
        config: body.config,
      }),
    };
  },
});
