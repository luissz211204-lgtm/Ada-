'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { apiGet, apiSend, errorMessage } from '@/lib/client/api';
import { Button, Card, ErrorNote, PageHeader, Textarea } from '@/lib/ui';
import type { Conversation, AssistantMessage } from '@/lib/types/client';

type ChatResult = {
  conversation: Conversation;
  messages: AssistantMessage[];
  pendingApprovals?: any[];
  costCents?: number;
};

export default function AssistantPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loadingConvs, setLoadingConvs] = useState(true);

  async function loadConvs() {
    try {
      setLoadingConvs(true);
      const res = await apiGet<Conversation[]>('/api/assistant/conversations');
      setConversations(res);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoadingConvs(false);
    }
  }

  useEffect(() => { loadConvs(); }, []);

  async function send() {
    if (!input.trim()) return;
    try {
      setLoading(true);
      const res = await apiSend<ChatResult>('/api/assistant/chat', 'POST', {
        message: input.trim(),
        conversationId: active?.id ?? null,
      });
      setActive(res.conversation);
      setMessages(res.messages);
      setInput('');
      await loadConvs();
    } catch (e) {
      alert(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <PageHeader title="Asistente E.V." subtitle="Cerebro central: consulta datos reales y usa herramientas autorizadas" />

      {err && <ErrorNote message={err} onRetry={loadConvs} className="mb-2" />}

      <div className="flex flex-1 gap-4">
        <Card className="w-64 shrink-0 overflow-y-auto">
          <h2 className="mb-2 text-sm font-medium">Conversaciones</h2>
          <Button size="sm" variant="secondary" className="w-full" onClick={() => { setActive(null); setMessages([]); }}>Nueva conversación</Button>
          <ul className="mt-2 space-y-1">
            {conversations.map(c => (
              <li key={c.id}>
                <button
                  onClick={() => { setActive(c); }}
                  className={`w-full truncate rounded-lg px-2 py-1 text-left text-sm ${active?.id === c.id ? 'bg-sky-50 dark:bg-sky-950/40' : 'hover:bg-slate-100 dark:hover:bg-slate-800/60'}`}
                >
                  {c.title}
                </button>
              </li>
            ))}
            {loadingConvs && <li className="text-xs text-slate-500">Cargando...</li>}
          </ul>
        </Card>

        <Card className="flex flex-1 flex-col">
          <div className="flex-1 space-y-2 overflow-y-auto p-2">
            {messages.length === 0 && <p className="text-sm text-slate-500">Escribe un mensaje para comenzar...</p>}
            {messages.map((m, i) => (
              <div key={i} className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.role === 'user' ? 'ml-auto bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2 border-t border-slate-200 pt-2 dark:border-slate-800">
            <Textarea
              value={input}
              onChange={v => setInput(v)}
              rows={1}
              placeholder="Escribe tu mensaje..."
              className="min-h-[40px] flex-1"
              disabled={loading}
            />
            <Button variant="primary" onClick={send} disabled={loading || !input.trim()}>
              {loading ? 'Enviando...' : 'Enviar'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}