import Link from 'next/link';

export const metadata = {
  title: 'E.V. — Centro de mando de tu vida',
};

export default function RootPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-white to-slate-50 text-center dark:from-slate-950 dark:to-slate-900">
      <main className="max-w-3xl px-4 py-10">
        <h1 className="text-5xl font-bold tracking-tight text-slate-900 dark:text-white md:text-6xl">
          E.V.
        </h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
          Sistema central de vida personal con inteligencia artificial.
        </p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Una sola cuenta, una sola base de datos, un cerebro central.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white shadow hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
          >
            Abrir mi centro de mando
          </Link>
          <Link
            href="/auth/login"
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-900 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/auth/register"
            className="rounded-lg px-5 py-2.5 text-sm font-medium text-slate-600 hover:underline dark:text-slate-300"
          >
            Crear cuenta
          </Link>
        </div>
      </main>
    </div>
  );
}
