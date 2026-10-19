import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import {
  listRecipes,
  createRecipe,
  deleteRecipe,
  listMeals,
  logMeal,
  deleteMeal,
  listShoppingLists,
  createShoppingList,
  addShoppingItem,
  toggleShoppingItem,
  deleteShoppingItem,
  shoppingListFromRecipes,
  nutritionSummary,
} from '@/lib/services/nutrition';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser, url }) => {
    initDatabase();
    const userId = authedUser.user.id;
    const tz = authedUser.settings.timezone || 'America/Monterrey';
    return {
      data: {
        recipes: listRecipes(userId, url.searchParams.get('q') || undefined),
        meals: listMeals(userId, {
          date: url.searchParams.get('date') || undefined,
          from: url.searchParams.get('from') || undefined,
          to: url.searchParams.get('to') || undefined,
        }),
        lists: listShoppingLists(userId, url.searchParams.get('all') === '1'),
        summary: nutritionSummary(userId, tz, url.searchParams.get('date') || undefined),
      },
    };
  },
});

const body = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('addRecipe'),
    name: z.string().min(1),
    ingredients: z.array(z.string()).optional(),
    instructions: z.string().optional(),
    prep_minutes: z.coerce.number().optional(),
    servings: z.coerce.number().optional(),
    tags: z.array(z.string()).optional(),
  }),
  z.object({ action: z.literal('deleteRecipe'), id: z.string().min(1) }),
  z.object({
    action: z.literal('logMeal'),
    meal_type: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
    name: z.string().min(1),
    meal_date: z.string().optional(),
    notes: z.string().optional(),
    recipe_id: z.string().nullable().optional(),
    quantity: z.string().optional(),
    calories_estimate: z.coerce.number().nullable().optional(),
  }),
  z.object({ action: z.literal('deleteMeal'), id: z.string().min(1) }),
  z.object({
    action: z.literal('addList'),
    name: z.string().min(1),
    items: z.array(z.object({ name: z.string().min(1), quantity: z.string().optional() })).optional(),
  }),
  z.object({ action: z.literal('addItem'), listId: z.string().min(1), name: z.string().min(1), quantity: z.string().optional() }),
  z.object({ action: z.literal('toggleItem'), itemId: z.string().min(1), checked: z.boolean() }),
  z.object({ action: z.literal('deleteItem'), itemId: z.string().min(1) }),
  z.object({
    action: z.literal('listFromRecipes'),
    recipeIds: z.array(z.string().min(1)).min(1),
    name: z.string().optional(),
  }),
]);

export const POST = defineHandler({
  method: 'POST',
  schema: body,
  handler: async ({ authedUser, body }) => {
    initDatabase();
    const userId = authedUser.user.id;
    const tz = authedUser.settings.timezone || 'America/Monterrey';
    switch (body.action) {
      case 'addRecipe':
        return { data: createRecipe(userId, body), status: 201 };
      case 'deleteRecipe':
        deleteRecipe(userId, body.id);
        return { data: { ok: true } };
      case 'logMeal':
        return { data: logMeal(userId, body, tz), status: 201 };
      case 'deleteMeal':
        deleteMeal(userId, body.id);
        return { data: { ok: true } };
      case 'addList':
        return { data: createShoppingList(userId, body), status: 201 };
      case 'addItem':
        return { data: addShoppingItem(userId, body.listId, body), status: 201 };
      case 'toggleItem':
        return { data: toggleShoppingItem(userId, body.itemId, body.checked) };
      case 'deleteItem':
        deleteShoppingItem(userId, body.itemId);
        return { data: { ok: true } };
      case 'listFromRecipes':
        return { data: shoppingListFromRecipes(userId, body.recipeIds, body.name), status: 201 };
    }
  },
});
