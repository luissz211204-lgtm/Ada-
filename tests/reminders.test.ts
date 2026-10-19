import { describe, it, expect } from 'vitest';
import { makeUser } from './helpers';
import { run, one } from '@/lib/db';
import {
  createReminder,
  processDueReminders,
  pendingWebDeliveries,
  snoozeReminder,
  dismissReminder,
  getReminder,
} from '@/lib/services/notifications';

function setQuietHours(userId: string, start: string | null, end: string | null): void {
  run('UPDATE user_settings SET quiet_hours_start = ?, quiet_hours_end = ? WHERE user_id = ?', [
    start,
    end,
    userId,
  ]);
}

/** 'HH:MM' a partir de minutos del día (con vuelta de día). */
function hhmm(totalMinutes: number): string {
  const m = ((totalMinutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

describe('recordatorios y procesamiento en servidor', () => {
  it('procesa un recordatorio vencido y crea la entrega web', async () => {
    const u = makeUser('rem');
    const r = createReminder(u.id, {
      title: 'Beber agua',
      remind_at: new Date(Date.now() - 60000).toISOString(),
      channels: ['web'],
    });
    const res = await processDueReminders();
    expect(res.deliveriesCreated).toBeGreaterThanOrEqual(1);
    expect(getReminder(u.id, r.id).status).toBe('sent');
    expect(pendingWebDeliveries(u.id).some((d) => d.reminder_id === r.id)).toBe(true);
  });

  it('no duplica entregas para el mismo instante (deduplicación)', async () => {
    const u = makeUser('dedupe');
    const fireAt = new Date(Date.now() - 60000).toISOString();
    const r = createReminder(u.id, { title: 'Uno', remind_at: fireAt, channels: ['web'] });
    await processDueReminders();

    // Se vuelve a marcar como programado con el mismo instante: no debe repetir.
    run("UPDATE reminders SET status = 'scheduled' WHERE id = ?", [r.id]);
    const res2 = await processDueReminders();

    const count = one<{ c: number }>(
      'SELECT COUNT(*) AS c FROM notification_deliveries WHERE reminder_id = ?',
      [r.id],
    );
    expect(Number(count?.c)).toBe(1);
    expect(res2.deliveriesCreated).toBe(0);
  });

  it('avanza la recurrencia y reprograma el recordatorio', async () => {
    const u = makeUser('recrem');
    const r = createReminder(u.id, {
      title: 'Diario',
      remind_at: new Date(Date.now() - 120000).toISOString(),
      channels: ['web'],
      recurrence: { freq: 'daily' },
    });
    await processDueReminders();
    const after = getReminder(u.id, r.id);
    expect(after.status).toBe('scheduled');
    expect(new Date(after.remind_at).getTime()).toBeGreaterThan(Date.now());
  });

  it('pospone las entregas durante el horario de silencio sin perderlas', async () => {
    const u = makeUser('quiet');
    const now = new Date();
    const cur = now.getUTCHours() * 60 + now.getUTCMinutes();
    setQuietHours(u.id, hhmm(cur - 60), hhmm(cur + 60));

    const r = createReminder(u.id, {
      title: 'Silencio',
      remind_at: new Date(Date.now() - 60000).toISOString(),
      channels: ['web'],
      timezone: 'UTC',
    });
    await processDueReminders();

    const row = one<{ scheduled_for: string }>(
      'SELECT scheduled_for FROM notification_deliveries WHERE reminder_id = ?',
      [r.id],
    );
    expect(row).toBeTruthy();
    expect(new Date(row!.scheduled_for).getTime()).toBeGreaterThan(Date.now());
    // Aún no se muestra como pendiente porque su hora pospuesta no llegó.
    expect(pendingWebDeliveries(u.id).some((d) => d.reminder_id === r.id)).toBe(false);
  });

  it('pospone (snooze) y descarta recordatorios', () => {
    const u = makeUser('snz');
    const r = createReminder(u.id, {
      title: 'Snz',
      remind_at: new Date(Date.now() - 60000).toISOString(),
      channels: ['web'],
    });
    const snoozed = snoozeReminder(u.id, r.id, 30);
    expect(snoozed.status).toBe('snoozed');
    expect(new Date(snoozed.snoozed_until!).getTime()).toBeGreaterThan(Date.now());

    const dismissed = dismissReminder(u.id, r.id);
    expect(dismissed.status).toBe('dismissed');
  });

  it('marca la entrega de correo como omitida si SMTP no está configurado', async () => {
    const u = makeUser('mail');
    delete process.env.SMTP_URL;
    createReminder(u.id, {
      title: 'Correo',
      remind_at: new Date(Date.now() - 60000).toISOString(),
      channels: ['email'],
    });
    const res = await processDueReminders();
    expect(res.emailsAttempted).toBe(1);
    expect(res.emailsSent).toBe(0);

    const row = one<{ status: string; last_error: string | null }>(
      "SELECT status, last_error FROM notification_deliveries WHERE user_id = ? AND channel = 'email'",
      [u.id],
    );
    expect(row?.status).toBe('skipped');
    expect(row?.last_error).toMatch(/SMTP/);
  });
});
