/**
 * Utilidades de fecha y zona horaria.
 * - Los instantes se almacenan en UTC (ISO-8601 con 'Z').
 * - Las fechas locales se calculan con la zona del usuario
 *   (por defecto America/Monterrey) usando Intl (sin dependencias).
 */

export const DEFAULT_TZ = 'America/Monterrey';

export function tzOf(settings?: { timezone?: string | null } | string | null): string {
  if (typeof settings === 'string') return settings || DEFAULT_TZ;
  return settings?.timezone || DEFAULT_TZ;
}

const partsCache = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    partsCache.set(tz, f);
  }
  return f;
}

export interface ZonedParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
}

export function zonedParts(date: Date | string, tz: string): ZonedParts {
  const d = typeof date === 'string' ? new Date(date) : date;
  const parts = formatter(tz).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') === '24' ? '00' : get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

/** 'YYYY-MM-DD' en la zona horaria dada. */
export function todayInTz(tz: string, date: Date | string = new Date()): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${p.month}-${p.day}`;
}

/** 'HH:MM' en la zona horaria dada. */
export function timeInTz(tz: string, date: Date | string = new Date()): string {
  const p = zonedParts(date, tz);
  return `${p.hour}:${p.minute}`;
}

/** Combina 'YYYY-MM-DD' y 'HH:MM' locales en un instante ISO UTC. */
export function localToUtcIso(localDate: string, localTime: string, tz: string): string {
  const guess = new Date(`${localDate}T${localTime || '00:00'}:00Z`);
  // Dos pasadas para corregir el desfase de la zona horaria.
  let d = guess;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(d, tz);
    const asUtc = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
      Number(p.second),
    );
    const target = Date.UTC(
      Number(localDate.slice(0, 4)),
      Number(localDate.slice(5, 7)) - 1,
      Number(localDate.slice(8, 10)),
      Number((localTime || '00:00').slice(0, 2)),
      Number((localTime || '00:00').slice(3, 5)),
      0,
    );
    d = new Date(guess.getTime() + (target - asUtc));
  }
  return d.toISOString();
}

/** Diferencia en días entre dos fechas 'YYYY-MM-DD' (b - a). */
export function daysBetween(a: string, b: string): number {
  const da = Date.UTC(Number(a.slice(0, 4)), Number(a.slice(5, 7)) - 1, Number(a.slice(8, 10)));
  const db = Date.UTC(Number(b.slice(0, 4)), Number(b.slice(5, 7)) - 1, Number(b.slice(8, 10)));
  return Math.round((db - da) / 86400000);
}

/** Suma días a una fecha 'YYYY-MM-DD'. */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Nombre localizado del día de la semana para una fecha 'YYYY-MM-DD'. */
export function weekdayName(dateStr: string, tz: string): string {
  const iso = localToUtcIso(dateStr, '12:00', tz);
  return new Intl.DateTimeFormat('es-MX', {
    timeZone: tz,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(iso));
}

/** Formatea un instante ISO para mostrar en la zona del usuario. */
export function formatInstant(
  iso: string,
  tz: string,
  opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
): string {
  return new Intl.DateTimeFormat('es-MX', { ...opts, timeZone: tz }).format(new Date(iso));
}
