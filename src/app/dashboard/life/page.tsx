'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { apiGet, apiSend, errorMessage } from '@/lib/client/api';
import { Button, Card, EmptyState, ErrorNote, Field, Input, PageHeader, Select, Textarea } from '@/lib/ui';
import { formatDate } from '@/lib/client/format';
import type { Goal, Habit } from '@/lib/types/client';

type LifeData = {
  goals: Goal[];
  habits: Habit[];
  routines: any;
  review: any;
};

export default function LifePage() {
  const [data, setData] = useState<LifeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showGoal, setShowGoal] = useState(false);
  const [showHabit, setShowHabit] = useState(false);
  const [goal, setGoal] = useState({ title: '', motivation: '', category: 'personal', target_date: '' });
  const [habit, setHabit] = useState({ name: '', frequency: 'daily', category: 'salud' });

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      const res = await apiGet<LifeData>('/api/life');
      setData(res);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createGoal() {
    try {
      await apiSend('/api/goals', 'POST', {
        title: goal.title,
        motivation: goal.motivation || undefined,
        category: goal.category,
        target_date: goal.target_date || undefined,
      });
      setShowGoal(false);
      setGoal({ title: '', motivation: '', category: 'personal', target_date: '' });
      await load();
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  async function createHabit() {
    try {
      await apiSend('/api/habits', 'POST', {
        name: habit.name,
        frequency: habit.frequency,
        category: habit.category,
      });
      setShowHabit(false);
      setHabit({ name: '', frequency: 'daily', category: 'salud' });
      await load();
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  async function toggleHabit(id: string) {
    try {
      await apiSend(`/api/habits/${id}`, 'POST', {});
      await load();
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  if (loading) return <Card><p className="text-sm text-slate-500">Cargando...</p></Card>;
  if (err) return <ErrorNote message={err} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Vida"
        subtitle="Objetivos, hábitos y revisión personal"
        actions={
          <div className="flex gap-2">
            <Button onClick={() => setShowGoal(v => !v)} variant="secondary" size="sm">Nuevo objetivo</Button>
            <Button onClick={() => setShowHabit(v => !v)} variant="secondary" size="sm">Nuevo hábito</Button>
          </div>
        }
      />

      {showGoal && (
        <Card className="mb-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Título" className="md:col-span-2"><Input value={goal.title} onChange={v => setGoal({ ...goal, title: v })} /></Field>
            <Field label="Motivación" className="md:col-span-2"><Textarea value={goal.motivation} onChange={v => setGoal({ ...goal, motivation: v })} rows={2} /></Field>
            <Field label="Categoría">
              <Select value={goal.category} onChange={v => setGoal({ ...goal, category: v })}>
                <option value="personal">Personal</option>
                <option value="salud">Salud</option>
                <option value="finanzas">Finanzas</option>
                <option value="desarrollo">Desarrollo</option>
                <option value="familia">Familia</option>
              </Select>
            </Field>
            <Field label="Fecha objetivo"><Input value={goal.target_date} onChange={v => setGoal({ ...goal, target_date: v })} placeholder="YYYY-MM-DD" /></Field>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" size="sm" onClick={createGoal} disabled={!goal.title.trim()}>Crear objetivo</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowGoal(false)}>Cancelar</Button>
          </div>
        </Card>
      )}

      {showHabit && (
        <Card className="mb-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nombre"><Input value={habit.name} onChange={v => setHabit({ ...habit, name: v })} /></Field>
            <Field label="Frecuencia">
              <Select value={habit.frequency} onChange={v => setHabit({ ...habit, frequency: v })}>
                <option value="daily">Diaria</option>
                <option value="weekly">Semanal</option>
              </Select>
            </Field>
            <Field label="Categoría">
              <Select value={habit.category} onChange={v => setHabit({ ...habit, category: v })}>
                <option value="salud">Salud</option>
                <option value="productividad">Productividad</option>
                <option value="bienestar">Bienestar</option>
                <option value="desarrollo">Desarrollo</option>
              </Select>
            </Field>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" size="sm" onClick={createHabit} disabled={!habit.name.trim()}>Crear hábito</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowHabit(false)}>Cancelar</Button>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-medium">Objetivos</h2>
          {data?.goals.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.goals.map(g => (
                <li key={g.id} className="py-2 text-sm">
                  <p className="font-medium">{g.title}</p>
                  <p className="text-xs text-slate-500">{g.category} · {g.progress}% · Meta: {formatDate(g.target_date)}</p>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="Sin objetivos" description="Define tu primer objetivo." />}
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-medium">Hábitos</h2>
          {data?.habits.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.habits.map(h => (
                <li key={h.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <p className="font-medium">{h.name}</p>
                    <p className="text-xs text-slate-500">{h.frequency} · Racha: {h.streak_days} días</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => toggleHabit(h.id)}>{h.last_log_at ? 'Desmarcar' : 'Marcar hoy'}</Button>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="Sin hábitos" description="Crea un hábito para ganar constancia." />}
        </Card>
      </div>
    </div>
  );
}