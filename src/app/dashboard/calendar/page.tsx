'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { apiGet, apiSend, errorMessage } from '@/lib/client/api';
import { Button, Card, EmptyState, ErrorNote, Field, Input, PageHeader, Textarea } from '@/lib/ui';
import { formatInstant, todayIso } from '@/lib/client/format';
import type { CalendarEvent } from '@/lib/types/client';

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', date: todayIso(), time: '', description: '', location: '' });

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      const res = await apiGet<CalendarEvent[]>('/api/calendar');
      setEvents(res);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createEvent() {
    try {
      await apiSend('/api/calendar', 'POST', {
        title: form.title,
        date: form.date,
        time: form.time || undefined,
        description: form.description || undefined,
        location: form.location || undefined,
      });
      setShowForm(false);
      setForm({ title: '', date: todayIso(), time: '', description: '', location: '' });
      await load();
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  if (loading) return <Card><p className="text-sm text-slate-500">Cargando calendario...</p></Card>;
  if (err) return <ErrorNote message={err} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Calendario"
        subtitle="Eventos con husos horarios"
        actions={<Button onClick={() => setShowForm(v => !v)} variant="primary" size="sm">{showForm ? 'Cancelar' : 'Nuevo evento'}</Button>}
      />

      {showForm && (
        <Card className="mb-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Título" className="md:col-span-2"><Input value={form.title} onChange={v => setForm({ ...form, title: v })} /></Field>
            <Field label="Fecha (YYYY-MM-DD)"><Input value={form.date} onChange={v => setForm({ ...form, date: v })} /></Field>
            <Field label="Hora (HH:MM)"><Input value={form.time} onChange={v => setForm({ ...form, time: v })} placeholder="opcional" /></Field>
            <Field label="Ubicación"><Input value={form.location} onChange={v => setForm({ ...form, location: v })} /></Field>
            <Field label="Descripción" className="md:col-span-2"><Textarea value={form.description} onChange={v => setForm({ ...form, description: v })} rows={3} /></Field>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" size="sm" onClick={createEvent} disabled={!form.title.trim() || !form.date.trim()}>Crear evento</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </Card>
      )}

      <Card>
        {events.length ? (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {events.map(e => (
              <li key={e.id} className="py-2">
                <p className="text-sm font-medium">{e.title}</p>
                <p className="text-xs text-slate-500">
                  {formatInstant(e.starts_at)} — {formatInstant(e.ends_at)}
                  {e.location ? ` · ${e.location}` : ''}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Sin eventos" description="Agrega tu primer evento al calendario." />
        )}
      </Card>
    </div>
  );
}