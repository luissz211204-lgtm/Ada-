'use client';

/** Utilidades de formato para la interfaz (es-MX). */

export function formatMoney(cents: number, currency = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency }).format((cents || 0) / 100);
}

/** Formatea un instante ISO en la zona horaria indicada. */
export function formatInstant(
  iso: string | null | undefined,
  tz?: string,
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-MX', { ...opts, timeZone: tz }).format(d);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeZone: 'UTC' }).format(d);
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '';
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60_000, 'minute'],
    [3_600_000, 'hour'],
    [86_400_000, 'day'],
    [604_800_000, 'week'],
  ];
  const rtf = new Intl.RelativeTimeFormat('es-MX', { numeric: 'auto' });
  if (abs < 60_000) return diff >= 0 ? 'en unos segundos' : 'hace un momento';
  if (abs < 3_600_000) return rtf.format(Math.round(diff / units[0][0]), 'minute');
  if (abs < 86_400_000) return rtf.format(Math.round(diff / units[1][0]), 'hour');
  if (abs < 604_800_000) return rtf.format(Math.round(diff / units[2][0]), 'day');
  return rtf.format(Math.round(diff / units[3][0]), 'week');
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const PRIORITY_LABELS: Record<number, string> = {
  1: 'Crítica',
  2: 'Alta',
  3: 'Media',
  4: 'Baja',
};

export const PRIORITY_CLASSES: Record<number, string> = {
  1: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  2: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  3: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  4: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
};
