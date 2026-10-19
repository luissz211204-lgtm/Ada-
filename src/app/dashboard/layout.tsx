export const dynamic = 'force-dynamic';

import type { ReactNode } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionUser, SESSION_COOKIE } from '@/lib/auth/session';
import { initDatabase } from '@/lib/server/bootstrap';
import { DashboardShell } from '@/components/layout/dashboard-shell';

/**
 * Protección de todas las páginas del panel desde el servidor: si no hay
 * sesión válida, se redirige al login. El usuario se pasa al armazón de la UI.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  initDatabase();
  const cookieStore = await cookies();
  const user = getSessionUser(cookieStore.get(SESSION_COOKIE)?.value);
  if (!user) redirect('/auth/login');

  return (
    <DashboardShell userName={user.user.name} assistantName={user.settings.assistant_name}>
      {children}
    </DashboardShell>
  );
}
