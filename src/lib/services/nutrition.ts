import { all, one, newId, parseJson } from '@/lib/db';
import { badRequest } from '@/lib/api/errors';
import { getOwned, updateOwned, deleteOwned } from './crud';
import { audit } from './audit';
import { todayInTz } from '@/lib/time';

/** Alimentación: recetas, comidas, listas de compras y preparación anticipada. */

export interface RecipeRow {
  id: string;
  user_id: string;
  name: string;
  ingredients: string;
  instructions: string;
  prep_minutes: number | null;
  servings: number | null;
  tags: string | null;
  created_at: string;
  updated_at: string;
}

export function listRecipes(userId: string, q?: string) {
  const rows = q
    ? all<RecipeRow>(
        'SELECT * FROM recipes WHERE user_id = ? AND (name LIKE ? OR ingredients LIKE ?) ORDER BY updated_at DESC',
        [userId, `%${q}%`, `%${q}%`],
      )
    : all<RecipeRow>('SELECT * FROM recipes WHERE user_id = ? ORDER BY updated_at DESC', [userId]);
  return rows.map((r) => ({ ...r, ingredients: parseJson<string[]>(r.ingredients, []) }));
}

export function createRecipe(
  userId: string,
  input: { name: string; ingredients?: string[]; instructions?: string; prep_minutes?: number; servings?: number; tags?: string[] },
) {
  if (!input.name?.trim()) throw badRequest('La receta necesita un nombre.');
  const row = one<RecipeRow>(
    `INSERT INTO recipes (id, user_id, name, ingredients, instructions, prep_minutes, servings, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [
      newId(),
      userId,
      input.name.trim(),
      JSON.stringify(input.ingredients ?? []),
      input.instructions || '',
      input.prep_minutes ?? null,
      input.servings ?? null,
      input.tags ? JSON.stringify(input.tags) : null,
    ],
  );
  audit({ userId, action: 'data.create', entity: 'recipe', entityId: row!.id });
  return { ...row, ingredients: parseJson<string[]>(row!.ingredients, []) };
}

export function deleteRecipe(userId: string, id: string): void {
  deleteOwned('recipes', id, userId);
}

// ---------------- Comidas ----------------

export function listMeals(userId: string, opts: { from?: string; to?: string; date?: string } = {}) {
  const clauses = ['user_id = ?'];
  const params: string[] = [userId];
  if (opts.date) {
    clauses.push('meal_date = ?');
    params.push(opts.date);
  } else {
    if (opts.from) {
      clauses.push('meal_date >= ?');
      params.push(opts.from);
    }
    if (opts.to) {
      clauses.push('meal_date <= ?');
      params.push(opts.to);
    }
  }
  return all(
    `SELECT * FROM meals WHERE ${clauses.join(' AND ')} ORDER BY meal_date DESC,
       CASE meal_type WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 WHEN 'dinner' THEN 3 ELSE 4 END`,
    params,
  );
}

export function logMeal(
  userId: string,
  input: {
    meal_date?: string;
    meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    name: string;
    notes?: string;
    recipe_id?: string | null;
    quantity?: string;
    calories_estimate?: number | null;
  },
  tz: string,
) {
  if (!input.name?.trim()) throw badRequest('La comida necesita un nombre.');
  if (input.recipe_id) getOwned('recipes', input.recipe_id, userId);
  const row = one(
    `INSERT INTO meals (id, user_id, meal_date, meal_type, name, notes, recipe_id, quantity, calories_estimate, calories_is_estimate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1) RETURNING *`,
    [
      newId(),
      userId,
      input.meal_date || todayInTz(tz),
      input.meal_type,
      input.name.trim(),
      input.notes || '',
      input.recipe_id ?? null,
      input.quantity ?? null,
      input.calories_estimate ?? null,
    ],
  );
  audit({ userId, action: 'data.create', entity: 'meal' });
  return row;
}

export function deleteMeal(userId: string, id: string): void {
  deleteOwned('meals', id, userId);
}

// ---------------- Compras ----------------

export function listShoppingLists(userId: string, includeDone = false) {
  const lists = includeDone
    ? all<{ id: string; name: string; status: string; updated_at: string }>(
        'SELECT id, name, status, updated_at FROM shopping_lists WHERE user_id = ? ORDER BY status, updated_at DESC',
        [userId],
      )
    : all<{ id: string; name: string; status: string; updated_at: string }>(
        `SELECT id, name, status, updated_at FROM shopping_lists WHERE user_id = ? AND status = 'open' ORDER BY updated_at DESC`,
        [userId],
      );
  return lists.map((l) => ({
    ...l,
    items: all(
      'SELECT id, name, quantity, checked, position FROM shopping_items WHERE list_id = ? AND user_id = ? ORDER BY position, created_at',
      [l.id, userId],
    ),
  }));
}

export function createShoppingList(userId: string, input: { name: string; items?: { name: string; quantity?: string }[] }) {
  if (!input.name?.trim()) throw badRequest('La lista necesita un nombre.');
  const list = one<{ id: string }>(
    'INSERT INTO shopping_lists (id, user_id, name) VALUES (?, ?, ?) RETURNING id',
    [newId(), userId, input.name.trim()],
  );
  if (!list) throw new Error('No se pudo crear la lista.');
  let position = 0;
  for (const item of input.items ?? []) {
    if (!item.name?.trim()) continue;
    one(
      'INSERT INTO shopping_items (id, list_id, user_id, name, quantity, position) VALUES (?, ?, ?, ?, ?, ?) RETURNING id',
      [newId(), list.id, userId, item.name.trim(), item.quantity || '', position++],
    );
  }
  audit({ userId, action: 'data.create', entity: 'shopping_list', entityId: list.id });
  return { id: list.id };
}

export function addShoppingItem(userId: string, listId: string, input: { name: string; quantity?: string }) {
  getOwned('shopping_lists', listId, userId);
  if (!input.name?.trim()) throw badRequest('El artículo necesita un nombre.');
  return one(
    'INSERT INTO shopping_items (id, list_id, user_id, name, quantity, position) VALUES (?, ?, ?, ?, ?, 999) RETURNING *',
    [newId(), listId, userId, input.name.trim(), input.quantity || ''],
  );
}

export function toggleShoppingItem(userId: string, itemId: string, checked: boolean) {
  const item = getOwned<{ id: string; list_id: string }>('shopping_items', itemId, userId);
  updateOwned('shopping_items', itemId, userId, { checked: checked ? 1 : 0 });
  updateOwned('shopping_lists', item.list_id, userId, {});
  return { ok: true };
}

export function deleteShoppingItem(userId: string, itemId: string): void {
  deleteOwned('shopping_items', itemId, userId);
}

/** Genera una lista de compras a partir de las recetas del menú semanal. */
export function shoppingListFromRecipes(userId: string, recipeIds: string[], name = 'Compra del menú') {
  const ingredients: { name: string; quantity?: string }[] = [];
  for (const id of recipeIds) {
    const recipe = getOwned<RecipeRow>('recipes', id, userId);
    for (const ing of parseJson<string[]>(recipe.ingredients, [])) {
      const parsed = typeof ing === 'string' ? ing : String(ing);
      const [itemName, ...rest] = parsed.split(' ');
      ingredients.push({ name: parsed, quantity: rest.join(' ') });
    }
  }
  return createShoppingList(userId, { name, items: ingredients });
}

export function nutritionSummary(userId: string, tz: string, date?: string) {
  const day = date || todayInTz(tz);
  const meals = listMeals(userId, { date: day });
  const calories = meals.reduce((acc, m) => acc + Number((m as { calories_estimate: number | null }).calories_estimate || 0), 0);
  return {
    date: day,
    meals: meals.length,
    byType: {
      breakfast: meals.filter((m) => (m as { meal_type: string }).meal_type === 'breakfast').length,
      lunch: meals.filter((m) => (m as { meal_type: string }).meal_type === 'lunch').length,
      dinner: meals.filter((m) => (m as { meal_type: string }).meal_type === 'dinner').length,
      snack: meals.filter((m) => (m as { meal_type: string }).meal_type === 'snack').length,
    },
    caloriesEstimate: calories || null,
    caloriesIsEstimate: true,
    note: calories ? 'Estimación a partir de los valores introducidos por el usuario; no es una medición.' : 'Sin datos suficientes para estimar calorías.',
  };
}
