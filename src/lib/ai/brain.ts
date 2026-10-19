import { all, one, run, newId, nowIso } from '@/lib/db';
import {
  AiNotConfiguredError,
  AiProviderError,
  chatCompletion,
  estimateCostCents,
  getAiConfig,
  type ChatMessage,
} from '@/lib/ai/provider';
import { buildSystemPrompt, personalityFromSettings } from '@/lib/ai/personality';
import { buildLifeContext } from '@/lib/ai/context';
import { executeTool, toolDefinitions } from '@/lib/services/tools';
import { loadSettings } from '@/lib/auth/session';
import { todayInTz } from '@/lib/time';
import { serviceUnavailable } from '@/lib/api/errors';
import { initDatabase } from '@/lib/server/bootstrap';

/**
 * Assistant Core: interpreta la solicitud en lenguaje natural, consulta los
 * datos reales mediante herramientas autorizadas y devuelve una respuesta
 * honesta. Todas las operaciones pasan por servicios con permisos.
 */

export interface AssistantToolRunSummary {
  toolName: string;
  risk: number;
  status: string;
  summary: string;
  error?: string;
  approvalId?: string;
}

export interface AssistantTurnResult {
  conversationId: string;
  reply: string;
  toolRuns: AssistantToolRunSummary[];
  pendingApprovals: number;
  model: string;
  usage: { promptTokens: number; completionTokens: number; costCents: number };
  notices: string[];
}

const MAX_TOOL_ROUNDS = 4;
const HISTORY_LIMIT = 12;

function ensureConversation(userId: string, conversationId: string | null | undefined, firstMessage: string): string {
  if (conversationId) {
    const conv = one<{ id: string }>('SELECT id FROM conversations WHERE id = ? AND user_id = ?', [
      conversationId,
      userId,
    ]);
    if (!conv) throw serviceUnavailable('La conversación no existe o no pertenece al usuario.');
    run('UPDATE conversations SET updated_at = ? WHERE id = ?', [nowIso(), conversationId]);
    return conversationId;
  }
  const id = newId();
  const title = firstMessage.trim().slice(0, 60) || 'Nueva conversación';
  run('INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)', [id, userId, title]);
  return id;
}

function monthlySpendCents(userId: string): number {
  const row = one<{ total: number }>(
    `SELECT COALESCE(SUM(cost_cents),0) AS total FROM ai_usage_logs
     WHERE user_id = ? AND substr(created_at,1,7) = ?`,
    [userId, new Date().toISOString().slice(0, 7)],
  );
  return Number(row?.total ?? 0);
}

export function checkAiBudget(userId: string, settingsBudget: number): void {
  if (settingsBudget > 0 && monthlySpendCents(userId) >= settingsBudget) {
    throw serviceUnavailable(
      `Se alcanzó el límite mensual de uso de IA configurado (${(settingsBudget / 100).toFixed(2)} USD). Ajusta el límite en Configuración.`,
    );
  }
}

export async function runAssistantTurn(
  userId: string,
  input: { conversationId?: string | null; message: string; ip?: string | null },
): Promise<AssistantTurnResult> {
  initDatabase();
  const statement = (input.message || '').trim();
  if (!statement) throw serviceUnavailable('El mensaje está vacío.');

  const settings = loadSettings(userId);
  if (!settings) throw serviceUnavailable('Configuración de usuario no encontrada.');
  const tz = settings.timezone || 'America/Monterrey';
  const conversationId = ensureConversation(userId, input.conversationId, statement);

  // Persistimos el mensaje del usuario antes de llamar al modelo.
  run(
    `INSERT INTO messages (id, conversation_id, user_id, role, content) VALUES (?, ?, ?, 'user', ?)`,
    [newId(), conversationId, userId, statement],
  );

  const notices: string[] = [];
  const toolRunSummaries: AssistantToolRunSummary[] = [];

  // Historial reciente (solo roles conversacionales).
  const history = all<{ role: string; content: string; tool_runs: string | null }>(
    `SELECT role, content, tool_runs FROM messages
     WHERE conversation_id = ? AND role IN ('user','assistant')
     ORDER BY created_at DESC LIMIT ?`,
    [conversationId, HISTORY_LIMIT],
  ).reverse();

  let config;
  try {
    checkAiBudget(userId, settings.ai_monthly_budget_cents);
    config = getAiConfig({ model: settings.ai_model });
  } catch (err) {
    const message =
      err instanceof AiNotConfiguredError
        ? `Aún no tengo acceso a un modelo de IA. Para conversar y ejecutar acciones necesito que configures un proveedor: añade \`AI_API_KEY\` (y opcionalmente \`AI_BASE_URL\` y \`AI_MODEL\`) en tu archivo \`.env.local\`, o configúralo en Configuración → Integraciones. Mientras tanto puedo mostrarte tus datos desde los módulos de Tareas, Calendario y Finanzas.`
        : err instanceof Error
          ? err.message
          : 'No se pudo preparar el proveedor de IA.';
    run(`INSERT INTO messages (id, conversation_id, user_id, role, content) VALUES (?, ?, ?, 'assistant', ?)`, [
      newId(),
      conversationId,
      userId,
      message,
    ]);
    return {
      conversationId,
      reply: message,
      toolRuns: [],
      pendingApprovals: 0,
      model: 'no-configurado',
      usage: { promptTokens: 0, completionTokens: 0, costCents: 0 },
      notices: err instanceof AiNotConfiguredError ? ['ia_no_configurada'] : ['ia_error'],
    };
  }

  const today = todayInTz(tz);
  const lifeContext = buildLifeContext(userId, tz);
  const systemPrompt = buildSystemPrompt(personalityFromSettings(settings), lifeContext, tz, today);

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content })),
  ];

  let usage = { promptTokens: 0, completionTokens: 0 };
  let reply: string | null = null;
  const tools = toolDefinitions();

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let completion;
    try {
      completion = await chatCompletion(messages, tools, config);
    } catch (err) {
      const text =
        err instanceof AiProviderError
          ? `No pude consultar el modelo de IA: ${err.message}`
          : `Error inesperado del proveedor de IA: ${(err as Error).message}`;
      run(`INSERT INTO messages (id, conversation_id, user_id, role, content) VALUES (?, ?, ?, 'assistant', ?)`, [
        newId(),
        conversationId,
        userId,
        text,
      ]);
      notices.push('ia_error');
      return {
        conversationId,
        reply: text,
        toolRuns: toolRunSummaries,
        pendingApprovals: 0,
        model: config.model,
        usage: { ...usage, costCents: 0 },
        notices,
      };
    }

    usage = {
      promptTokens: usage.promptTokens + completion.usage.promptTokens,
      completionTokens: usage.completionTokens + completion.usage.completionTokens,
    };

    if (completion.toolCalls.length === 0) {
      reply = completion.content || '';
      break;
    }

    messages.push({
      role: 'assistant',
      content: completion.content,
      tool_calls: completion.toolCalls,
    });

    for (const call of completion.toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
      } catch {
        args = {};
      }
      const result = await executeTool(
        { userId, conversationId, ip: input.ip ?? null, tz, source: 'assistant' },
        call.function.name,
        args,
      );
      toolRunSummaries.push({
        toolName: result.toolName,
        risk: result.risk,
        status: result.status,
        summary: result.summary,
        error: result.error,
        approvalId: result.approvalId,
      });
      if (result.status === 'awaiting_approval') notices.push('requiere_aprobacion');

      const toolContent =
        result.status === 'success'
          ? `Resultado (${result.toolName}): ${result.summary}`
          : result.status === 'awaiting_approval'
            ? `La acción "${result.toolName}" requiere aprobación del usuario. Explícale exactamente qué se va a hacer y que debe aprobarlo en el panel de aprobaciones. No afirmes que se ejecutó.`
            : `Error al ejecutar ${result.toolName}: ${result.error}`;

      messages.push({
        role: 'tool',
        content: toolContent,
        tool_call_id: call.id,
        name: result.toolName,
      });
    }
  }

  if (reply === null) {
    reply =
      'Necesité más pasos de los permitidos para completar la solicitud. Esto es lo que sí se ejecutó:\n' +
      (toolRunSummaries.map((t) => `- ${t.toolName}: ${t.status}${t.error ? ` (${t.error})` : ''}`).join('\n') || '- Nada.');
  }

  const costCents = estimateCostCents(config.model, usage.promptTokens, usage.completionTokens);
  const pending = one<{ c: number }>(
    `SELECT COUNT(*) AS c FROM approvals WHERE user_id = ? AND status = 'pending'`,
    [userId],
  );

  run(
    `INSERT INTO messages (id, conversation_id, user_id, role, content, tool_runs)
     VALUES (?, ?, ?, 'assistant', ?, ?)`,
    [newId(), conversationId, userId, reply, JSON.stringify(toolRunSummaries)],
  );
  run(
    `INSERT INTO ai_usage_logs (id, user_id, provider, model, prompt_tokens, completion_tokens, cost_cents)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [newId(), userId, config.provider, config.model, usage.promptTokens, usage.completionTokens, costCents],
  );
  run('UPDATE conversations SET updated_at = ? WHERE id = ?', [nowIso(), conversationId]);

  return {
    conversationId,
    reply,
    toolRuns: toolRunSummaries,
    pendingApprovals: Number(pending?.c ?? 0),
    model: config.model,
    usage: { ...usage, costCents },
    notices,
  };
}

export function listConversations(userId: string, limit = 30) {
  return all<{ id: string; title: string; updated_at: string; created_at: string }>(
    'SELECT id, title, updated_at, created_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?',
    [userId, limit],
  );
}

export function listMessages(userId: string, conversationId: string, limit = 100) {
  const conv = one<{ id: string }>('SELECT id FROM conversations WHERE id = ? AND user_id = ?', [
    conversationId,
    userId,
  ]);
  if (!conv) throw serviceUnavailable('Conversación no encontrada.');
  return all<{ id: string; role: string; content: string; tool_runs: string | null; created_at: string }>(
    `SELECT id, role, content, tool_runs, created_at FROM messages
     WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?`,
    [conversationId, limit],
  );
}

export function toolRunHistory(userId: string, limit = 50) {
  return all<{
    id: string;
    tool_name: string;
    risk_level: number;
    status: string;
    error: string | null;
    created_at: string;
  }>(
    `SELECT id, tool_name, risk_level, status, error, created_at FROM assistant_tool_runs
     WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    [userId, limit],
  );
}
