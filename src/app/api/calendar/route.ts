import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import {
  listEvents,
  createEvent,
  agenda,
  eventsInMonth,
  findConflicts,
} from '@/lib/services/calendar';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createBody = z.object({
  title: z.string().min(1, 'El evento necesita un título'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato YYYY-MM-DD'),
  time: z.string().optional(),
  duration_minutes: z.coerce.number().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  project_id: z.string().nullable().optional(),
  task_id: z.string().nullable().optional(),
});

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser, url }) => {
    initDatabase();
    const userId = authedUser.user.id;
    const tz = authedUser.settings.timezone || 'America/Monterrey';
    const view = url.searchParams.get('view');
    if (view === 'agenda') {
      return { data: agenda(userId, tz, Number(url.searchParams.get('days')) || 7) };
    }
    if (view === 'month') {
      const month = url.searchParams.get('month') || new Date().toISOString().slice(0, 7);
      return { data: eventsInMonth(userId, tz, month) };
    }
    if (view === 'conflicts') {
      const starts = url.searchParams.get('starts_at');
      const ends = url.searchParams.get('ends_at');
      if (!starts || !ends) return { data: [] };
      return { data: findConflicts(userId, starts, ends, url.searchParams.get('exclude') || undefined) };
    }
    return {
      data: listEvents(userId, {
        from: url.searchParams.get('from') || undefined,
        to: url.searchParams.get('to') || undefined,
        project_id: url.searchParams.get('project_id') || undefined,
      }),
    };
  },
});

export const POST = defineHandler({
  method: 'POST',
  schema: createBody,
  handler: async ({ authedUser, body, ip }) => {
    initDatabase();
    const tz = authedUser.settings.timezone || 'America/Monterrey';
    return { data: createEvent(authedUser.user.id, body, tz, { source: 'user', ip }), status: 201 };
  },
});
