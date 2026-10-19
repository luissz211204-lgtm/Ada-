import { all, one, newId, nowIso } from '@/lib/db';
import { badRequest } from '@/lib/api/errors';
import { getOwned, updateOwned, deleteOwned } from './crud';
import { audit } from './audit';
import { toCents, fromCents } from './finance';

/** Trabajo y negocio. Separado del ámbito personal con `is_business`. */

export function listClients(userId: string, q?: string) {
  return q
    ? all('SELECT * FROM clients WHERE user_id = ? AND (name LIKE ? OR email LIKE ?) ORDER BY name', [
        userId,
        `%${q}%`,
        `%${q}%`,
      ])
    : all('SELECT * FROM clients WHERE user_id = ? ORDER BY name', [userId]);
}

export function createClient(userId: string, input: { name: string; email?: string; phone?: string; notes?: string }) {
  if (!input.name?.trim()) throw badRequest('El cliente necesita un nombre.');
  const row = one(
    'INSERT INTO clients (id, user_id, name, email, phone, notes) VALUES (?, ?, ?, ?, ?, ?) RETURNING *',
    [newId(), userId, input.name.trim(), input.email || '', input.phone || '', input.notes || ''],
  );
  audit({ userId, action: 'data.create', entity: 'client' });
  return row;
}

export function updateClient(userId: string, id: string, patch: Record<string, unknown>) {
  getOwned('clients', id, userId);
  const clean: Record<string, unknown> = {};
  for (const key of ['name', 'email', 'phone', 'notes']) {
    if (patch[key] !== undefined) clean[key] = patch[key] as never;
  }
  return updateOwned('clients', id, userId, clean);
}

export function deleteClient(userId: string, id: string): void {
  deleteOwned('clients', id, userId);
}

export interface WorkOrderRow {
  id: string;
  user_id: string;
  client_id: string | null;
  title: string;
  description: string;
  status: 'quoted' | 'accepted' | 'in_progress' | 'delivered' | 'cancelled';
  quote_cents: number | null;
  due_date: string | null;
  delivered_at: string | null;
}

export function listWorkOrders(userId: string, opts: { status?: string; client_id?: string } = {}) {
  const clauses = ['o.user_id = ?'];
  const params: string[] = [userId];
  if (opts.status) {
    clauses.push('o.status = ?');
    params.push(opts.status);
  }
  if (opts.client_id) {
    clauses.push('o.client_id = ?');
    params.push(opts.client_id);
  }
  return all(
    `SELECT o.*, c.name AS client_name FROM work_orders o
     LEFT JOIN clients c ON c.id = o.client_id
     WHERE ${clauses.join(' AND ')} ORDER BY o.due_date IS NULL, o.due_date`,
    params,
  ).map((row) => {
    const r = row as { id: string; quote_cents: number | null };
    return { ...r, quote: r.quote_cents !== null ? fromCents(r.quote_cents) : null };
  });
}

export function createWorkOrder(
  userId: string,
  input: {
    title: string;
    client_id?: string | null;
    description?: string;
    status?: WorkOrderRow['status'];
    quote?: number | null;
    due_date?: string | null;
    items?: { name: string; quantity?: string; unit_price?: number }[];
  },
) {
  if (!input.title?.trim()) throw badRequest('La orden necesita un título.');
  if (input.client_id) getOwned('clients', input.client_id, userId);
  const order = one<{ id: string }>(
    `INSERT INTO work_orders (id, user_id, client_id, title, description, status, quote_cents, due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    [
      newId(),
      userId,
      input.client_id ?? null,
      input.title.trim(),
      input.description || '',
      input.status || 'quoted',
      input.quote !== undefined && input.quote !== null ? toCents(input.quote) : null,
      input.due_date ?? null,
    ],
  );
  if (!order) throw new Error('No se pudo crear la orden.');
  let position = 0;
  for (const item of input.items ?? []) {
    if (!item.name?.trim()) continue;
    one(
      `INSERT INTO work_order_items (id, work_order_id, user_id, name, quantity, unit_price_cents, position)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [
        newId(),
        order.id,
        userId,
        item.name.trim(),
        item.quantity || '',
        item.unit_price !== undefined ? toCents(item.unit_price) : null,
        position++,
      ],
    );
  }
  audit({ userId, action: 'data.create', entity: 'work_order', entityId: order.id });
  return getWorkOrder(userId, order.id);
}

export function getWorkOrder(userId: string, id: string) {
  const order = getOwned<WorkOrderRow>('work_orders', id, userId);
  return {
    ...order,
    quote: order.quote_cents !== null ? fromCents(order.quote_cents) : null,
    items: all('SELECT * FROM work_order_items WHERE work_order_id = ? AND user_id = ? ORDER BY position', [
      id,
      userId,
    ]),
  };
}

export function updateWorkOrder(userId: string, id: string, patch: Record<string, unknown>) {
  getOwned('work_orders', id, userId);
  const clean: Record<string, unknown> = {};
  for (const key of ['title', 'description', 'status', 'due_date', 'client_id']) {
    if (patch[key] !== undefined) clean[key] = patch[key] as never;
  }
  if (patch.quote !== undefined) {
    clean.quote_cents = patch.quote === null ? null : toCents(Number(patch.quote));
  }
  if (clean.status === 'delivered') clean.delivered_at = nowIso();
  return updateOwned<WorkOrderRow>('work_orders', id, userId, clean);
}

export function deleteWorkOrder(userId: string, id: string): void {
  deleteOwned('work_orders', id, userId);
}

export function listInventory(userId: string, lowOnly = false) {
  const rows = all<{
    id: string;
    name: string;
    quantity: number;
    unit: string;
    min_quantity: number;
  }>('SELECT id, name, quantity, unit, min_quantity FROM inventory_items WHERE user_id = ? ORDER BY name', [userId]);
  return lowOnly ? rows.filter((r) => Number(r.quantity) <= Number(r.min_quantity)) : rows;
}

export function createInventoryItem(
  userId: string,
  input: { name: string; quantity?: number; unit?: string; min_quantity?: number; notes?: string },
) {
  if (!input.name?.trim()) throw badRequest('El artículo necesita un nombre.');
  return one(
    `INSERT INTO inventory_items (id, user_id, name, quantity, unit, min_quantity, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    [
      newId(),
      userId,
      input.name.trim(),
      input.quantity ?? 0,
      input.unit || 'pz',
      input.min_quantity ?? 0,
      input.notes || '',
    ],
  );
}

export function adjustInventory(userId: string, id: string, delta: number) {
  const item = getOwned<{ quantity: number }>('inventory_items', id, userId);
  const quantity = Math.max(0, Number(item.quantity) + Number(delta));
  return updateOwned('inventory_items', id, userId, { quantity });
}

/** Resumen de negocio: usa movimientos marcados como de negocio. */
export function businessSummary(userId: string, month: string) {
  const totals = one<{ income: number; expense: number }>(
    `SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount_cents END),0) AS income,
            COALESCE(SUM(CASE WHEN type='expense' THEN amount_cents END),0) AS expense
     FROM transactions WHERE user_id = ? AND is_business = 1 AND substr(txn_date,1,7) = ?`,
    [userId, month],
  );
  const orders = one<{ open: number; quoted: number }>(
    `SELECT
       COALESCE(SUM(CASE WHEN status IN ('accepted','in_progress') THEN 1 ELSE 0 END),0) AS open,
       COALESCE(SUM(CASE WHEN status = 'quoted' THEN 1 ELSE 0 END),0) AS quoted
     FROM work_orders WHERE user_id = ?`,
    [userId],
  );
  return {
    month,
    income: fromCents(totals?.income ?? 0),
    expense: fromCents(totals?.expense ?? 0),
    balance: fromCents((totals?.income ?? 0) - (totals?.expense ?? 0)),
    openOrders: Number(orders?.open ?? 0),
    pendingQuotes: Number(orders?.quoted ?? 0),
  };
}
