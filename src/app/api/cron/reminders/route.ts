import { defineHandler } from '@/lib/api/handler';
import { processDueReminders } from '@/lib/services/notifications';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';

/**
 * Endpoint protegido por CRON_SECRET para ejecución externa (Vercel Cron).
 * En desarrollo local se usa scripts/worker.ts; en producción debe llamarse
 * periódicamente desde un cron autorizado.
 */
export const POST = defineHandler({
  method: 'POST',
  auth: false,
  handler: async ({ req }) => {
    const secret = process.env.CRON_SECRET;
    if (!secret) return { data: { error: 'CRON_SECRET no configurado.' }, status: 500 };
    const provided = req.headers.get('x-ev-cron-secret');
    if (provided !== secret) {
      return { data: { error: 'No autorizado.' }, status: 401 };
    }
    initDatabase();
    const result = await processDueReminders();
    return { data: result };
  },
});
