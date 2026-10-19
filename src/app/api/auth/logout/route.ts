import { defineHandler } from '@/lib/api/handler';
import { revokeSession, SESSION_COOKIE } from '@/lib/auth/session';
import { audit } from '@/lib/services/audit';

export const runtime = 'nodejs';

export const POST = defineHandler({
  method: 'POST',
  handler: async ({ req, authedUser }) => {
    revokeSession(req.headers.get('cookie')?.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))?.[1] || '');
    audit({ userId: authedUser.user.id, action: 'auth.logout' });
    return { data: { ok: true } };
  },
});
