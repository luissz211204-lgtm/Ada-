export const dynamic = 'force-dynamic';

import { DashboardShell } from '@/components/layout/dashboard-shell';

export default function FinancePage() {
  return (
    <DashboardShell>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <h1 className="text-lg font-semibold">Finanzas personales</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Ingresos, gastos, presupuestos, deudas y objetivos de ahorro. Cálculos sobre datos reales.
        </p>
      </div>
    </DashboardShell>
  );
}
