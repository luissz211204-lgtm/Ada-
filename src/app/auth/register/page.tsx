export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SESSION_COOKIE, getSessionUser, sessionCookieOptions } from '@/lib/auth/session';
import { registerUser } from '@/lib/auth/flows';
import { initDatabase } from '@/lib/server/bootstrap';

export const metadata = { title: 'Crear cuenta' };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  initDatabase();
  const store = await cookies();
  if (getSessionUser(store.get(SESSION_COOKIE)?.value)) redirect('/dashboard');
  const params = await searchParams;

  async function register(formData: FormData) {
    'use server';
    initDatabase();
    const result = registerUser({
      name: String(formData.get('name') || ''),
      email: String(formData.get('email') || ''),
      password: String(formData.get('password') || ''),
    });
    if (!result.ok) {
      redirect(`/auth/register?err=${encodeURIComponent(result.error)}`);
    }
    const c = await cookies();
    c.set(SESSION_COOKIE, result.token, sessionCookieOptions());
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <form
        action={register}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div>
          <h1 className="text-lg font-semibold">Crear cuenta</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Una sola cuenta para todo tu sistema.
          </p>
        </div>
        {params.err && <p className="text-sm text-red-500">{params.err}</p>}
        <div className="space-y-1">
          <label className="text-sm" htmlFor="name">
            Nombre
          </label>
          <input
            id="name"
            name="name"
            required
            autoComplete="name"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm" htmlFor="email">
            Correo
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm" htmlFor="password">
            Contraseña (mín. 8 caracteres, con letra y número)
          </label>
          <input
            id="password"
            name="password"
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900"
          />
        </div>
        <button
          type="submit"
          className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
        >
          Registrarme
        </button>
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          <Link href="/auth/login" className="underline">
            Ya tengo cuenta
          </Link>
        </p>
      </form>
    </div>
  );
}
