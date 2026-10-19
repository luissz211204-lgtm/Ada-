import { all, one } from '@/lib/db';
import { taskSummary, listTasks } from '@/lib/services/tasks';
import { todayInTz, addDays, formatInstant } from '@/lib/time';

/**
 * Construye el contexto de vida real del usuario DESDE la base de datos.
 * Nunca inventa: todo proviene de consultas filtradas por usuario.
 * El contexto se limita en tamaño para no saturar el prompt.
 */
export function buildLifeContext(userId: string, tz: string): string {
  const today = todayInTz(tz);
  const week = addDays(today, 7);
  const lines: string[] = [];

  try {
    const summary = taskSummary(userId, tz);
    lines.push(`## Tareas`);
    lines.push(
      `- Totales abiertas: ${summary.totals.open} | vencidas: ${summary.totals.overdue} | para hoy: ${summary.totals.dueToday} | completadas hoy: ${summary.totals.doneToday}`,
    );
    for (const t of summary.overdue.slice(0, 5)) {
      lines.push(`- [VENCIDA] ${t.title} (prioridad ${t.priority}, venció ${t.due_date})`);
    }
    for (const t of summary.dueToday.slice(0, 8)) {
      lines.push(`- [HOY] ${t.title}${t.due_time ? ` ${t.due_time}` : ''} (prioridad ${t.priority})`);
    }
    for (const t of summary.highPriorityWithoutDate.slice(0, 5)) {
      lines.push(`- [PRIORITARIA sin fecha] ${t.title} (prioridad ${t.priority})`);
    }
  } catch {
    lines.push('## Tareas\n- (no disponible)');
  }

  try {
    const events = all<{ title: string; starts_at: string; ends_at: string; location: string }>(
      `SELECT title, starts_at, ends_at, location FROM calendar_events
       WHERE user_id = ? AND starts_at >= ? AND starts_at < ? ORDER BY starts_at ASC LIMIT 15`,
      [userId, new Date(`${today}T00:00:00Z`).toISOString(), new Date(`${week}T00:00:00Z`).toISOString()],
    );
    lines.push('## Calendario (próximos 7 días)');
    if (events.length === 0) lines.push('- Sin eventos en los próximos 7 días.');
    for (const e of events) {
      lines.push(`- ${formatInstant(e.starts_at, tz, { dateStyle: 'short', timeStyle: 'short' })} · ${e.title}${e.location ? ` (${e.location})` : ''}`);
    }
  } catch {
    lines.push('## Calendario\n- (no disponible)');
  }

  try {
    const reminders = all<{ title: string; remind_at: string }>(
      `SELECT title, remind_at FROM reminders
       WHERE user_id = ? AND status IN ('scheduled','snoozed') ORDER BY remind_at ASC LIMIT 8`,
      [userId],
    );
    lines.push('## Recordatorios programados');
    if (reminders.length === 0) lines.push('- Ninguno.');
    for (const r of reminders) {
      lines.push(`- ${formatInstant(r.remind_at, tz, { dateStyle: 'short', timeStyle: 'short' })} · ${r.title}`);
    }
  } catch {
    lines.push('## Recordatorios\n- (no disponible)');
  }

  try {
    const projects = all<{ name: string; status: string; progress: number; due_date: string | null }>(
      `SELECT name, status, progress, due_date FROM projects
       WHERE user_id = ? AND status IN ('planning','active','paused') ORDER BY due_date IS NULL, due_date ASC LIMIT 10`,
      [userId],
    );
    lines.push('## Proyectos activos');
    if (projects.length === 0) lines.push('- Ninguno.');
    for (const p of projects) {
      lines.push(`- ${p.name} [${p.status}] ${p.progress}%${p.due_date ? `, límite ${p.due_date}` : ''}`);
    }
  } catch {
    lines.push('## Proyectos\n- (no disponible)');
  }

  try {
    const goals = all<{ title: string; progress: number; target_date: string | null }>(
      `SELECT title, progress, target_date FROM goals WHERE user_id = ? AND status = 'active' LIMIT 8`,
      [userId],
    );
    lines.push('## Objetivos activos');
    if (goals.length === 0) lines.push('- Ninguno.');
    for (const g of goals) {
      lines.push(`- ${g.title} ${g.progress}%${g.target_date ? `, meta ${g.target_date}` : ''}`);
    }
  } catch {
    lines.push('## Objetivos\n- (no disponible)');
  }

  try {
    const month = today.slice(0, 7);
    const fin = one<{ income: number; expense: number }>(
      `SELECT
         COALESCE(SUM(CASE WHEN type='income' THEN amount_cents END), 0) AS income,
         COALESCE(SUM(CASE WHEN type='expense' THEN amount_cents END), 0) AS expense
       FROM transactions WHERE user_id = ? AND substr(txn_date,1,7) = ?`,
      [userId, month],
    );
    lines.push(`## Finanzas del mes (${month})`);
    lines.push(
      `- Ingresos: ${(Number(fin?.income || 0) / 100).toFixed(2)} · Gastos: ${(Number(fin?.expense || 0) / 100).toFixed(2)} (datos registrados por el usuario)`,
    );
    const debts = one<{ c: number; due: number }>(
      `SELECT COUNT(*) AS c, COALESCE(SUM(remaining_cents),0) AS due
       FROM debts WHERE user_id = ? AND status = 'active'`,
      [userId],
    );
    if (Number(debts?.c || 0) > 0) {
      lines.push(`- Deudas activas: ${debts!.c}, saldo pendiente: ${(Number(debts!.due) / 100).toFixed(2)}`);
    }
  } catch {
    lines.push('## Finanzas\n- (no disponible)');
  }

  try {
    const todayStr = today;
    const habits = all<{ name: string }>(
      `SELECT h.name FROM habits h
       WHERE h.user_id = ? AND h.active = 1
         AND NOT EXISTS (SELECT 1 FROM habit_logs l WHERE l.habit_id = h.id AND l.log_date = ? AND l.done = 1)
       LIMIT 8`,
      [userId, todayStr],
    );
    const totalHabits = one<{ c: number }>(
      'SELECT COUNT(*) AS c FROM habits WHERE user_id = ? AND active = 1',
      [userId],
    );
    lines.push('## Hábitos');
    lines.push(`- Activos: ${totalHabits?.c ?? 0}`);
    if (habits.length > 0) lines.push(`- Pendientes hoy: ${habits.map((h) => h.name).join(', ')}`);
  } catch {
    lines.push('## Hábitos\n- (no disponible)');
  }

  const inbox = one<{ c: number }>(
    `SELECT COUNT(*) AS c FROM inbox_items WHERE user_id = ? AND status = 'pending'`,
    [userId],
  );
  const approvals = one<{ c: number }>(
    `SELECT COUNT(*) AS c FROM approvals WHERE user_id = ? AND status = 'pending'`,
    [userId],
  );
  lines.push('## Bandeja y aprobaciones');
  lines.push(
    `- Ideas/pendientes sin clasificar: ${inbox?.c ?? 0} · Acciones esperando aprobación: ${approvals?.c ?? 0}`,
  );

  return lines.join('\n');
}

/** Resumen corto para el dashboard (no para prompts largos). */
export function quickContext(userId: string, tz: string) {
  const s = taskSummary(userId, tz);
  return s.totals;
}
