import { all, one, newId, nowIso } from '@/lib/db';
import { badRequest } from '@/lib/api/errors';
import { getOwned, updateOwned, deleteOwned } from './crud';
import { audit } from './audit';
import { localToUtcIso, todayInTz, addDays, formatInstant } from '@/lib/time';

export interface EventRow {
  id: string;
  user_id: string;
  title: string;
  description: string;
  location: string;
  starts_at: string;
  ends_at: string;
  all_day: number;
  project_id: string | null;
  task_id: string | null;
  recurrence: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export function listEvents(
  userId: string,
  opts: { from?: string; to?: string; project_id?: string; limit?: number } = {},
) {
  const clauses = ['user_id = ?'];
  const params: (string | number)[] = [userId];
  if (opts.from) {
    clauses.push('ends_at >= ?');
    params.push(opts.from);
  }
  if (opts.to) {
    clauses.push('starts_at <= ?');
    params.push(opts.to);
  }
  if (opts.project_id) {
    clauses.push('project_id = ?');
    params.push(opts.project_id);
  }
  return all<EventRow>(
    `SELECT * FROM calendar_events WHERE ${clauses.join(' AND ')} ORDER BY starts_at ASC LIMIT ?`,
    [...params, opts.limit ?? 300],
  );
}

export function getEvent(userId: string, id: string): EventRow {
  return getOwned<EventRow>('calendar_events', id, userId);
}

/**
 * Crea un evento. Acepta hora local del usuario (`date` + `time`) y la
 * convierte a UTC usando su zona horaria configurable.
 */
export function createEvent(
  userId: string,
  input: {
    title: string;
    date: string;
    time?: string;
    duration_minutes?: number;
    description?: string;
    location?: string;
    project_id?: string | null;
    task_id?: string | null;
  },
  tz: string,
  meta: { source?: 'user' | 'assistant'; ip?: string } = {},
): EventRow {
  if (!input.title?.trim()) throw badRequest('El evento necesita un título.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date || '')) throw badRequest('Fecha del evento inválida (usa YYYY-MM-DD).');
  if (input.project_id) getOwned('projects', input.project_id, userId);
  if (input.task_id) getOwned('tasks', input.task_id, userId);

  const startLocalTime = input.time || '09:00';
  const startsAt = localToUtcIso(input.date, startLocalTime, tz);
  const duration = input.duration_minutes ?? 60;
  const endsAt = new Date(new Date(startsAt).getTime() + duration * 60000).toISOString();

  const row = one<EventRow>(
    `INSERT INTO calendar_events (id, user_id, title, description, location, starts_at, ends_at, project_id, task_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [
      newId(),
      userId,
      input.title.trim(),
      input.description || '',
      input.location || '',
      startsAt,
      endsAt,
      input.project_id ?? null,
      input.task_id ?? null,
    ],
  );
  if (!row) throw new Error('No se pudo crear el evento.');
  audit({ userId, action: 'data.create', entity: 'calendar_event', entityId: row.id, detail: { source: meta.source ?? 'user' }, ip: meta.ip });
  return row;
}

export function updateEvent(userId: string, id: string, patch: Record<string, unknown>): EventRow {
  const before = getEvent(userId, id);
  const clean: Record<string, unknown> = {};
  for (const key of ['title', 'description', 'location', 'project_id']) {
    if (patch[key] !== undefined) clean[key] = patch[key] as never;
  }
  if (patch.starts_at !== undefined) clean.starts_at = patch.starts_at;
  if (patch.ends_at !== undefined) clean.ends_at = patch.ends_at;
  if (patch.all_day !== undefined) clean.all_day = patch.all_day ? 1 : 0;
  const startsAt = (clean.starts_at as string) || before.starts_at;
  const endsAt = (clean.ends_at as string) || before.ends_at;
  if (new Date(endsAt) < new Date(startsAt)) throw badRequest('El fin no puede ser anterior al inicio.');
  return updateOwned<EventRow>('calendar_events', id, userId, clean);
}

export function deleteEvent(userId: string, id: string): void {
  deleteOwned('calendar_events', id, userId);
  audit({ userId, action: 'data.delete', entity: 'calendar_event', entityId: id });
}

/** Detecta solapamientos reales entre eventos del usuario. */
export function findConflicts(
  userId: string,
  startsAt: string,
  endsAt: string,
  excludeId?: string,
): EventRow[] {
  const params: string[] = [userId, endsAt, startsAt];
  let sql = `SELECT * FROM calendar_events WHERE user_id = ? AND starts_at < ? AND ends_at > ?`;
  if (excludeId) {
    sql += ' AND id <> ?';
    params.push(excludeId);
  }
  return all<EventRow>(`${sql} ORDER BY starts_at`, params);
}

export interface AgendaDay {
  date: string;
  events: { id: string; title: string; starts_at: string; ends_at: string; location: string; hora: string }[];
}

/** Agenda de los próximos N días (para dashboard y asistente). */
export function agenda(userId: string, tz: string, days = 7): AgendaDay[] {
  const today = todayInTz(tz);
  const from = localToUtcIso(today, '00:00', tz);
  const to = localToUtcIso(addDays(today, days), '23:59', tz);
  const events = listEvents(userId, { from, to, limit: 200 });
  const result: AgendaDay[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(today, i);
    result.push({
      date,
      events: events
        .filter((e) => todayInTz(tz, e.starts_at) === date)
        .map((e) => ({
          id: e.id,
          title: e.title,
          starts_at: e.starts_at,
          ends_at: e.ends_at,
          location: e.location,
          hora: formatInstant(e.starts_at, tz, { timeStyle: 'short' }),
        })),
    });
  }
  return result;
}

export function countUpcomingEvents(userId: string, tz: string): number {
  const today = todayInTz(tz);
  const from = localToUtcIso(today, '00:00', tz);
  const to = localToUtcIso(addDays(today, 7), '23:59', tz);
  return listEvents(userId, { from, to }).length;
}

export function eventsInMonth(userId: string, tz: string, month: string) {
  const [y, m] = month.split('-').map(Number);
  const first = `${month}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const last = `${month}-${String(lastDay).padStart(2, '0')}`;
  return listEvents(userId, {
    from: localToUtcIso(first, '00:00', tz),
    to: localToUtcIso(last, '23:59', tz),
  });
}

export function nowForUser(tz: string): string {
  return nowIso();
}

export function eventSummaryText(userId: string, tz: string, limit = 3): string {
  const next = listEvents(userId, { from: new Date().toISOString(), limit }).map(
    (e) => `${formatInstant(e.starts_at, tz, { dateStyle: 'short', timeStyle: 'short' })} ${e.title}`,
  );
  return next.length ? next.join(' | ') : 'Sin eventos próximos';
}
