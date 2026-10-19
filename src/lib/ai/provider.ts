/**
 * Capa de proveedores de IA desacoplada (compatible con la API de OpenAI).
 *
 * - No asume ningún proveedor concreto: `AI_BASE_URL` puede apuntar a OpenAI,
 *   Groq, Together, LM Studio, Ollama, etc.
 * - Una suscripción de ChatGPT NO otorga acceso: hace falta `AI_API_KEY`.
 * - Los errores externos se propagan tipados para que la interfaz pueda
 *   informarlos sin fingir resultados.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface AiToolDef {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface AiCompletion {
  content: string | null;
  toolCalls: ToolCall[];
  usage: { promptTokens: number; completionTokens: number };
}

export class AiNotConfiguredError extends Error {
  constructor() {
    super(
      'El proveedor de IA no está configurado. Falta AI_API_KEY (y opcionalmente AI_BASE_URL/AI_MODEL). Configúralo en Configuración → Integraciones o en .env.local.',
    );
    this.name = 'AiNotConfiguredError';
  }
}

export class AiProviderError extends Error {
  constructor(
    message: string,
    public status?: number,
    public retryable = true,
  ) {
    super(message);
    this.name = 'AiProviderError';
  }
}

/** Precios orientativos (USD por millón de tokens) para control de costes. */
const PRICE_TABLE: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'llama-3.3-70b-versatile': { input: 0.59, output: 0.79 },
};

export interface AiConfig {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
}

export function getAiConfig(overrides?: { model?: string | null }): AiConfig {
  const apiKey = process.env.AI_API_KEY || '';
  if (!apiKey) throw new AiNotConfiguredError();
  const baseUrl = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = overrides?.model || process.env.AI_MODEL || 'gpt-4o-mini';
  return {
    provider: process.env.AI_PROVIDER || 'openai',
    baseUrl,
    apiKey,
    model,
    maxTokens: Number(process.env.AI_MAX_TOKENS || 2000),
  };
}

export function estimateCostCents(model: string, promptTokens: number, completionTokens: number): number {
  const price = PRICE_TABLE[model];
  if (!price) return 0;
  const usd = (promptTokens / 1_000_000) * price.input + (completionTokens / 1_000_000) * price.output;
  return Math.round(usd * 100);
}

export async function chatCompletion(
  messages: ChatMessage[],
  tools: AiToolDef[],
  config: AiConfig,
  signal?: AbortSignal,
): Promise<AiCompletion> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: config.maxTokens,
        tools: tools.length ? tools : undefined,
        tool_choice: tools.length ? 'auto' : undefined,
        temperature: 0.3,
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new AiProviderError('El proveedor de IA no respondió a tiempo (timeout).', undefined, true);
    }
    throw new AiProviderError(
      `No se pudo conectar con el proveedor de IA: ${(err as Error).message}`,
      undefined,
      true,
    );
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const retryable = res.status === 429 || res.status >= 500;
    const detail = text.slice(0, 300);
    throw new AiProviderError(
      `El proveedor de IA respondió ${res.status}. ${detail}`,
      res.status,
      retryable,
    );
  }

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new AiProviderError('El proveedor de IA devolvió una respuesta no válida.', undefined, false);
  }

  const choice = json?.choices?.[0]?.message;
  if (!choice) {
    throw new AiProviderError('Respuesta inesperada del proveedor (sin mensaje).', undefined, false);
  }

  return {
    content: choice.content ?? null,
    toolCalls: Array.isArray(choice.tool_calls) ? choice.tool_calls : [],
    usage: {
      promptTokens: Number(json?.usage?.prompt_tokens || 0),
      completionTokens: Number(json?.usage?.completion_tokens || 0),
    },
  };
}
