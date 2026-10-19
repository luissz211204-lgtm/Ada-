'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { apiGet, apiSend, errorMessage } from '@/lib/client/api';
import { Button, Card, EmptyState, ErrorNote, Field, Input, PageHeader, Select, Textarea } from '@/lib/ui';
import { formatDate, PRIORITY_LABELS } from '@/lib/client/format';
import type { Task } from '@/lib/types/client';

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: '3', due_date: '', project_id: '' });

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      const res = await apiGet<Task[]>('/api/tasks');
      setTasks(res);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createTask() {
    try {
      await apiSend('/api/tasks', 'POST', {
        title: form.title,
        description: form.description || undefined,
        priority: Number(form.priority),
        due_date: form.due_date || undefined,
        project_id: form.project_id || undefined,
      });
      setShowForm(false);
      setForm({ title: '', description: '', priority: '3', due_date: '', project_id: '' });
      await load();
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  async function completeTask(id: string) {
    try {
      await apiSend(`/api/tasks/${id}/complete`, 'POST');
      await load();
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  if (loading) return <Card><p className="text-sm text-slate-500">Cargando tareas...</p></Card>;
  if (err) return <ErrorNote message={err} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Tareas"
        subtitle="CRUD de tareas, subtareas, dependencias y recordatorios"
        actions={<Button onClick={() => setShowForm(v => !v)} variant="primary" size="sm">{showForm ? 'Cancelar' : 'Nueva tarea'}</Button>}
      />

      {showForm && (
        <Card className="mb-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Título" className="md:col-span-2"><Input value={form.title} onChange={v => setForm({ ...form, title: v })} required /></Field>
            <Field label="Descripción" className="md:col-span-2"><Textarea value={form.description} onChange={v => setForm({ ...form, description: v })} rows={3} /></Field>
            <Field label="Prioridad">
              <Select value={form.priority} onChange={v => setForm({ ...form, priority: v })}>
                <option value="4">Baja (4)</option>
                <option value="3">Media (3)</option>
                <option value="2">Alta (2)</option>
                <option value="1">Crítica (1)</option>
              </Select>
            </Field>
            <Field label="Fecha límite (YYYY-MM-DD)"><Input value={form.due_date} onChange={v => setForm({ ...form, due_date: v })} placeholder="2025-12-31" /></Field>
            <Field label="ID de proyecto" className="md:col-span-2"><Input value={form.project_id} onChange={v => setForm({ ...form, project_id: v })} placeholder="opcional" /></Field>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" size="sm" onClick={createTask} disabled={!form.title.trim()}>Crear tarea</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </Card>
      )}

      <Card>
        {tasks.length ? (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {tasks.map(t => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-slate-500">
                    {t.status} · Prioridad {t.priority} ({PRIORITY_LABELS[t.priority]}) · Vencimiento: {formatDate(t.due_date)}
                  </p>
                </div>
                {t.status !== 'done' && <Button size="sm" variant="secondary" onClick={() => completeTask(t.id)}>Completar</Button>}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Sin tareas" description="Crea tu primera tarea para empezar." />
        )}
      </Card>
    </div>
  );
}