'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet, apiSend, errorMessage } from '@/lib/client/api';
import { Button, Card, EmptyState, ErrorNote, Field, Input, PageHeader, Select, Textarea } from '@/lib/ui';
import { formatDate } from '@/lib/client/format';
import type { Project } from '@/lib/types/client';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', category: 'personal', status: 'active', goal: '', due_date: '' });

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      const res = await apiGet<Project[]>('/api/projects');
      setProjects(res);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createProject() {
    try {
      await apiSend('/api/projects', 'POST', {
        name: form.name,
        description: form.description || undefined,
        category: form.category,
        status: form.status,
        goal: form.goal || undefined,
        due_date: form.due_date || undefined,
      });
      setShowForm(false);
      setForm({ name: '', description: '', category: 'personal', status: 'active', goal: '', due_date: '' });
      await load();
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  if (loading) return <Card><p className="text-sm text-slate-500">Cargando proyectos...</p></Card>;
  if (err) return <ErrorNote message={err} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Proyectos"
        subtitle="Organiza tareas, hitos, notas y documentos"
        actions={<Button onClick={() => setShowForm(v => !v)} variant="primary" size="sm">{showForm ? 'Cancelar' : 'Nuevo proyecto'}</Button>}
      />

      {showForm && (
        <Card className="mb-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nombre" className="md:col-span-2"><Input value={form.name} onChange={v => setForm({ ...form, name: v })} /></Field>
            <Field label="Descripción" className="md:col-span-2"><Textarea value={form.description} onChange={v => setForm({ ...form, description: v })} rows={3} /></Field>
            <Field label="Categoría">
              <Select value={form.category} onChange={v => setForm({ ...form, category: v })}>
                <option value="personal">Personal</option>
                <option value="universidad">Universidad</option>
                <option value="trabajo">Trabajo</option>
                <option value="negocio">Negocio</option>
                <option value="salud">Salud</option>
                <option value="otro">Otro</option>
              </Select>
            </Field>
            <Field label="Estado">
              <Select value={form.status} onChange={v => setForm({ ...form, status: v })}>
                <option value="active">Activo</option>
                <option value="planning">Planificación</option>
                <option value="paused">Pausado</option>
                <option value="done">Completado</option>
                <option value="archived">Archivado</option>
              </Select>
            </Field>
            <Field label="Meta"><Input value={form.goal} onChange={v => setForm({ ...form, goal: v })} /></Field>
            <Field label="Fecha límite"><Input value={form.due_date} onChange={v => setForm({ ...form, due_date: v })} placeholder="YYYY-MM-DD" /></Field>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" size="sm" onClick={createProject} disabled={!form.name.trim()}>Crear proyecto</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </Card>
      )}

      <Card>
        {projects.length ? (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {projects.map(p => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <Link href={`/dashboard/projects/${p.id}`} className="text-sm font-medium hover:underline">{p.name}</Link>
                  <p className="text-xs text-slate-500">
                    {p.category} · {p.status} · {p.open_tasks ?? 0} abiertas · {p.progress}% · Vence: {formatDate(p.due_date)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Sin proyectos" description="Crea tu primer proyecto." />
        )}
      </Card>
    </div>
  );
}