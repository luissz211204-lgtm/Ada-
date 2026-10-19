import { all, newId, one, run, nowIso } from '@/lib/db';
import type { AiToolDef } from '@/lib/ai/provider';
import {
  listTasks,
  createTask,
  updateTask,
  deleteTask,
  taskSummary,
} from './tasks';
import { listReminders, createReminder } from './notifications';
import { createMemory, listMemories, deleteMemory } from './memories';
import { createNote, listNotes } from './notes';
import { financeSummary, createTransaction } from './finance';
import { todayInTz, formatInstant } from '@/lib/time';
import { badRequest } from '@/lib/api/errors';
import { audit } from './audit';

/**
 * Motor de herramientas del asistente.
 *
 * Niveles de riesgo:
 *  1 — consultas y lecturas autorizadas
 *  2 — cambios reversibles de bajo riesgo
 *  3 — acciones externas que requieren confirmación
 *  4 — acciones sensibles o irreversibles que requieren autorización explícita
 *
 * Ninguna herramienta ejecuta código arbitrario ni SQL generado por el modelo.
 */

export interface ToolResult {
  summary: string;
  data?: unknown;
}

export interface ToolContext {
  userId: string;
  conversationId?: string | null;
  ip?: string | null;
  tz: string;
  source: 'assistant' | 'dashboard';
}

export interface ToolDef {
  name: string;
  description: string;
  risk: 1 | 2 | 3 | 4;
  parameters: Record<string, unknown>;
  execute: (ctx: ToolContext, args: Record<string, any>) => Promise<ToolResult> | ToolResult;
}

const str = (description: string) => ({ type: 'string', description });
const num = (description: string) => ({ type: 'number', description });

function requireStr(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) throw badRequest(`El parámetro "${key}" es obligatorio.`);
  return v.trim();
}

/** Fechas: acepta 'YYYY-MM-DD' o ISO; siempre se normaliza. */
function normalizeDate(value: unknown, tz: string): string | null {
  if (!value) return null;
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return todayInTz(tz, d);
}

export const TOOLS: ToolDef[] = [
  // ---------------- Nivel 1: lectura ----------------
  {
    name: 'consultar_resumen_dia',
    description:
      'Devuelve el resumen real del día del usuario: tareas vencidas, tareas de hoy, prioridades y próximos eventos.',
    risk: 1,
    parameters: { type: 'object', properties: {}, required: [] },
    execute: (ctx) => {
      const s = taskSummary(ctx.userId, ctx.tz);
      const events = all<{ title: string; starts_at: string }>(
        `SELECT title, starts_at FROM calendar_events WHERE user_id = ? AND starts_at >= ?
         ORDER BY starts_at ASC LIMIT 8`,
        [ctx.userId, new Date().toISOString()],
      );
      return {
        summary: `Resumen de hoy (${s.today}): ${s.totals.open} tareas abiertas, ${s.totals.overdue} vencidas, ${s.totals.dueToday} para hoy, ${s.totals.doneToday} completadas hoy.`,
        data: {
          overdue: s.overdue.map((t) => ({ id: t.id, titulo: t.title, fecha: t.due_date, prioridad: t.priority })),
          hoy: s.dueToday.map((t) => ({ id: t.id, titulo: t.title, hora: t.due_time, prioridad: t.priority })),
          proximos_eventos: events.map((e) => ({ titulo: e.title, inicio: e.starts_at })),
        },
      };
    },
  },
  {
    name: 'listar_tareas',
    description: 'Lista las tareas del usuario con filtros opcionales.',
    risk: 1,
    parameters: {
      type: 'object',
      properties: {
        estado: { type: 'string', enum: ['pending', 'in_progress', 'done', 'cancelled'] },
        vencidas: { type: 'boolean' },
        limite: num('Máximo de tareas a devolver (por defecto 20)'),
      },
      required: [],
    },
    execute: (ctx, args) => {
      const tasks = listTasks(ctx.userId, {
        status: args.estado ? [args.estado] : ['pending', 'in_progress'],
        overdue: args.vencidas === true,
      }).slice(0, Number(args.limite) || 20);
      return {
        summary: `${tasks.length} tarea(s): ${tasks.map((t) => t.title).join('; ') || 'ninguna'}`,
        data: tasks.map((t) => ({
          id: t.id,
          titulo: t.title,
          estado: t.status,
          prioridad: t.priority,
          fecha: t.due_date,
          hora: t.due_time,
        })),
      };
    },
  },
  {
    name: 'listar_eventos',
    description: 'Lista los próximos eventos del calendario.',
    risk: 1,
    parameters: {
      type: 'object',
      properties: { dias: num('Días hacia adelante (por defecto 7)') },
      required: [],
    },
    execute: (ctx, args) => {
      const dias = Number(args.dias) || 7;
      const from = new Date().toISOString();
      const to = new Date(Date.now() + dias * 86400000).toISOString();
      const events = all<{ id: string; title: string; starts_at: string; ends_at: string; location: string }>(
        `SELECT id, title, starts_at, ends_at, location FROM calendar_events
         WHERE user_id = ? AND starts_at >= ? AND starts_at <= ? ORDER BY starts_at ASC LIMIT 30`,
        [ctx.userId, from, to],
      );
      return {
        summary:
          events.length === 0
            ? 'No hay eventos en ese periodo.'
            : events
                .map((e) => `${formatInstant(e.starts_at, ctx.tz, { dateStyle: 'short', timeStyle: 'short' })} ${e.title}`)
                .join(' | '),
        data: events,
      };
    },
  },
  {
    name: 'listar_proyectos',
    description: 'Lista los proyectos con su estado y progreso.',
    risk: 1,
    parameters: { type: 'object', properties: {}, required: [] },
    execute: (ctx) => {
      const projects = all<{ id: string; name: string; status: string; progress: number; due_date: string | null }>(
        `SELECT id, name, status, progress, due_date FROM projects WHERE user_id = ? ORDER BY status, name LIMIT 30`,
        [ctx.userId],
      );
      return {
        summary: projects.length
          ? projects.map((p) => `${p.name} [${p.status}] ${p.progress}%`).join(' | ')
          : 'No hay proyectos registrados.',
        data: projects,
      };
    },
  },
  {
    name: 'buscar_memorias',
    description: 'Busca en la memoria persistente (segundo cerebro) por palabras clave.',
    risk: 1,
    parameters: {
      type: 'object',
      properties: { consulta: str('Texto a buscar'), categoria: str('Categoría opcional') },
      required: ['consulta'],
    },
    execute: (ctx, args) => {
      const memories = listMemories(ctx.userId, {
        q: requireStr(args, 'consulta'),
        category: args.categoria,
        limit: 10,
      });
      return {
        summary:
          memories.length === 0
            ? 'No se encontraron recuerdos con ese criterio.'
            : memories.map((m) => `${m.title}: ${m.content.slice(0, 160)}`).join('\n'),
        data: memories.map((m) => ({
          id: m.id,
          titulo: m.title,
          contenido: m.content,
          categoria: m.category,
          confirmado: m.confirmed === 1,
        })),
      };
    },
  },
  {
    name: 'resumen_financiero',
    description: 'Resumen real de ingresos, gastos, deudas y ahorro del mes.',
    risk: 1,
    parameters: {
      type: 'object',
      properties: { mes: str('Mes en formato YYYY-MM (por defecto el mes actual)') },
      required: [],
    },
    execute: (ctx, args) => {
      const summary = financeSummary(ctx.userId, args.mes, ctx.tz);
      return {
        summary: `Mes ${summary.month}: ingresos ${summary.income}, gastos ${summary.expense}, balance ${summary.balance}. Deudas activas: ${summary.upcomingDebts.length}.`,
        data: summary,
      };
    },
  },
  {
    name: 'listar_recordatorios',
    description: 'Lista los recordatorios programados.',
    risk: 1,
    parameters: { type: 'object', properties: {}, required: [] },
    execute: (ctx) => {
      const reminders = listReminders(ctx.userId, { status: ['scheduled', 'snoozed'] }).slice(0, 15);
      return {
        summary: reminders.length
          ? reminders.map((r) => `${formatInstant(r.remind_at, ctx.tz, { dateStyle: 'short', timeStyle: 'short' })} ${r.title}`).join(' | ')
          : 'No hay recordatorios programados.',
        data: reminders.map((r) => ({ id: r.id, titulo: r.title, cuando: r.remind_at, estado: r.status })),
      };
    },
  },
  {
    name: 'listar_notas',
    description: 'Lista las notas del segundo cerebro.',
    risk: 1,
    parameters: {
      type: 'object',
      properties: { consulta: str('Búsqueda opcional por texto') },
      required: [],
    },
    execute: (ctx, args) => {
      const notes = listNotes(ctx.userId, { q: args.consulta, limit: 15 });
      return {
        summary: notes.length ? notes.map((n) => `${n.title}: ${n.content.slice(0, 120)}`).join('\n') : 'No hay notas.',
        data: notes.map((n) => ({ id: n.id, titulo: n.title, categoria: n.category })),
      };
    },
  },

  // ---------------- Nivel 2: cambios reversibles ----------------
  {
    name: 'crear_tarea',
    description: 'Crea una tarea en el sistema de organización del usuario.',
    risk: 2,
    parameters: {
      type: 'object',
      properties: {
        titulo: str('Título de la tarea'),
        descripcion: str('Descripción opcional'),
        prioridad: num('1 crítica, 2 alta, 3 media, 4 baja'),
        fecha: str('Fecha límite YYYY-MM-DD'),
        hora: str('Hora límite HH:MM'),
        proyecto_id: str('ID del proyecto relacionado, si existe'),
        recordar_minutos_antes: num('Minutos de antelación del recordatorio'),
      },
      required: ['titulo'],
    },
    execute: (ctx, args) => {
      const task = createTask(
        ctx.userId,
        {
          title: requireStr(args, 'titulo'),
          description: args.descripcion,
          priority: args.prioridad ? Number(args.prioridad) : undefined,
          due_date: normalizeDate(args.fecha, ctx.tz),
          due_time: args.hora ?? null,
          project_id: args.proyecto_id ?? null,
          reminder_lead_minutes:
            args.recordar_minutos_antes !== undefined ? Number(args.recordar_minutos_antes) : null,
        },
        { source: 'assistant', ip: ctx.ip ?? undefined },
      );
      return { summary: `Tarea creada: "${task.title}" (id ${task.id}).`, data: { id: task.id, titulo: task.title } };
    },
  },
  {
    name: 'actualizar_tarea',
    description: 'Actualiza campos de una tarea existente (título, fecha, prioridad, estado).',
    risk: 2,
    parameters: {
      type: 'object',
      properties: {
        id: str('ID de la tarea'),
        titulo: str('Nuevo título'),
        fecha: str('Nueva fecha YYYY-MM-DD, o vacío para quitarla'),
        hora: str('Nueva hora HH:MM'),
        prioridad: num('1 a 4'),
        estado: { type: 'string', enum: ['pending', 'in_progress', 'done', 'cancelled'] },
      },
      required: ['id'],
    },
    execute: (ctx, args) => {
      const id = requireStr(args, 'id');
      const patch: Record<string, unknown> = {};
      if (args.titulo) patch.title = args.titulo;
      // Solo se toca la fecha si el modelo la envía explícitamente.
      if ('fecha' in args) patch.due_date = normalizeDate(args.fecha, ctx.tz);
      if ('hora' in args) patch.due_time = args.hora || null;
      if (args.prioridad) patch.priority = Number(args.prioridad);
      if (args.estado) patch.status = args.estado;
      if (Object.keys(patch).length === 0) throw badRequest('No se indicó ningún cambio.');
      const task = updateTask(ctx.userId, id, patch, { source: 'assistant', ip: ctx.ip ?? undefined });
      return { summary: `Tarea actualizada: "${task.title}".`, data: { id: task.id, estado: task.status } };
    },
  },
  {
    name: 'crear_recordatorio',
    description: 'Programa un recordatorio. Se ejecutará desde el servidor, aunque la app esté cerrada.',
    risk: 2,
    parameters: {
      type: 'object',
      properties: {
        titulo: str('Título del recordatorio'),
        cuando_iso: str('Fecha y hora en ISO 8601 con zona (p. ej. 2026-10-20T15:00:00-06:00)'),
        mensaje: str('Mensaje opcional'),
      },
      required: ['titulo', 'cuando_iso'],
    },
    execute: (ctx, args) => {
      const iso = requireStr(args, 'cuando_iso');
      if (Number.isNaN(new Date(iso).getTime())) {
        throw badRequest('La fecha del recordatorio no es válida. Usa formato ISO 8601.');
      }
      const reminder = createReminder(ctx.userId, {
        title: requireStr(args, 'titulo'),
        message: args.mensaje,
        remind_at: new Date(iso).toISOString(),
        timezone: ctx.tz,
      });
      return {
        summary: `Recordatorio programado para ${formatInstant(reminder.remind_at, ctx.tz)}.`,
        data: { id: reminder.id, cuando: reminder.remind_at },
      };
    },
  },
  {
    name: 'crear_nota',
    description: 'Guarda una nota en el segundo cerebro.',
    risk: 2,
    parameters: {
      type: 'object',
      properties: {
        titulo: str('Título de la nota'),
        contenido: str('Contenido de la nota'),
        categoria: { type: 'string', enum: ['idea', 'reflexion', 'decision', 'aprendizaje', 'pendiente', 'referencia'] },
      },
      required: ['titulo'],
    },
    execute: (ctx, args) => {
      const note = createNote(ctx.userId, {
        title: requireStr(args, 'titulo'),
        content: args.contenido,
        category: args.categoria,
      });
      return { summary: `Nota guardada: "${note.title}".`, data: { id: note.id } };
    },
  },
  {
    name: 'guardar_memoria',
    description:
      'Guarda un recuerdo duradero en la memoria. Queda como NO confirmado hasta que el usuario lo valide.',
    risk: 2,
    parameters: {
      type: 'object',
      properties: {
        titulo: str('Título corto'),
        contenido: str('Contenido del recuerdo'),
        categoria: {
          type: 'string',
          enum: ['perfil', 'notas', 'proyectos', 'objetivos', 'referencia', 'aprendizajes', 'conversaciones'],
        },
      },
      required: ['titulo', 'contenido'],
    },
    execute: (ctx, args) => {
      const memory = createMemory(ctx.userId, {
        title: requireStr(args, 'titulo'),
        content: requireStr(args, 'contenido'),
        category: args.categoria,
        source: 'assistant',
        confirmed: false,
      });
      return {
        summary: `Guardado como memoria NO confirmada (id ${memory.id}). El usuario debe revisarla.`,
        data: { id: memory.id, confirmado: false },
      };
    },
  },
  {
    name: 'registrar_gasto',
    description: 'Registra un gasto o ingreso en las finanzas del usuario.',
    risk: 2,
    parameters: {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: ['income', 'expense'] },
        monto: num('Importe en unidades de la moneda, mayor que cero'),
        categoria: str('Categoría del movimiento'),
        descripcion: str('Descripción'),
        fecha: str('Fecha YYYY-MM-DD (por defecto hoy)'),
      },
      required: ['tipo', 'monto', 'categoria'],
    },
    execute: (ctx, args) => {
      const txn = createTransaction(
        ctx.userId,
        {
          type: args.tipo === 'income' ? 'income' : 'expense',
          amount: Number(args.monto),
          category: requireStr(args, 'categoria'),
          description: args.descripcion,
          txn_date: normalizeDate(args.fecha, ctx.tz) || undefined,
        },
        { source: 'assistant', ip: ctx.ip ?? undefined },
      );
      return {
        summary: `Movimiento registrado: ${txn.type === 'income' ? 'ingreso' : 'gasto'} de ${(txn.amount_cents / 100).toFixed(2)} ${txn.currency} en ${txn.category}.`,
        data: { id: txn.id },
      };
    },
  },
  {
    name: 'agregar_a_bandeja',
    description: 'Añade una idea o pendiente sin clasificar a la bandeja de entrada.',
    risk: 2,
    parameters: {
      type: 'object',
      properties: { contenido: str('Texto de la idea o pendiente') },
      required: ['contenido'],
    },
    execute: (ctx, args) => {
      const content = requireStr(args, 'contenido');
      const row = one<{ id: string }>(
        `INSERT INTO inbox_items (id, user_id, content, source) VALUES (?, ?, ?, 'assistant') RETURNING id`,
        [newId(), ctx.userId, content],
      );
      return { summary: 'Añadido a la bandeja de entrada.', data: { id: row?.id } };
    },
  },

  // ---------------- Nivel 3: acciones externas ----------------
  {
    name: 'enviar_correo_al_usuario',
    description:
      'Envía un correo electrónico al propio usuario (canal externo). Requiere aprobación explícita.',
    risk: 3,
    parameters: {
      type: 'object',
      properties: { asunto: str('Asunto del correo'), cuerpo: str('Contenido del correo') },
      required: ['asunto', 'cuerpo'],
    },
    execute: async (ctx, args) => {
      const smtpUrl = process.env.SMTP_URL;
      if (!smtpUrl) {
        throw new Error('SMTP no configurado: añade SMTP_URL en el entorno para usar este canal.');
      }
      const user = one<{ email: string }>('SELECT email FROM users WHERE id = ?', [ctx.userId]);
      if (!user) throw new Error('Usuario no encontrado.');
      const { sendSmtpMessage } = await import('@/lib/notifications/smtp');
      await sendSmtpMessage(smtpUrl, {
        from: process.env.EMAIL_FROM || 'ev@localhost',
        to: user.email,
        subject: `[E.V.] ${requireStr(args, 'asunto')}`,
        text: requireStr(args, 'cuerpo'),
      });
      return { summary: `Correo enviado a ${user.email}.` };
    },
  },

  // ---------------- Nivel 4: irreversibles ----------------
  {
    name: 'eliminar_tarea',
    description: 'Elimina una tarea de forma permanente. Requiere autorización explícita.',
    risk: 4,
    parameters: {
      type: 'object',
      properties: { id: str('ID de la tarea a eliminar') },
      required: ['id'],
    },
    execute: (ctx, args) => {
      const id = requireStr(args, 'id');
      deleteTask(ctx.userId, id);
      return { summary: `Tarea ${id} eliminada de forma permanente.` };
    },
  },
  {
    name: 'eliminar_memoria',
    description: 'Elimina un recuerdo de la memoria de forma permanente. Requiere autorización explícita.',
    risk: 4,
    parameters: {
      type: 'object',
      properties: { id: str('ID del recuerdo') },
      required: ['id'],
    },
    execute: (ctx, args) => {
      const id = requireStr(args, 'id');
      deleteMemory(ctx.userId, id);
      return { summary: `Recuerdo ${id} eliminado de forma permanente.` };
    },
  },
];

export function findTool(name: string): ToolDef | undefined {
  return TOOLS.find((t) => t.name === name);
}

/** Definiciones en formato OpenAI para enviar al modelo. */
export function toolDefinitions(): AiToolDef[] {
  return TOOLS.map((t) => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

export interface ToolExecutionResult {
  toolName: string;
  risk: number;
  status: 'success' | 'error' | 'awaiting_approval';
  summary: string;
  data?: unknown;
  error?: string;
  runId: string;
  approvalId?: string;
}

/**
 * Ejecuta una herramienta aplicando las reglas de riesgo y registrando
 * SIEMPRE la ejecución (auditable). Riesgo >= 3 no se ejecuta: se crea una
 * aprobación pendiente.
 */
export async function executeTool(
  ctx: ToolContext,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolExecutionResult> {
  const tool = findTool(name);
  const runId = newId();

  if (!tool) {
    run(
      `INSERT INTO assistant_tool_runs (id, user_id, conversation_id, tool_name, risk_level, input, status, error, finished_at)
       VALUES (?, ?, ?, ?, 1, ?, 'error', ?, ?)`,
      [runId, ctx.userId, ctx.conversationId ?? null, name, JSON.stringify(args), 'Herramienta desconocida', nowIso()],
    );
    return { toolName: name, risk: 1, status: 'error', summary: '', error: `Herramienta desconocida: ${name}`, runId };
  }

  run(
    `INSERT INTO assistant_tool_runs (id, user_id, conversation_id, tool_name, risk_level, input, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      runId,
      ctx.userId,
      ctx.conversationId ?? null,
      name,
      tool.risk,
      JSON.stringify(args),
      tool.risk >= 3 ? 'awaiting_approval' : 'success',
    ],
  );

  if (tool.risk >= 3) {
    const approvalId = newId();
    run(
      `INSERT INTO approvals (id, user_id, tool_run_id, tool_name, summary, input, risk_level, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        approvalId,
        ctx.userId,
        runId,
        name,
        describeAction(name, args),
        JSON.stringify(args),
        tool.risk,
      ],
    );
    audit({
      userId: ctx.userId,
      action: 'assistant.tool',
      entity: 'tool_run',
      entityId: runId,
      detail: { tool: name, risk: tool.risk, awaitingApproval: true },
    });
    return {
      toolName: name,
      risk: tool.risk,
      status: 'awaiting_approval',
      summary: `Acción de riesgo ${tool.risk} registrada y pendiente de aprobación (aprobación ${approvalId}).`,
      runId,
      approvalId,
    };
  }

  try {
    const result = await tool.execute(ctx, args);
    run('UPDATE assistant_tool_runs SET status = ?, output = ?, finished_at = ? WHERE id = ?', [
      'success',
      JSON.stringify(result.data ?? null),
      nowIso(),
      runId,
    ]);
    audit({
      userId: ctx.userId,
      action: 'assistant.tool',
      entity: 'tool_run',
      entityId: runId,
      detail: { tool: name, risk: tool.risk, status: 'success' },
    });
    return { toolName: name, risk: tool.risk, status: 'success', summary: result.summary, data: result.data, runId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    run('UPDATE assistant_tool_runs SET status = ?, error = ?, finished_at = ? WHERE id = ?', [
      'error',
      message,
      nowIso(),
      runId,
    ]);
    audit({
      userId: ctx.userId,
      action: 'assistant.tool',
      entity: 'tool_run',
      entityId: runId,
      detail: { tool: name, risk: tool.risk, status: 'error', error: message },
    });
    return { toolName: name, risk: tool.risk, status: 'error', summary: '', error: message, runId };
  }
}

/** Ejecuta una herramienta ya aprobada (sin volver a pedir aprobación). */
export async function executeApprovedTool(
  ctx: ToolContext,
  name: string,
  args: Record<string, unknown>,
  runId: string,
): Promise<{ status: 'success' | 'error'; summary: string; error?: string }> {
  const tool = findTool(name);
  if (!tool) return { status: 'error', summary: '', error: `Herramienta desconocida: ${name}` };
  try {
    const result = await tool.execute(ctx, args);
    run('UPDATE assistant_tool_runs SET status = ?, output = ?, finished_at = ? WHERE id = ?', [
      'success',
      JSON.stringify(result.data ?? null),
      nowIso(),
      runId,
    ]);
    return { status: 'success', summary: result.summary };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    run('UPDATE assistant_tool_runs SET status = ?, error = ?, finished_at = ? WHERE id = ?', [
      'error',
      message,
      nowIso(),
      runId,
    ]);
    return { status: 'error', summary: '', error: message };
  }
}

/** Descripción legible de la acción para la pantalla de aprobaciones. */
export function describeAction(name: string, args: Record<string, unknown>): string {
  const labels: Record<string, string> = {
    enviar_correo_al_usuario: 'Enviar un correo electrónico',
    eliminar_tarea: 'Eliminar una tarea de forma permanente',
    eliminar_memoria: 'Eliminar un recuerdo de forma permanente',
  };
  const base = labels[name] || `Ejecutar la herramienta ${name}`;
  return `${base} · ${JSON.stringify(args).slice(0, 300)}`;
}
