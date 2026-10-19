export const runtime = 'nodejs';

import { defineHandler } from '@/lib/api/handler';
import { initDatabase } from '@/lib/server/bootstrap';
import { migrate, migrationStatus } from '@/lib/db/migrate';

export const GET = defineHandler({
  method: 'GET',
  auth: false,
  handler: async () => {
    initDatabase();
    const status = migrationStatus();
    return { data: status };
  },
});

export const POST = defineHandler({
  method: 'POST',
  auth: false,
  handler: async () => {
    initDatabase();
    migrate();
    const status = migrationStatus();
    return { data: { ...status, appliedOk: true } };
  },
});
