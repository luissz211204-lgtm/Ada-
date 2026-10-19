'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { apiGet, apiSend, errorMessage } from '@/lib/client/api';
import { Button, Card, EmptyState, ErrorNote, Field, Input, PageHeader, Select, Textarea } from '@/lib/ui';
import { formatInstant } from '@/lib/client/format';
import type { Reminder, Delivery } from '@/lib/types/client';

type Data = {
  reminders: Reminder[];
  deliveries: { deliveries: Delivery[] };
};

export default function RemindersPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', message: '', remind_at: '', priority: '2', lead_minutes: '0' });

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      const [reminders, deliveries] = await Promise.all([
        apiGet<Reminder[]>('/api/reminders'),
        apiGet<{ deliveries: Delivery[] }>('/api/reminders/deliveries?all=1'),
      ]);
      setData({ reminders, deliveries });
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createReminder() {
    try {
      await apiSend('/api/reminders', 'POST', {
        title: form.title,
        message: form.message || undefined,
        remind_at: form.remind_at,
        priority: Number(form.priority),
        lead_minutes: Number(form.lead_minutes) || 0,
      });
      setShowForm(false);
      setForm({ title: '', message: '', remind_at: '', priority: '2', lead_minutes: '0' });
      await load();
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  async function ack(id: string) {
    try {
      await apiSend('/api/reminders/deliveries', 'POST', { deliveryId: id });
      await load();
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  if (loading) return <Card><p className="text-sm text-slate-500">Cargando recordatorios...</p></Card>;
  if (err) return <ErrorNote message={err} onRetry={load} />;
  if (!data) return null;

  return (
    <div>
      <PageHeader
        title="Recordatorios"
        subtitle="Evaluados en servidor (worker/cron)"
        actions={<Button onClick={() => setShowForm(v => !v)} variant="primary" size="sm">{showForm ? 'Cancelar' : 'Nuevo recordatorio'}</Button>}
      />

      {showForm && (
        <Card className="mb-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Título" className="md:col-span-2"><Input value={form.title} onChange={v => setForm({ ...form, title: v })} /></Field>
            <Field label="Mensaje" className="md:col-span-2"><Textarea value={form.message} onChange={v => setForm({ ...form, message: v })} rows={3} /></Field>
            <Field label="Recordar en (ISO UTC, ej. 2025-12-31T10:00:00Z)"><Input value={form.remind_at} onChange={v => setForm({ ...form, remind_at: v })} /></Field>
            <Field label="Prioridad">
              <Select value={form.priority} onChange={v => setForm({ ...form, priority: v })}>
                <option value="4">Baja</option>
                <option value="3">Media</option>
                <option value="2">Alta</option>
                <option value="1">Crítica</option>
              </Select>
            </Field>
            <Field label="Antelación (min)"><Input value={form.lead_minutes} onChange={v => setForm({ ...form, lead_minutes: v })} type="number" /></Field>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" size="sm" onClick={createReminder} disabled={!form.title.trim() || !form.remind_at.trim()}>Crear recordatorio</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-medium">Programados</h2>
          {data.reminders.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.reminders.map(r => (
                <li key={r.id} className="py-1.5 text-sm">
                  <p className="font-medium">{r.title}</p>
                  <p className="text-xs text-slate-500">{r.status} · {formatInstant(r.remind_at)}</p>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="Sin recordatorios" description="Programa tu primer recordatorio." />}
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-medium">Entregas web (historial)</h2>
          {data.deliveries.deliveries.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.deliveries.deliveries.map(d => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-1.5 text-sm">
                  <div>
                    <p className="font-medium">{d.title}</p>
                    <p className="text-xs text-slate-500">{d.status} · {formatInstant(d.scheduled_for)}</p>
                  </div>
                  {d.status === 'pending' && <Button size="sm" variant="secondary" onClick={() => ack(d.id)}>Marcar leído</Button>}
                </li>
              ))}
            </ul>
          ) : <EmptyState title="Sin entregas" description="Las entregas aparecerán cuando venza un recordatorio." />}
        </Card>
      </div>
    </div>
  );
}