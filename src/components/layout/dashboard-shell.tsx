import Link from 'next/link';
import type { ReactNode } from 'react';
import { ThemeToggle } from '@/components/theme-toggle';

const nav = [
  { href: '/dashboard', label: 'Inicio' },
  { href: '/dashboard/tasks', label: 'Tareas' },
  { href: '/dashboard/calendar', label: 'Calendario' },
  { href: '/dashboard/reminders', label: 'Recordatorios' },
  { href: '/dashboard/projects', label: 'Proyectos' },
  { href: '/dashboard/inbox', label: 'Bandeja' },
  { href: '/dashboard/assistant', label: 'Asistente' },
  { href: '/dashboard/notes', label: 'Notas' },
  { href: '/dashboard/life', label: 'Vida' },
  { href: '/dashboard/finance', label: 'Finanzas' },
  { href: '/dashboard/health', label: 'Salud' },
  { href: '/dashboard/nutrition', label: 'Nutrición' },
  { href: '/dashboard/work', label: 'Trabajo' },
  { href: '/dashboard/documents', label: 'Documentos' },
  { href: '/dashboard/automations', label: 'Automatizaciones' },
  { href: '/dashboard/devices', label: 'Dispositivos' },
  { href: '/dashboard/integrations', label: 'Integraciones' },
  { href: '/dashboard/settings', label: 'Configuración' },
];

export function DashboardShell({
  children,
  userName,
  assistantName = 'Ada',
}: {
  children: ReactNode;
  userName?: string;
  assistantName?: string;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/dashboard" className="shrink-0 text-lg font-semibold tracking-tight">
              {assistantName}
            </Link>
            <nav className="hidden flex-wrap gap-1 lg:flex">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {userName && (
              <span className="hidden text-sm text-slate-500 dark:text-slate-400 sm:inline">
                {userName}
              </span>
            )}
            <ThemeToggle />
            <Link
              href="/auth/logout"
              className="rounded-lg px-2.5 py-1.5 text-sm text-slate-600 hover:underline dark:text-slate-300"
            >
              Salir
            </Link>
          </div>
        </div>
        <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 pb-2 lg:hidden">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
