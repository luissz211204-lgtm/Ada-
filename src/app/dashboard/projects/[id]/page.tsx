'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiGet, apiSend, errorMessage } from '@/lib/client/api';
import { Button, Card, ErrorNote, Field, Input, PageHeader, Textarea } from '@/lib/ui';
import { formatDate } from '@/lib/client/format';
import type { Project } from '@/lib/types/client';

export default function ProjectDetailPage() {
  const params = useParams();
  const id = String(params?.id);
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [milestone, setMilestone] = useState({ title: '', due_date: '' });
  const [decision, setDecision] = useState({ title: '', content: '' });

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      const res = await apiGet<Project>(`/api/projects/${id}`);
      setProject(res);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]);

  async function addMilestone() {
    try {
      await apiSend(`/api/projects/${id}`, 'POST', { action: 'addMilestone', title: milestone.title, due_date: milestone.due_date || null });
      setMilestone({ title: '', due_date: '' });
      await load();
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  async function addDecision() {
    try {
      await apiSend(`/api/projects/${id}`, 'POST', { action: 'addDecision', title: decision.title, content: decision.content });
      setDecision({ title: '', content: '' });
      await load();
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  if (loading) return <Card><p className="text-sm text-slate-500">Cargando proyecto...</p></Card>;
  if (err) return <ErrorNote message={err} onRetry={load} />;
  if (!project) return null;

  return (
    <div>
      <PageHeader title={project.name} subtitle={`${project.category} · ${project.status} · ${project.progress}% completado`} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-medium">Detalles</h2>
          <dl className="grid gap-2 text-sm">
            <div><dt className="text-slate-500">Meta</dt><dd>{project.goal || '—'}</dd></div>
            <div><dt className="text-slate-500">Descripción</dt><dd>{project.description || '—'}</dd></div>
            <div><dt className="text-slate-500">Vence</dt><dd>{formatDate(project.due_date)}</dd></div>
          </dl>
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-medium">Hitos</h2>
          <div className="mb-3 grid gap-2 md:grid-cols-2">
            <Field label="Título"><Input value={milestone.title} onChange={v => setMilestone({ ...milestone, title: v })} /></Field>
            <Field label="Fecha"><Input value={milestone.due_date} onChange={v => setMilestone({ ...milestone, due_date: v })} placeholder="YYYY-MM-DD" /></Field>
          </div>
          <Button size="sm" variant="secondary" onClick={addMilestone} disabled={!milestone.title.trim()}>Agregar hito</Button>
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {(project.milestones || []).map((m: any) => (
              <li key={m.id} className="py-1.5 text-sm">
                <p>{m.title}</p>
                <p className="text-xs text-slate-500">{m.status} · {formatDate(m.due_date)}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-medium">Decisiones</h2>
          <div className="grid gap-2">
            <Field label="Título"><Input value={decision.title} onChange={v => setDecision({ ...decision, title: v })} /></Field>
            <Field label="Contenido"><Textarea value={decision.content} onChange={v => setDecision({ ...decision, content: v })} rows={3} /></Field>
          </div>
          <Button size="sm" variant="secondary" onClick={addDecision} disabled={!decision.title.trim()} className="mt-2">Guardar decisión</Button>
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
            {(project.decisions || []).map((d: any) => (
              <li key={d.id} className="py-1.5 text-sm">
                <p className="font-medium">{d.title}</p>
                <p className="text-xs text-slate-500">{d.content}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-medium">Tareas</h2>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {(project.tasks || []).map((t: any) => (
              <li key={t.id} className="py-1.5 text-sm">
                <p>{t.title}</p>
                <p className="text-xs text-slate-500">{t.status} · {t.priority}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}