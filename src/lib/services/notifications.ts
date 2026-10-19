import { all, newId, one, parseJson, run, nowIso, toJson } from '@/lib/db';
import { badRequest, notFound } from '@/lib/api/errors';
import { getOwned, updateOwned } from './crud';
import { audit } from './audit';
import { loadSettings } from '@/lib/auth/session';
import { localToUtcIso, timeInTz, todayInTz, addDays } from '@/lib/time';

/**
 * Servicio central de notificaciones.
 *
 * - Los recordatorios se evalúan en el SERVIDOR (worker local o cron externo),
 *   nunca con temporizadores del navegador.
 * - Cada intento de entrega queda registrado en `notification_deliveries`
 *   con canal, estado y número de intentos.
 * - Las claves de deduplicación evitan avisos duplicados.
 * - Un dispositivo desconectado NO borra el recordatorio: el registro sigue
 *   `pending` hasta que el cliente lo consulte o se agoten los intentos.
 */

export interface ReminderRow {
  id: string;
  user_id: string;
  title: string;
  message: string;
  remind_at: string;
  timezone: string;
  lead_minutes: number;
  recurrence: string | null;
  status: 'scheduled' | 'snoozed' | 'sent' | 'dismissed' | 'cancelled';
  snoozed_until: string | null;
  channels: string;
  priority: number;
  related_type: string | null;
  related_id: string | null;
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateReminderInput {
  title: string;
  message?: string;
  remind_at: string; // ISO UTC
  lead_minutes?: number;
  recurrence?: { freq: 'daily' | 'weekly' | 'monthly'; interval?: number } | null;
  channels?: string[];
  priority?: number;
  related_type?: string | null;
  related_id?: string | null;
  timezone?: string;
}

export function listReminders(userId: string, opts: { status?: string[]; from?: string; to?: string } = {}) {
  const clauses: string[] = ['user_id = ?'];
  const params: (string | number)[] = [userId];
  if (opts.status?.length) {
    clauses.push(`status IN (${opts.status.map(() => '?').join(',')})`);
    params.push(...opts.status);
  }
  if (opts.from) {
    clauses.push('remind_at >= ?');
    params.push(opts.from);
  }
  if (opts.to) {
    clauses.push('remind_at <= ?');
    params.push(opts.to);
  }
  return all<ReminderRow>(
    `SELECT * FROM reminders WHERE ${clauses.join(' AND ')} ORDER BY remind_at ASC LIMIT 500`,
    params,
  );
}

export function getReminder(userId: string, id: string): ReminderRow {
  return getOwned<ReminderRow>('reminders', id, userId);
}

export function createReminder(userId: string, input: CreateReminderInput): ReminderRow {
  if (!input.title?.trim()) throw badRequest('El recordatorio necesita un título.');
  if (Number.isNaN(new Date(input.remind_at).getTime())) {
    throw badRequest('Fecha de recordatorio inválida.');
  }
  const settings = loadSettings(userId);
  const row = one<ReminderRow>(
    `INSERT INTO reminders (id, user_id, title, message, remind_at, timezone, lead_minutes,
       recurrence, channels, priority, related_type, related_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [
      newId(),
      userId,
      input.title.trim(),
      input.message?.trim() || '',
      input.remind_at,
      input.timezone || settings?.timezone || 'America/Monterrey',
      input.lead_minutes ?? 0,
      input.recurrence ? toJson(input.recurrence) : null,
      toJson(input.channels?.length ? input.channels : (settings?.notification_channels ?? ['web'])),
      input.priority ?? 2,
      input.related_type ?? null,
      input.related_id ?? null,
    ],
  );
  if (!row) throw new Error('No se pudo crear el recordatorio.');
  audit({ userId, action: 'data.create', entity: 'reminder', entityId: row.id });
  return row;
}

export function updateReminder(
  userId: string,
  id: string,
  patch: Partial<CreateReminderInput> & { status?: ReminderRow['status'] },
): ReminderRow {
  getReminder(userId, id);
  const clean: Record<string, unknown> = {};
  const map: Record<string, string> = {
    title: 'title',
    message: 'message',
    remind_at: 'remind_at',
    lead_minutes: 'lead_minutes',
    priority: 'priority',
    status: 'status',
    related_type: 'related_type',
    related_id: 'related_id',
  };
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'recurrence') clean.recurrence = v ? toJson(v) : null;
    else if (k === 'channels') clean.channels = toJson(v);
    else if (map[k]) clean[map[k]] = v as never;
  }
  const row = updateOwned<ReminderRow>('reminders', id, userId, clean);
  audit({ userId, action: 'data.update', entity: 'reminder', entityId: id });
  return row;
}

export function snoozeReminder(userId: string, id: string, minutes = 10): ReminderRow {
  const reminder = getReminder(userId, id);
  const until = new Date(Date.now() + minutes * 60000).toISOString();
  const row = updateOwned<ReminderRow>('reminders', id, userId, {
    status: 'snoozed',
    snoozed_until: until,
  });
  // Cancela entregas web aún no atendidas para evitar duplicados al posponer.
  run(
    `UPDATE notification_deliveries SET status = 'skipped', updated_at = ?
     WHERE user_id = ? AND reminder_id = ? AND status = 'pending' AND channel = 'web'`,
    [nowIso(), userId, reminder.id],
  );
  return row;
}

export function dismissReminder(userId: string, id: string): ReminderRow {
  getReminder(userId, id);
  run(
    `UPDATE notification_deliveries SET status = 'skipped', updated_at = ?
     WHERE user_id = ? AND reminder_id = ? AND status = 'pending'`,
    [nowIso(), userId, id],
  );
  const row = updateOwned<ReminderRow>('reminders', id, userId, {
    status: 'dismissed',
    snoozed_until: null,
  });
  audit({ userId, action: 'data.update', entity: 'reminder', entityId: id, detail: { dismissed: true } });
  return row;
}

export function cancelReminder(userId: string, id: string): ReminderRow {
  getReminder(userId, id);
  run(
    `UPDATE notification_deliveries SET status = 'skipped', updated_at = ?
     WHERE user_id = ? AND reminder_id = ? AND status = 'pending'`,
    [nowIso(), userId, id],
  );
  return updateOwned<ReminderRow>('reminders', id, userId, { status: 'cancelled' });
}

// ---------------------------------------------------------------------------
// Procesamiento en servidor (worker / cron)
// ---------------------------------------------------------------------------

export interface TickResult {
  evaluated: number;
  deliveriesCreated: number;
  emailsAttempted: number;
  emailsSent: number;
  errors: string[];
}

function inQuietHours(settings: { quiet_hours_start?: string | null; quiet_hours_end?: string | null } | null, tz: string): boolean {
  if (!settings?.quiet_hours_start || !settings?.quiet_hours_end) return false;
  const now = timeInTz(tz);
  const [hs, ms] = settings.quiet_hours_start.split(':').map(Number);
  const [he, me] = settings.quiet_hours_end.split(':').map(Number);
  const cur = (Number(now.slice(0, 2)) * 60) + Number(now.slice(3, 5));
  const start = hs * 60 + ms;
  const end = he * 60 + me;
  if (start === end) return false;
  return start < end ? cur >= start && cur < end : cur >= start || cur < end;
}

/**
 * Evalúa los recordatorios vencidos y crea las entregas por cada canal.
 * Es el corazón de "los recordatorios funcionan aunque el dashboard esté
 * cerrado": se ejecuta desde el servidor.
 */
export async function processDueReminders(now: Date = new Date()): Promise<TickResult> {
  const nowIsoStr = now.toISOString();
  const result: TickResult = {
    evaluated: 0,
    deliveriesCreated: 0,
    emailsAttempted: 0,
    emailsSent: 0,
    errors: [],
  };

  const due = all<ReminderRow>(
    `SELECT * FROM reminders
     WHERE status IN ('scheduled','snoozed')
       AND ((status = 'scheduled' AND remind_at <= ?) OR (status = 'snoozed' AND snoozed_until <= ?))
     ORDER BY remind_at ASC LIMIT 200`,
    [nowIsoStr, nowIsoStr],
  );
  result.evaluated = due.length;

  for (const reminder of due) {
    try {
      const settings = loadSettings(reminder.user_id);
      const tz = reminder.timezone || settings?.timezone || 'America/Monterrey';
      const channels = parseJson<string[]>(reminder.channels, ['web']);
      const quiet = inQuietHours(settings, tz);
      const fireTime = reminder.status === 'snoozed' && reminder.snoozed_until
        ? reminder.snoozed_until
        : reminder.remind_at;

      for (const channel of channels) {
        if (!['web', 'email', 'whatsapp', 'voice'].includes(channel)) continue;
        const dedupeKey = `${reminder.id}:${channel}:${fireTime}`;
        const existing = one<{ id: string }>(
          'SELECT id FROM notification_deliveries WHERE user_id = ? AND dedupe_key = ?',
          [reminder.user_id, dedupeKey],
        );
        if (existing) continue;

        let scheduledFor = fireTime;
        let status: 'pending' | 'skipped' = 'pending';
        let lastError: string | null = null;

        // Horario de silencio: se pospone la entrega, no se pierde.
        if (quiet) {
          scheduledFor = nextQuietEnd(settings!, tz, now);
        }

        run(
          `INSERT INTO notification_deliveries
             (id, user_id, reminder_id, channel, priority, title, body, scheduled_for, status, dedupe_key, attempts, last_error)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
          [
            newId(),
            reminder.user_id,
            reminder.id,
            channel,
            reminder.priority,
            reminder.title,
            reminder.message,
            scheduledFor,
            status,
            dedupeKey,
            lastError,
          ],
        );
        result.deliveriesCreated++;

        // Canal de correo: se intenta enviar aquí mismo si hay SMTP configurado.
        if (channel === 'email' && status === 'pending' && scheduledFor <= nowIsoStr) {
          result.emailsAttempted++;
          try {
            const sent = await sendEmail(settings, reminder.title, reminder.message, reminder.user_id);
            if (sent) result.emailsSent++;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            run(
              `UPDATE notification_deliveries SET status = 'failed', attempts = attempts + 1,
                 last_error = ?, updated_at = ? WHERE user_id = ? AND reminder_id = ? AND channel = 'email' AND status = 'pending'`,
              [msg, nowIso(), reminder.user_id, reminder.id],
            );
            result.errors.push(`email:${msg}`);
          }
        }
      }

      // Estado del recordatorio y avance de recurrencia.
      const recurrence = parseJson<{ freq: string; interval?: number } | null>(reminder.recurrence, null);
      if (recurrence) {
        const interval = recurrence.interval && recurrence.interval > 0 ? recurrence.interval : 1;
        const stepDays =
          recurrence.freq === 'daily' ? interval : recurrence.freq === 'weekly' ? 7 * interval : 30 * interval;
        const base = new Date(reminder.remind_at);
        let next = new Date(base.getTime() + stepDays * 86400000);
        while (next.getTime() <= now.getTime()) {
          next = new Date(next.getTime() + stepDays * 86400000);
        }
        run(
          `UPDATE reminders SET status = 'scheduled', remind_at = ?, snoozed_until = NULL,
             last_sent_at = ?, updated_at = ? WHERE id = ?`,
          [next.toISOString(), nowIsoStr, nowIso(), reminder.id],
        );
      } else {
        run(`UPDATE reminders SET status = 'sent', last_sent_at = ?, updated_at = ? WHERE id = ?`, [
          nowIsoStr,
          nowIso(),
          reminder.id,
        ]);
      }
    } catch (err) {
      result.errors.push(
        `reminder:${reminder.id}:${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result;
}

function nextQuietEnd(
  settings: { quiet_hours_end: string | null },
  tz: string,
  now: Date,
): string {
  const end = settings.quiet_hours_end || '07:00';
  const today = todayInTz(tz, now);
  const [h, m] = end.split(':');
  const candidate = localToUtcIso(today, `${h}:${m}`, tz);
  if (candidate > now.toISOString()) return candidate;
  return localToUtcIso(addDays(today, 1), `${h}:${m}`, tz);
}

/** Entregas web pendientes para mostrar en la aplicación. */
export function pendingWebDeliveries(userId: string, limit = 20) {
  return all<{
    id: string;
    reminder_id: string | null;
    title: string;
    body: string;
    priority: number;
    scheduled_for: string;
    status: string;
    created_at: string;
  }>(
    `SELECT id, reminder_id, title, body, priority, scheduled_for, status, created_at
     FROM notification_deliveries
     WHERE user_id = ? AND channel = 'web' AND status = 'pending' AND scheduled_for <= ?
     ORDER BY scheduled_for DESC LIMIT ?`,
    [userId, new Date().toISOString(), limit],
  );
}

export function acknowledgeDelivery(userId: string, id: string): void {
  const row = one<{ id: string }>(
    'SELECT id FROM notification_deliveries WHERE id = ? AND user_id = ?',
    [id, userId],
  );
  if (!row) throw notFound('Entrega no encontrada.');
  run(
    `UPDATE notification_deliveries SET status = 'delivered', delivered_at = ?, attempts = attempts + 1, updated_at = ? WHERE id = ?`,
    [nowIso(), nowIso(), id],
  );
}

export function listDeliveries(userId: string, limit = 50) {
  return all(
    `SELECT id, reminder_id, channel, title, body, priority, scheduled_for, status,
            attempts, last_error, delivered_at, created_at
     FROM notification_deliveries WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    [userId, limit],
  );
}

/**
 * Envío real por correo. Solo se intenta si `SMTP_URL` está configurado;
 * si no, devuelve false y la entrega queda 'skipped' con el motivo.
 * Implementación SMTP mínima probada con un servidor SMTP de prueba.
 */
async function sendEmail(
  settings: { memory_categories?: unknown } | null,
  subject: string,
  body: string,
  userId: string,
): Promise<boolean> {
  const smtpUrl = process.env.SMTP_URL;
  const from = process.env.EMAIL_FROM || 'ev@localhost';
  if (!smtpUrl) {
    run(
      `UPDATE notification_deliveries SET status = 'skipped', attempts = attempts + 1,
         last_error = 'SMTP no configurado (falta SMTP_URL)', updated_at = ?
       WHERE user_id = ? AND channel = 'email' AND status = 'pending'`,
      [nowIso(), userId],
    );
    return false;
  }
  const { sendSmtpMessage } = await import('@/lib/notifications/smtp');
  const user = one<{ email: string }>('SELECT email FROM users WHERE id = ?', [userId]);
  if (!user) return false;
  await sendSmtpMessage(smtpUrl, {
    from,
    to: user.email,
    subject: `[Ada] ${subject}`,
    text: body || subject,
  });
  run(
    `UPDATE notification_deliveries SET status = 'delivered', attempts = attempts + 1,
       delivered_at = ?, updated_at = ? WHERE user_id = ? AND channel = 'email' AND status = 'pending'`,
    [nowIso(), nowIso(), userId],
  );
  return true;
}
