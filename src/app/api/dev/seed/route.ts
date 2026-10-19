export const runtime = 'nodejs';

import { defineHandler } from '@/lib/api/handler';
import { initDatabase } from '@/lib/server/bootstrap';
import { ensureDemoUser } from '@/lib/server/bootstrap';

export const POST = defineHandler({
  method: 'POST',
  auth: false,
  handler: async () => {
    initDatabase();
    const demo = ensureDemoUser();
    return { data: { seeded: !!demo, demoId: demo?.id ?? null } };
  },
});
