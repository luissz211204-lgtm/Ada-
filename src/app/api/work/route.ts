import { z } from 'zod';
import { defineHandler } from '@/lib/api/handler';
import {
  listClients,
  createClient,
  updateClient,
  deleteClient,
  listWorkOrders,
  createWorkOrder,
  updateWorkOrder,
  deleteWorkOrder,
  listInventory,
  createInventoryItem,
  adjustInventory,
  businessSummary,
} from '@/lib/services/work';
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
        clients: listClients(userId, url.searchParams.get('q') || undefined),
        orders: listWorkOrders(userId, {
          status: url.searchParams.get('status') || undefined,
          client_id: url.searchParams.get('client_id') || undefined,
        }),
        inventory: listInventory(userId, url.searchParams.get('low') === '1'),
        summary: businessSummary(userId, month),
      },
    };
  },
});

const body = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('addClient'),
    name: z.string().min(1),
    email: z.string().optional(),
    phone: z.string().optional(),
    notes: z.string().optional(),
  }),
  z.object({
    action: z.literal('updateClient'),
    id: z.string().min(1),
    name: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
    notes: z.string().optional(),
  }),
  z.object({ action: z.literal('deleteClient'), id: z.string().min(1) }),
  z.object({
    action: z.literal('addOrder'),
    title: z.string().min(1),
    client_id: z.string().nullable().optional(),
    description: z.string().optional(),
    status: z.enum(['quoted', 'accepted', 'in_progress', 'delivered', 'cancelled']).optional(),
    quote: z.coerce.number().nullable().optional(),
    due_date: z.string().nullable().optional(),
    items: z
      .array(z.object({ name: z.string().min(1), quantity: z.string().optional(), unit_price: z.coerce.number().optional() }))
      .optional(),
  }),
  z.object({
    action: z.literal('updateOrder'),
    id: z.string().min(1),
    title: z.string().optional(),
    description: z.string().optional(),
    status: z.enum(['quoted', 'accepted', 'in_progress', 'delivered', 'cancelled']).optional(),
    quote: z.coerce.number().nullable().optional(),
    due_date: z.string().nullable().optional(),
    client_id: z.string().nullable().optional(),
  }),
  z.object({ action: z.literal('deleteOrder'), id: z.string().min(1) }),
  z.object({
    action: z.literal('addInventory'),
    name: z.string().min(1),
    quantity: z.coerce.number().optional(),
    unit: z.string().optional(),
    min_quantity: z.coerce.number().optional(),
    notes: z.string().optional(),
  }),
  z.object({ action: z.literal('adjustInventory'), id: z.string().min(1), delta: z.coerce.number() }),
]);

export const POST = defineHandler({
  method: 'POST',
  schema: body,
  handler: async ({ authedUser, body }) => {
    initDatabase();
    const userId = authedUser.user.id;
    switch (body.action) {
      case 'addClient':
        return { data: createClient(userId, body), status: 201 };
      case 'updateClient':
        return { data: updateClient(userId, body.id, body) };
      case 'deleteClient':
        deleteClient(userId, body.id);
        return { data: { ok: true } };
      case 'addOrder':
        return { data: createWorkOrder(userId, body), status: 201 };
      case 'updateOrder':
        return { data: updateWorkOrder(userId, body.id, body) };
      case 'deleteOrder':
        deleteWorkOrder(userId, body.id);
        return { data: { ok: true } };
      case 'addInventory':
        return { data: createInventoryItem(userId, body), status: 201 };
      case 'adjustInventory':
        return { data: adjustInventory(userId, body.id, body.delta) };
    }
  },
});
