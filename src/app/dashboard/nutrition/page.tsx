'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { apiGet, apiSend, errorMessage } from '@/lib/client/api';
import { Button, Card, EmptyState, ErrorNote, Field, Input, PageHeader, Select, Textarea } from '@/lib/ui';
import type { Recipe, Meal, ShoppingList, NutritionSummary } from '@/lib/types/client';

type NutritionData = {
  recipes: Recipe[];
  meals: Meal[];
  lists: ShoppingList[];
  summary: NutritionSummary;
};

export default function NutritionPage() {
  const [data, setData] = useState<NutritionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showRecipe, setShowRecipe] = useState(false);
  const [showMeal, setShowMeal] = useState(false);
  const [showList, setShowList] = useState(false);
  const [recipe, setRecipe] = useState({ name: '', ingredients: '', instructions: '', prep_minutes: '', servings: '', tags: '' });
  const [meal, setMeal] = useState({ meal_type: 'breakfast', name: '', meal_date: '', notes: '', calories_estimate: '' });
  const [list, setList] = useState({ name: '', items: '' });

  async function load() {
    try {
      setLoading(true);
      setErr(null);
      const res = await apiGet<NutritionData>('/api/nutrition');
      setData(res);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createRecipe() {
    try {
      const ingredients = recipe.ingredients.split('\n').map(s => s.trim()).filter(Boolean);
      const tags = recipe.tags.split(',').map(s => s.trim()).filter(Boolean);
      await apiSend('/api/nutrition', 'POST', {
        action: 'addRecipe',
        name: recipe.name,
        ingredients,
        instructions: recipe.instructions,
        prep_minutes: recipe.prep_minutes ? Number(recipe.prep_minutes) : undefined,
        servings: recipe.servings ? Number(recipe.servings) : undefined,
        tags: tags.length ? tags : undefined,
      });
      setShowRecipe(false);
      setRecipe({ name: '', ingredients: '', instructions: '', prep_minutes: '', servings: '', tags: '' });
      await load();
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  async function logMeal() {
    try {
      await apiSend('/api/nutrition', 'POST', {
        action: 'logMeal',
        meal_type: meal.meal_type,
        name: meal.name,
        meal_date: meal.meal_date || undefined,
        notes: meal.notes || undefined,
        calories_estimate: meal.calories_estimate ? Number(meal.calories_estimate) : undefined,
      });
      setShowMeal(false);
      setMeal({ meal_type: 'breakfast', name: '', meal_date: '', notes: '', calories_estimate: '' });
      await load();
    } catch (e) {
      alert(errorMessage(e));
    }
  }

  async function createList() {
    try {
      const items = list.items.split('\n').map(s => s.trim()).filter(Boolean).map(s => ({ name: s }));
      await apiSend('/api/nutrition', 'POST', {
        action: 'addList',
        name: list.name,
        items: items.length ? items : undefined,
      });
      setShowList(false);
      setList({ name: '', items: '' });
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
        title="Nutrición"
        subtitle="Recetas, comidas y lista de compras"
        actions={
          <div className="flex gap-2">
            <Button onClick={() => setShowRecipe(v => !v)} variant="secondary" size="sm">Nueva receta</Button>
            <Button onClick={() => setShowMeal(v => !v)} variant="secondary" size="sm">Registrar comida</Button>
            <Button onClick={() => setShowList(v => !v)} variant="secondary" size="sm">Nueva lista</Button>
          </div>
        }
      />

      {showRecipe && (
        <Card className="mb-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nombre"><Input value={recipe.name} onChange={v => setRecipe({ ...recipe, name: v })} /></Field>
            <Field label="Preparación (min)"><Input value={recipe.prep_minutes} onChange={v => setRecipe({ ...recipe, prep_minutes: v })} type="number" /></Field>
            <Field label="Porciones"><Input value={recipe.servings} onChange={v => setRecipe({ ...recipe, servings: v })} type="number" /></Field>
            <Field label="Tags (separados por coma)"><Input value={recipe.tags} onChange={v => setRecipe({ ...recipe, tags: v })} /></Field>
            <Field label="Ingredientes (uno por línea)" className="md:col-span-2"><Textarea value={recipe.ingredients} onChange={v => setRecipe({ ...recipe, ingredients: v })} rows={4} /></Field>
            <Field label="Instrucciones" className="md:col-span-2"><Textarea value={recipe.instructions} onChange={v => setRecipe({ ...recipe, instructions: v })} rows={4} /></Field>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" size="sm" onClick={createRecipe}>Guardar receta</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowRecipe(false)}>Cancelar</Button>
          </div>
        </Card>
      )}

      {showMeal && (
        <Card className="mb-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Tipo">
              <Select value={meal.meal_type} onChange={v => setMeal({ ...meal, meal_type: v })}>
                <option value="breakfast">Desayuno</option>
                <option value="lunch">Comida</option>
                <option value="dinner">Cena</option>
                <option value="snack">Colación</option>
              </Select>
            </Field>
            <Field label="Nombre"><Input value={meal.name} onChange={v => setMeal({ ...meal, name: v })} /></Field>
            <Field label="Fecha (YYYY-MM-DD)"><Input value={meal.meal_date} onChange={v => setMeal({ ...meal, meal_date: v })} /></Field>
            <Field label="Calorías (estimadas)"><Input value={meal.calories_estimate} onChange={v => setMeal({ ...meal, calories_estimate: v })} type="number" /></Field>
            <Field label="Notas" className="md:col-span-2"><Textarea value={meal.notes} onChange={v => setMeal({ ...meal, notes: v })} rows={3} /></Field>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" size="sm" onClick={logMeal}>Registrar</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowMeal(false)}>Cancelar</Button>
          </div>
        </Card>
      )}

      {showList && (
        <Card className="mb-4">
          <div className="grid gap-3">
            <Field label="Nombre"><Input value={list.name} onChange={v => setList({ ...list, name: v })} /></Field>
            <Field label="Elementos (uno por línea)"><Textarea value={list.items} onChange={v => setList({ ...list, items: v })} rows={4} /></Field>
          </div>
          <div className="mt-3 flex gap-2">
            <Button variant="primary" size="sm" onClick={createList}>Crear lista</Button>
            <Button variant="ghost" size="sm" onClick={() => setShowList(false)}>Cancelar</Button>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-medium">Recetas</h2>
          {data?.recipes.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.recipes.map(r => (
                <li key={r.id} className="py-2">
                  <p className="text-sm font-medium">{r.name}</p>
                  <p className="text-xs text-slate-500">{r.prep_minutes ? `${r.prep_minutes} min` : '—'}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Sin recetas" description="Agrega tu primera receta." />
          )}
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-medium">Comidas de hoy</h2>
          {data?.meals.length ? (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.meals.map(m => (
                <li key={m.id} className="py-2">
                  <p className="text-sm font-medium">{m.name} <span className="text-xs text-slate-500">({m.meal_type})</span></p>
                  <p className="text-xs text-slate-500">{m.meal_date}{m.calories_estimate ? ` · ${m.calories_estimate} kcal` : ''}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Sin comidas registradas" description="Registra lo que consumiste hoy." />
          )}
        </Card>

        <Card className="lg:col-span-2">
          <h2 className="mb-2 text-sm font-medium">Listas de compra</h2>
          {data?.lists.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {data.lists.map(l => (
                <Card key={l.id} className="p-3">
                  <p className="text-sm font-medium">{l.name}</p>
                  <p className="text-xs text-slate-500">{l.items?.length || 0} elementos</p>
                </Card>
              ))}
            </div>
          ) : (
            <EmptyState title="Sin listas" description="Crea una lista de compras." />
          )}
        </Card>
      </div>
    </div>
  );
}