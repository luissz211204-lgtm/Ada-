import { describe, it, expect, afterEach } from 'vitest';
import { makeUser } from './helpers';
import { one } from '@/lib/db';
import { executeTool } from '@/lib/services/tools';
import { listApprovals, decideApproval } from '@/lib/services/approvals';
import { buildLifeContext } from '@/lib/ai/context';
import { runAssistantTurn } from '@/lib/ai/brain';
import { createTask } from '@/lib/services/tasks';

const ctx = (userId: string) => ({ userId, tz: 'America/Monterrey', source: 'assistant' as const });

describe('herramientas del asistente (niveles de riesgo)', () => {
  it('ejecuta herramientas de riesgo 1 (lectura) sobre datos reales', async () => {
    const u = makeUser('tool1');
    createTask(u.id, { title: 'Tarea visible' });
    const res = await executeTool(ctx(u.id), 'listar_tareas', {});
    expect(res.status).toBe('success');
    expect(JSON.stringify(res.data)).toContain('Tarea visible');
  });

  it('ejecuta herramientas de riesgo 2 (cambios reversibles)', async () => {
    const u = makeUser('tool2');
    const res = await executeTool(ctx(u.id), 'crear_tarea', { titulo: 'Creada por IA', prioridad: 1 });
    expect(res.status).toBe('success');
    const row = one<{ title: string }>('SELECT title FROM tasks WHERE user_id = ?', [u.id]);
    expect(row?.title).toBe('Creada por IA');
  });

  it('exige aprobación para riesgo 3 y no la ejecuta', async () => {
    const u = makeUser('tool3');
    const res = await executeTool(ctx(u.id), 'enviar_correo_al_usuario', {
      asunto: 'Hola',
      cuerpo: 'Texto',
    });
    expect(res.status).toBe('awaiting_approval');
    expect(res.approvalId).toBeTruthy();
    const approvals = listApprovals(u.id, 'pending');
    expect(approvals).toHaveLength(1);
    expect(approvals[0].tool_name).toBe('enviar_correo_al_usuario');
  });

  it('exige aprobación para riesgo 4 y solo ejecuta tras aprobar', async () => {
    const u = makeUser('tool4');
    const task = createTask(u.id, { title: 'Borrar esto' });
    const res = await executeTool(ctx(u.id), 'eliminar_tarea', { id: task.id });
    expect(res.status).toBe('awaiting_approval');
    expect(one('SELECT id FROM tasks WHERE id = ?', [task.id])).toBeTruthy();

    const out = await decideApproval(u.id, res.approvalId!, 'approve');
    expect(out.status).toBe('executed');
    expect(one('SELECT id FROM tasks WHERE id = ?', [task.id])).toBeUndefined();
  });

  it('al rechazar una aprobación no ejecuta la acción', async () => {
    const u = makeUser('tool5');
    const task = createTask(u.id, { title: 'No borrar' });
    const res = await executeTool(ctx(u.id), 'eliminar_tarea', { id: task.id });
    const out = await decideApproval(u.id, res.approvalId!, 'reject');
    expect(out.status).toBe('rejected');
    expect(one('SELECT id FROM tasks WHERE id = ?', [task.id])).toBeTruthy();
  });

  it('informa del error real cuando la acción externa no tiene credenciales', async () => {
    const u = makeUser('tool6');
    delete process.env.SMTP_URL;
    const res = await executeTool(ctx(u.id), 'enviar_correo_al_usuario', { asunto: 'A', cuerpo: 'B' });
    const out = await decideApproval(u.id, res.approvalId!, 'approve');
    expect(out.status).toBe('error');
    expect(out.message).toMatch(/SMTP/);
  });

  it('registra un error para herramientas desconocidas', async () => {
    const u = makeUser('tool7');
    const res = await executeTool(ctx(u.id), 'hackear_la_nasa', {});
    expect(res.status).toBe('error');
    expect(res.error).toMatch(/desconocida/i);
  });
});

describe('contexto real de vida', () => {
  it('incluye solo los datos del usuario indicado', () => {
    const a = makeUser('ctxa');
    const b = makeUser('ctxb');
    createTask(a.id, { title: 'Tarea confidencial A' });
    createTask(b.id, { title: 'Tarea confidencial B' });

    const text = buildLifeContext(a.id, 'America/Monterrey');
    expect(text).toContain('## Tareas');
    expect(text).toContain('Tarea confidencial A');
    expect(text).not.toContain('Tarea confidencial B');
  });
});

describe('Assistant Core', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.AI_API_KEY;
    delete process.env.AI_BASE_URL;
  });

  it('responde con honestidad cuando no hay proveedor de IA configurado', async () => {
    const u = makeUser('brain1');
    delete process.env.AI_API_KEY;
    const res = await runAssistantTurn(u.id, { message: '¿Qué tengo hoy?' });
    expect(res.notices).toContain('ia_no_configurada');
    expect(res.reply).toMatch(/modelo de IA/i);
    expect(res.model).toBe('no-configurado');
  });

  it('devuelve la respuesta del modelo cuando está configurado', async () => {
    const u = makeUser('brain2');
    process.env.AI_API_KEY = 'test-key';
    process.env.AI_BASE_URL = 'http://fake.local/v1';
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          choices: [{ message: { role: 'assistant', content: 'Hola, soy E.V.' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )) as typeof fetch;

    const res = await runAssistantTurn(u.id, { message: 'Hola' });
    expect(res.reply).toBe('Hola, soy E.V.');
    expect(res.usage.promptTokens).toBe(10);
    expect(res.notices).toHaveLength(0);
  });

  it('ejecuta herramientas cuando el modelo las solicita', async () => {
    const u = makeUser('brain3');
    process.env.AI_API_KEY = 'test-key';
    process.env.AI_BASE_URL = 'http://fake.local/v1';

    const responses = [
      {
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'crear_tarea',
                    arguments: JSON.stringify({ titulo: 'Generada por IA' }),
                  },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 8, completion_tokens: 4 },
      },
      {
        choices: [{ message: { role: 'assistant', content: 'Listo, creé la tarea.' } }],
        usage: { prompt_tokens: 12, completion_tokens: 6 },
      },
    ];
    let i = 0;
    globalThis.fetch = (async () => {
      const body = responses[Math.min(i, responses.length - 1)];
      i++;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as typeof fetch;

    const res = await runAssistantTurn(u.id, { message: 'Crea una tarea' });
    expect(res.reply).toBe('Listo, creé la tarea.');
    expect(res.toolRuns[0].toolName).toBe('crear_tarea');
    expect(res.toolRuns[0].status).toBe('success');
    const row = one<{ title: string }>(
      "SELECT title FROM tasks WHERE user_id = ? AND title = 'Generada por IA'",
      [u.id],
    );
    expect(row?.title).toBe('Generada por IA');
  });
});
