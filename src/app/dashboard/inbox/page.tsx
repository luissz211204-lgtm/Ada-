'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { apiGet, apiSend, errorMessage } from '@/lib/client/api';
import { Button, Card, EmptyState, ErrorNote, PageHeader } from '@/lib/ui';
import type { InboxItem } from '@/lib/types/client';

export default function InboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [input, setInput] = useState('');

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      const res = await apiGet<InboxItem[]>('/api/inbox');
      setItems(res);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function add() {
    if (!input.trim()) return;
    try {
      await apiSend('/api/inbox', 'POST', { action: 'add', content: input.trim() });
      setInput('');
      await load();
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  async function discard(id: string) {
    try {
      await apiSend('/api/inbox', 'POST', { action: 'discard', id });
      await load();
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  if (loading) return <Card><p className="text-sm text-slate-500">Cargando bandeja...</p></Card>;
  if (err) return <ErrorNote message={err} onRetry={load} />;

  return (
    <div>
      <PageHeader title="Bandeja" subtitle="Captura rápida para procesar después" />

      <Card className="mb-4">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Añade una idea, recordatorio o tarea rápida..."
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm dark:border-slate-700 dark:bg-slate-950"
          />
          <Button variant="primary" size="sm" onClick={add} disabled={!input.trim()}>Añadir</Button>
        </div>
      </Card>

      <Card>
        {items.length ? (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map(i => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm">{i.content}</p>
                  <p className="text-xs text-slate-500">{i.status} · {new Date(i.created_at).toLocaleString('es-MX')}</p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => discard(i.id)}>Descartar</Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Bandeja vacía" description="Captura ideas sin interrumpir tu flujo." />
        )}
      </Card>
    </div>
  );
}