'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { apiGet, apiSend, errorMessage } from '@/lib/client/api';
import { Button, Card, EmptyState, ErrorNote, Field, Input, PageHeader, Select, Textarea } from '@/lib/ui';
import type { Note } from '@/lib/types/client';

const NOTE_CATEGORIES = ['general', 'idea', 'meeting', 'decision', 'draft', 'learning', 'reference'] as const;

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: 'general' });

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      const res = await apiGet<Note[]>('/api/notes');
      setNotes(res);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createNote() {
    try {
      await apiSend('/api/notes', 'POST', {
        title: form.title,
        content: form.content || '',
        category: form.category,
      });
      setShowForm(false);
      setForm({ title: '', content: '', category: 'general' });
      await load();
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  if (loading) return <Card><p className="text-sm text-slate-500">Cargando notas...</p></Card>;
  if (err) return <ErrorNote message={err} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Notas"
        subtitle="Notas rápidas, decisiones y referencias"
        actions={<Button onClick={() => setShowForm(v => !v)} variant="primary" size="sm">{showForm ? 'Cancelar' : 'Nueva nota'}</Button>}
      />

      {showForm && (
        <Card className="mb-4">
          <div className="grid gap-3">
            <Field label="Título"><Input value={form.title} onChange={v => setForm({ ...form, title: v })} /></Field>
            <Field label="Categoría">
              <Select value={form.category} onChange={v => setForm({ ...form, category: v })}>
                {NOTE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Contenido"><Textarea value={form.content} onChange={v => setForm({ ...form, content: v })} rows={5} /></Field>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" size="sm" onClick={createNote} disabled={!form.title.trim()}>Guardar nota</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
          </div>
        </Card>
      )}

      <Card>
        {notes.length ? (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {notes.map(n => (
              <li key={n.id} className="py-2">
                <p className="text-sm font-medium">{n.title}</p>
                <p className="mt-1 text-xs text-slate-500">{n.category} · {new Date(n.updated_at).toLocaleString('es-MX')}</p>
                {n.content && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{n.content}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Sin notas" description="Crea tu primera nota." />
        )}
      </Card>
    </div>
  );
}