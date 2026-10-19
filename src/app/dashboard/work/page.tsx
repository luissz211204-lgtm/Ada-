export const dynamic = 'force-dynamic';

import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function WorkPage() {
  return (
    <DashboardShell>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <h1 className="text-lg font-semibold">Trabajo y negocio</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Clientes, órdenes, cotizaciones y seguimiento. Separados conceptualmente del ámbito personal.
        </p>
      </div>
    </DashboardShell>
  );
}
