import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import {
  financeSummary,
  listTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  createBudget,
  createDebt,
  listDebts,
  payDebt,
  createSavingsGoal,
  addToSavings,
  listSavings,
  listBudgets,
} from '@/lib/services/finance';
import { todayInTz } from '@/lib/time';
import { initDatabase } from '@/lib/server/bootstrap';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineHandler({
  method: 'GET',
  handler: async ({ authedUser, url }) => {
    initDatabase();
    const userId = authedUser.user.id;
    const tz = authedUser.settings.timezone || 'America/Monterrey';
    const month = url.searchParams.get('month') || todayInTz(tz).slice(0, 7);
    return {
      data: {
        summary: financeSummary(userId, month, tz),
        transactions: listTransactions(userId, { month }),
        debts: listDebts(userId),
        savings: listSavings(userId),
        budgets: listBudgets(userId, month),
      },
    };
  },
});

const body = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('addTransaction'),
    type: z.enum(['income', 'expense']),
    amount: z.coerce.number().positive(),
    category: z.string().optional(),
    description: z.string().optional(),
    txn_date: z.string().optional(),
    is_business: z.boolean().optional(),
    project_id: z.string().nullable().optional(),
    debt_id: z.string().nullable().optional(),
  }),
  z.object({
    action: z.literal('updateTransaction'),
    id: z.string().min(1),
    amount: z.coerce.number().optional(),
    category: z.string().optional(),
    description: z.string().optional(),
    txn_date: z.string().optional(),
    type: z.enum(['income', 'expense']).optional(),
  }),
  z.object({ action: z.literal('deleteTransaction'), id: z.string().min(1) }),
  z.object({
    action: z.literal('addBudget'),
    category: z.string().min(1),
    month: z.string().min(1),
    amount: z.coerce.number().nonnegative(),
  }),
  z.object({
    action: z.literal('addDebt'),
    name: z.string().min(1),
    total: z.coerce.number().positive(),
    remaining: z.coerce.number().nonnegative().optional(),
    due_day: z.coerce.number().optional(),
    creditor: z.string().optional(),
    interest_notes: z.string().optional(),
  }),
  z.object({ action: z.literal('payDebt'), id: z.string().min(1), amount: z.coerce.number().positive() }),
  z.object({
    action: z.literal('addSavings'),
    name: z.string().min(1),
    target: z.coerce.number().positive(),
    target_date: z.string().optional(),
  }),
  z.object({ action: z.literal('addToSavings'), id: z.string().min(1), amount: z.coerce.number().positive() }),
]);

export const POST = defineHandler({
  method: 'POST',
  schema: body,
  handler: async ({ authedUser, body, ip }) => {
    initDatabase();
    const userId = authedUser.user.id;
    switch (body.action) {
      case 'addTransaction':
        return {
          data: createTransaction(userId, body, { source: 'user', ip }),
          status: 201,
        };
      case 'updateTransaction':
        return { data: updateTransaction(userId, body.id, body) };
      case 'deleteTransaction':
        deleteTransaction(userId, body.id);
        return { data: { ok: true } };
      case 'addBudget':
        return { data: createBudget(userId, body), status: 201 };
      case 'addDebt':
        return { data: createDebt(userId, body), status: 201 };
      case 'payDebt':
        payDebt(userId, body.id, body.amount);
        return { data: { ok: true } };
      case 'addSavings':
        return { data: createSavingsGoal(userId, body), status: 201 };
      case 'addToSavings':
        return { data: addToSavings(userId, body.id, body.amount) };
    }
  },
});
