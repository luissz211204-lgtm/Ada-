export const dynamic = 'force-dynamic';

import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function HealthPage() {
  return (
    <DashboardShell>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <h1 className="text-lg font-semibold">Salud, entrenamiento y alimentación</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Rutinas, entrenamientos, comidas, compras y seguimiento. Datos sensibles, solo accesibles por el usuario.
        </p>
      </div>
    </DashboardShell>
  );
}
