export const dynamic = 'force-dynamic';

import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function OrganizationPage() {
  return (
    <DashboardShell>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <h1 className="text-lg font-semibold">Mi organización</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Visión global: tareas, proyectos, objetivos, hitos y agenda.
        </p>
      </div>
    </DashboardShell>
  );
}
