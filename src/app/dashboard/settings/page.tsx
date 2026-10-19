export const dynamic = 'force-dynamic';

import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function SettingsPage() {
  return (
    <DashboardShell>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <h1 className="text-lg font-semibold">Configuración</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Perfil, zona horaria, tema, asistente, IA, notificaciones, integraciones y seguridad.
        </p>
      </div>
    </DashboardShell>
  );
}
