import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { ServiceWorkerRegister } from '@/components/service-worker-register';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Ada — Centro de mando de tu vida',
    template: '%s · Ada',
  },
  description:
    'Sistema central de vida personal con inteligencia artificial: tareas, recordatorios, proyectos, finanzas, salud y un cerebro central.',
  applicationName: 'Ada',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
  appleWebApp: {
    capable: true,
    title: 'Ada',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#020617' },
  ],
};

/** Aplica el tema guardado antes del primer pintado para evitar destellos. */
const THEME_INIT = `(function(){try{var m=localStorage.getItem('ev.theme')||'system';var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var dark=m==='dark'||(m==='system'&&d);var r=document.documentElement;r.classList.add(dark?'dark':'light');}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
