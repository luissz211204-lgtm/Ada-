import { all, one, newId, nowIso } from '@/lib/db';
import { badRequest } from '@/lib/api/errors';
import { getOwned, updateOwned, deleteOwned } from './crud';
import { audit } from './audit';
import { todayInTz } from '@/lib/time';

export interface TransactionRow {
  id: string;
  user_id: string;
  type: 'income' | 'expense';
  amount_cents: number;
  currency: string;
  category: string;
  description: string;
  txn_date: string;
  debt_id: string | null;
  project_id: string | null;
  is_business: number;
  created_at: string;
  updated_at: string;
}

export function toCents(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) throw badRequest('El importe debe ser mayor que cero.');
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return Math.round(Number(cents || 0)) / 100;
}

export function listTransactions(
  userId: string,
  opts: { month?: string; type?: 'income' | 'expense'; category?: string; is_business?: boolean; limit?: number } = {},
): TransactionRow[] {
  const clauses = ['user_id = ?'];
  const params: (string | number)[] = [userId];
  if (opts.month) {
    clauses.push(`substr(txn_date,1,7) = ?`);
    params.push(opts.month);
  }
  if (opts.type) {
    clauses.push('type = ?');
    params.push(opts.type);
  }
  if (opts.category) {
    clauses.push('category = ?');
    params.push(opts.category);
  }
  if (opts.is_business !== undefined) {
    clauses.push('is_business = ?');
    params.push(opts.is_business ? 1 : 0);
  }
  return all<TransactionRow>(
    `SELECT * FROM transactions WHERE ${clauses.join(' AND ')} ORDER BY txn_date DESC, created_at DESC LIMIT ?`,
    [...params, opts.limit ?? 200],
  );
}

export function createTransaction(
  userId: string,
  input: {
    type: 'income' | 'expense';
    amount: number;
    category?: string;
    description?: string;
    txn_date?: string;
    currency?: string;
    is_business?: boolean;
    debt_id?: string | null;
    project_id?: string | null;
  },
  meta: { source?: 'user' | 'assistant'; ip?: string } = {},
): TransactionRow {
  const cents = toCents(input.amount);
  if (input.debt_id) getOwned('debts', input.debt_id, userId);
  if (input.project_id) getOwned('projects', input.project_id, userId);
  const row = one<TransactionRow>(
    `INSERT INTO transactions (id, user_id, type, amount_cents, currency, category, description, txn_date, debt_id, project_id, is_business)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [
      newId(),
      userId,
      input.type,
      cents,
      input.currency || 'MXN',
      input.category || 'general',
      input.description || '',
      input.txn_date || todayInTz('America/Monterrey'),
      input.debt_id ?? null,
      input.project_id ?? null,
      input.is_business ? 1 : 0,
    ],
  );
  if (!row) throw new Error('No se pudo registrar el movimiento.');
  audit({ userId, action: 'data.create', entity: 'transaction', entityId: row.id, detail: { source: meta.source ?? 'user' }, ip: meta.ip });
  return row;
}

export function updateTransaction(userId: string, id: string, patch: Record<string, unknown>): TransactionRow {
  getOwned('transactions', id, userId);
  const clean: Record<string, unknown> = {};
  if (patch.amount !== undefined) clean.amount_cents = toCents(Number(patch.amount));
  if (patch.category !== undefined) clean.category = patch.category;
  if (patch.description !== undefined) clean.description = patch.description;
  if (patch.txn_date !== undefined) clean.txn_date = patch.txn_date;
  if (patch.type !== undefined) clean.type = patch.type;
  return updateOwned<TransactionRow>('transactions', id, userId, clean);
}

export function deleteTransaction(userId: string, id: string): void {
  deleteOwned('transactions', id, userId);
  audit({ userId, action: 'data.delete', entity: 'transaction', entityId: id });
}

export interface FinanceSummary {
  month: string;
  income: number;
  expense: number;
  balance: number;
  byCategory: { category: string; total: number; type: string }[];
  upcomingDebts: { name: string; remaining: number; due_day: number | null }[];
  savings: { name: string; target: number; saved: number; progress: number }[];
  budgets: { category: string; amount: number; spent: number; over: boolean }[];
}

/** Resumen financiero del mes: SIEMPRE calculado sobre registros reales. */
export function financeSummary(userId: string, month?: string, tz = 'America/Monterrey'): FinanceSummary {
  const m = month || todayInTz(tz).slice(0, 7);
  const totals = one<{ income: number; expense: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN type='income' THEN amount_cents END),0) AS income,
       COALESCE(SUM(CASE WHEN type='expense' THEN amount_cents END),0) AS expense
     FROM transactions WHERE user_id = ? AND substr(txn_date,1,7) = ?`,
    [userId, m],
  );
  const byCategory = all<{ category: string; type: string; total: number }>(
    `SELECT category, type, SUM(amount_cents) AS total FROM transactions
     WHERE user_id = ? AND substr(txn_date,1,7) = ? GROUP BY category, type ORDER BY total DESC`,
    [userId, m],
  );
  const upcomingDebts = all<{ name: string; remaining_cents: number; due_day: number | null }>(
    `SELECT name, remaining_cents, due_day FROM debts WHERE user_id = ? AND status = 'active' ORDER BY due_day IS NULL, due_day`,
    [userId],
  );
  const savings = all<{ name: string; target_cents: number; saved_cents: number }>(
    `SELECT name, target_cents, saved_cents FROM savings_goals WHERE user_id = ? AND status = 'active'`,
    [userId],
  );
  const budgets = all<{ category: string; amount_cents: number }>(
    `SELECT category, amount_cents FROM budgets WHERE user_id = ? AND month = ?`,
    [userId, m],
  );

  return {
    month: m,
    income: fromCents(totals?.income ?? 0),
    expense: fromCents(totals?.expense ?? 0),
    balance: fromCents((totals?.income ?? 0) - (totals?.expense ?? 0)),
    byCategory: byCategory.map((c) => ({
      category: c.category,
      type: c.type,
      total: fromCents(c.total),
    })),
    upcomingDebts: upcomingDebts.map((d) => ({
      name: d.name,
      remaining: fromCents(d.remaining_cents),
      due_day: d.due_day,
    })),
    savings: savings.map((s) => ({
      name: s.name,
      target: fromCents(s.target_cents),
      saved: fromCents(s.saved_cents),
      progress: s.target_cents > 0 ? Math.round((s.saved_cents / s.target_cents) * 100) : 0,
    })),
    budgets: budgets.map((b) => {
      const spent = byCategory
        .filter((c) => c.type === 'expense' && c.category === b.category)
        .reduce((acc, c) => acc + Number(c.total), 0);
      return {
        category: b.category,
        amount: fromCents(b.amount_cents),
        spent: fromCents(spent),
        over: spent > b.amount_cents,
      };
    }),
  };
}

export function createBudget(userId: string, input: { category: string; month: string; amount: number }) {
  const row = one(
    `INSERT INTO budgets (id, user_id, category, month, amount_cents) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, category, month) DO UPDATE SET amount_cents = excluded.amount_cents, updated_at = ?
     RETURNING *`,
    [newId(), userId, input.category, input.month, toCents(input.amount), nowIso()],
  );
  return row;
}

export function createDebt(
  userId: string,
  input: { name: string; total: number; remaining?: number; due_day?: number; creditor?: string; interest_notes?: string },
) {
  const total = toCents(input.total);
  const remaining = input.remaining !== undefined ? Math.round(input.remaining * 100) : total;
  const row = one(
    `INSERT INTO debts (id, user_id, name, creditor, total_cents, remaining_cents, due_day, interest_notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [newId(), userId, input.name, input.creditor || '', total, remaining, input.due_day ?? null, input.interest_notes || ''],
  );
  audit({ userId, action: 'data.create', entity: 'debt' });
  return row;
}

export function listDebts(userId: string) {
  return all<{ id: string; name: string; creditor: string; total_cents: number; remaining_cents: number; due_day: number | null; status: string }>(
    'SELECT id, name, creditor, total_cents, remaining_cents, due_day, status FROM debts WHERE user_id = ? ORDER BY status, due_day IS NULL, due_day',
    [userId],
  );
}

export function payDebt(userId: string, id: string, amount: number): void {
  const debt = getOwned<{ id: string; remaining_cents: number }>('debts', id, userId);
  const cents = toCents(amount);
  const remaining = Math.max(0, debt.remaining_cents - cents);
  updateOwned('debts', id, userId, {
    remaining_cents: remaining,
    status: remaining === 0 ? 'paid' : 'active',
  });
  createTransaction(userId, {
    type: 'expense',
    amount,
    category: 'deudas',
    description: `Pago de deuda`,
    debt_id: id,
  });
}

export function listSavings(userId: string) {
  return all<{ id: string; name: string; target_cents: number; saved_cents: number; target_date: string | null; status: string }>(
    'SELECT id, name, target_cents, saved_cents, target_date, status FROM savings_goals WHERE user_id = ? ORDER BY status, name',
    [userId],
  );
}

export function listBudgets(userId: string, month: string) {
  return all<{ id: string; category: string; month: string; amount_cents: number }>(
    'SELECT id, category, month, amount_cents FROM budgets WHERE user_id = ? AND month = ? ORDER BY category',
    [userId, month],
  );
}

export function createSavingsGoal(userId: string, input: { name: string; target: number; target_date?: string }) {
  const row = one(
    `INSERT INTO savings_goals (id, user_id, name, target_cents, target_date) VALUES (?, ?, ?, ?, ?) RETURNING *`,
    [newId(), userId, input.name, toCents(input.target), input.target_date ?? null],
  );
  return row;
}

export function addToSavings(userId: string, id: string, amount: number) {
  const goal = getOwned<{ id: string; saved_cents: number; target_cents: number }>('savings_goals', id, userId);
  const saved = goal.saved_cents + toCents(amount);
  return updateOwned('savings_goals', id, userId, {
    saved_cents: saved,
    status: saved >= goal.target_cents ? 'done' : 'active',
  });
}
