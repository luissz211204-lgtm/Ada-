export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, getSessionUser, revokeSession } from '@/lib/auth/session';
import { initDatabase } from '@/lib/server/bootstrap';
import { audit } from '@/lib/services/audit';

export default async function LogoutPage() {
  initDatabase();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    const user = getSessionUser(token);
    revokeSession(token);
    audit({ userId: user?.user.id ?? null, action: 'auth.logout' });
  }
  cookieStore.delete(SESSION_COOKIE);
  redirect('/auth/login');
}
