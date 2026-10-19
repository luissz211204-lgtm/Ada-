import { one } from '@/lib/db';
import { taskSummary } from './tasks';
import { pendingWebDeliveries } from './notifications';
import { pendingApprovalsCount } from './approvals';
import { projectsOverview } from './projects';
import { listGoals, routinesSummary } from './life';
import { agenda, countUpcomingEvents } from './calendar';
import { financeSummary } from './finance';
import { todayInTz, timeInTz, weekdayName } from '@/lib/time';
import { listReminders } from './notifications';
import { documentsOverview } from './documents';

/** Resumen del dashboard: todo calculado sobre datos reales del usuario. */
export function dashboardSummary(userId: string, tz: string) {
  const today = todayInTz(tz);
  const tasks = taskSummary(userId, tz);
  const upcomingEvents = agenda(userId, tz, 7);
  const todayEvents = upcomingEvents[0]?.events ?? [];
  const nextReminders = listReminders(userId, { status: ['scheduled', 'snoozed'] }).slice(0, 5);
  const approvals = pendingApprovalsCount(userId);
  const inbox = one<{ c: number }>(
    `SELECT COUNT(*) AS c FROM inbox_items WHERE user_id = ? AND status = 'pending'`,
    [userId],
  );
  const documents = documentsOverview(userId);
  const projects = projectsOverview(userId);
  const goals = listGoals(userId, 'active').slice(0, 5);
  const routines = routinesSummary(userId, tz);
  const finance = financeSummary(userId, today.slice(0, 7), tz);
  const aiConfigured = Boolean(process.env.AI_API_KEY);

  return {
    today,
    weekday: weekdayName(today, tz),
    localTime: timeInTz(tz),
    timezone: tz,
    tasks: {
      overdue: tasks.overdue.map(toTaskDto),
      dueToday: tasks.dueToday.map(toTaskDto),
      priority: tasks.highPriorityWithoutDate.map(toTaskDto),
      totals: tasks.totals,
    },
    events: {
      today: todayEvents,
      upcoming: upcomingEvents.slice(1, 4).flatMap((d) => d.events.map((e) => ({ ...e, date: d.date }))),
      totalNextWeek: countUpcomingEvents(userId, tz),
    },
    reminders: nextReminders.map((r) => ({
      id: r.id,
      title: r.title,
      remind_at: r.remind_at,
      status: r.status,
      priority: r.priority,
    })),
    pendingDeliveries: pendingWebDeliveries(userId, 5),
    approvalsPending: approvals,
    inboxPending: Number(inbox?.c ?? 0),
    documents: documents,
    projects: projects.byStatus,
    activeProjects: projects.active.map((p) => ({
      id: p.id,
      name: p.name,
      progress: p.progress,
      due_date: p.due_date,
      open_tasks: p.open_tasks,
    })),
    goals: goals.map((g) => ({ id: g.id, title: g.title, progress: g.progress, target_date: g.target_date })),
    routines,
    finance,
    aiConfigured,
  };
}

function toTaskDto(t: {
  id: string;
  title: string;
  priority: number;
  due_date: string | null;
  due_time: string | null;
  status: string;
  project_id: string | null;
}) {
  return {
    id: t.id,
    title: t.title,
    priority: t.priority,
    due_date: t.due_date,
    due_time: t.due_time,
    status: t.status,
    project_id: t.project_id,
  };
}
