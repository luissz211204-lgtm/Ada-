'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet, errorMessage } from '@/lib/client/api';
import { Card, EmptyState, ErrorNote, PageHeader } from '@/lib/ui';
import { formatDate, formatInstant, PRIORITY_LABELS } from '@/lib/client/format';
import type { Delivery, Reminder, Task } from '@/lib/types/client';

type Summary = {
  today: string;
  weekday: string;
  tasks: { overdue: Task[]; dueToday: Task[]; priority: Task[]; totals: { open: number; overdue: number; dueToday: number; doneToday: number } };
  events: { today: any[]; upcoming: any[] };
  reminders: Reminder[];
  pendingDeliveries: Delivery[];
  approvalsPending: number;
  inboxPending: number;
  aiConfigured: boolean;
};

export default function DashboardPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      const res = await apiGet<Summary>('/api/dashboard/summary');
      setData(res);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <Card><p className="text-sm text-slate-500">Cargando resumen...</p></Card>;
  if (err) return <ErrorNote message={err} onRetry={load} />;
  if (!data) return null;

  return (
    <div>
      <PageHeader title={`Centro de mando — ${data.weekday}, ${formatDate(data.today)}`} subtitle="Todo conectado a datos reales." />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <h2 className="text-sm font-medium">Resumen del día</h2>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
            <div><dt className="text-slate-500">Abiertas</dt><dd className="font-medium">{data.tasks.totals.open}</dd></div>
            <div><dt className="text-slate-500">Vencidas</dt><dd className="font-medium text-red-600">{data.tasks.totals.overdue}</dd></div>
            <div><dt className="text-slate-500">Para hoy</dt><dd className="font-medium">{data.tasks.totals.dueToday}</dd></div>
            <div><dt className="text-slate-500">Hechas hoy</dt><dd className="font-medium text-emerald-600">{data.tasks.totals.doneToday}</dd></div>
          </dl>
        </Card>

        <Card>
          <h2 className="text-sm font-medium">Tareas prioritarias</h2>
          {data.tasks.priority.length ? (
            <ul className="mt-2 space-y-2">
              {data.tasks.priority.map(t => (
                <li key={t.id} className="flex justify-between gap-2 text-sm">
                  <span className="truncate">{t.title}</span>
                  <span className="text-xs text-slate-500">{PRIORITY_LABELS[t.priority] || t.priority}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="Sin prioridades sin fecha" description="Añade una tarea o establece prioridad." />}
        </Card>

        <Card>
          <h2 className="text-sm font-medium">Próximos compromisos</h2>
          {data.events.upcoming.length ? (
            <ul className="mt-2 space-y-2">
              {data.events.upcoming.map((e: any, i: number) => (
                <li key={i} className="text-sm">
                  <p className="font-medium">{e.title}</p>
                  <p className="text-xs text-slate-500">{formatInstant(e.starts_at)} · {e.date}</p>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="Sin eventos próximos" description="Agrega un evento en Calendario." />}
        </Card>

        <Card>
          <h2 className="text-sm font-medium">Pendientes</h2>
          <div className="mt-2 space-y-1 text-sm">
            <Link href="/dashboard/approvals" className="flex justify-between hover:underline">
              <span>Aprobaciones</span><span className="font-medium">{data.approvalsPending}</span>
            </Link>
            <Link href="/dashboard/inbox" className="flex justify-between hover:underline">
              <span>Bandeja</span><span className="font-medium">{data.inboxPending}</span>
            </Link>
            <Link href="/dashboard/reminders" className="flex justify-between hover:underline">
              <span>Recordatorios</span><span className="font-medium">{data.reminders.length}</span>
            </Link>
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-medium">Chat central (E.V.)</h2>
          <p className="mt-1 text-sm text-slate-500">
            {data.aiConfigured ? 'IA configurada. Abre el asistente para conversar.' : 'IA no configurada. Revisa Integraciones/Configuración.'}
          </p>
          <Link href="/dashboard/assistant" className="mt-2 inline-flex text-sm text-sky-600 hover:underline dark:text-sky-400">Ir al asistente</Link>
        </Card>

        <Card>
          <h2 className="text-sm font-medium">Recordatorios próximos</h2>
          {data.reminders.length ? (
            <ul className="mt-2 space-y-2">
              {data.reminders.map(r => (
                <li key={r.id} className="text-sm">
                  <p className="font-medium">{r.title}</p>
                  <p className="text-xs text-slate-500">{formatInstant(r.remind_at)}</p>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="Sin recordatorios programados" description="Crea uno desde Recordatorios." />}
        </Card>
      </div>
    </div>
  );
}
