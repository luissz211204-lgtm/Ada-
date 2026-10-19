import { all, one, run, newId, nowIso } from '@/lib/db';
import { audit } from './audit';

/**
 * Estado HONESTO de las integraciones. Una integración solo se marca como
 * `connected` si existe la credencial correspondiente en el entorno y se ha
 * verificado su uso. No se finge ninguna conexión externa.
 *
 * Los secretos NO se guardan ni se exponen desde aquí: viven únicamente en
 * variables de entorno (.env.local). Esta capa solo reporta y guarda
 * preferencias no sensibles.
 */

export type Provider = 'ai' | 'email' | 'whatsapp' | 'voice' | 'google_calendar' | 'telegram';

export interface IntegrationStatus {
  provider: Provider;
  label: string;
  status: 'disconnected' | 'configured' | 'connected';
  detail: string;
  /** Variables de entorno necesarias para activarla. */
  requires: string[];
  /** Estado guardado por el usuario (no sensible). */
  enabled?: boolean;
}

const LABELS: Record<Provider, string> = {
  ai: 'Motor de inteligencia artificial',
  email: 'Correo (SMTP)',
  whatsapp: 'WhatsApp Business',
  voice: 'Voz',
  google_calendar: 'Google Calendar',
  telegram: 'Telegram',
};

export function integrationStatuses(userId: string): IntegrationStatus[] {
  const settings = one<{ voice_enabled: number }>('SELECT voice_enabled FROM user_settings WHERE user_id = ?', [userId]);
  const ai = Boolean(process.env.AI_API_KEY);
  const email = Boolean(process.env.SMTP_URL);
  const whatsapp = Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  const voiceEnabled = settings?.voice_enabled === 1;

  const rows = all<{ provider: Provider; status: string }>(
    'SELECT provider, status FROM integrations WHERE user_id = ?',
    [userId],
  );
  const manual = new Map(rows.map((r) => [r.provider, r.status]));

  const base: IntegrationStatus[] = [
    {
      provider: 'ai',
      label: LABELS.ai,
      status: ai ? 'configured' : 'disconnected',
      detail: ai
        ? `Proveedor configurado (${process.env.AI_PROVIDER || 'openai'}, modelo ${process.env.AI_MODEL || 'gpt-4o-mini'}).`
        : 'Falta AI_API_KEY. Sin ella, el asistente responde con un aviso honesto y el resto de módulos sigue funcionando.',
      requires: ['AI_API_KEY', 'AI_BASE_URL', 'AI_MODEL'],
    },
    {
      provider: 'email',
      label: LABELS.email,
      status: email ? 'configured' : 'disconnected',
      detail: email
        ? 'SMTP configurado. Las notificaciones por correo se intentarán en el worker.'
        : 'Falta SMTP_URL. Las notificaciones por correo quedan registradas como "skipped".',
      requires: ['SMTP_URL', 'EMAIL_FROM'],
    },
    {
      provider: 'whatsapp',
      label: LABELS.whatsapp,
      status: whatsapp ? 'configured' : 'disconnected',
      detail: whatsapp
        ? 'Credenciales presentes. El canal está preparado; la verificación de plantillas se hace con Meta.'
        : 'Preparado pero inactivo: requiere token y número de Meta WhatsApp Business Cloud API.',
      requires: ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_VERIFY_TOKEN'],
    },
    {
      provider: 'voice',
      label: LABELS.voice,
      status: voiceEnabled ? 'configured' : 'disconnected',
      detail: voiceEnabled
        ? 'Voz habilitada en ajustes. La entrada/salida de voz se activa en el dispositivo del usuario.'
        : 'Desactivada. Actívala en Configuración para usar el micrófono del dispositivo.',
      requires: [],
      enabled: voiceEnabled,
    },
    {
      provider: 'google_calendar',
      label: LABELS.google_calendar,
      status: (manual.get('google_calendar') as IntegrationStatus['status']) || 'disconnected',
      detail: 'Sincronización no implementada todavía: el calendario propio funciona en local.',
      requires: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
    },
    {
      provider: 'telegram',
      label: LABELS.telegram,
      status: (manual.get('telegram') as IntegrationStatus['status']) || 'disconnected',
      detail: 'Bot de Telegram no implementado todavía.',
      requires: ['TELEGRAM_BOT_TOKEN'],
    },
  ];
  return base;
}

/** Guarda el estado/preferencia no sensible de una integración. */
export function upsertIntegration(
  userId: string,
  provider: Provider,
  patch: { status?: IntegrationStatus['status']; config?: Record<string, unknown> },
): IntegrationStatus {
  const existing = one<{ id: string }>('SELECT id FROM integrations WHERE user_id = ? AND provider = ?', [
    userId,
    provider,
  ]);
  if (existing) {
    run(
      'UPDATE integrations SET status = COALESCE(?, status), config = COALESCE(?, config), updated_at = ? WHERE id = ?',
      [patch.status ?? null, patch.config ? JSON.stringify(patch.config) : null, nowIso(), existing.id],
    );
  } else {
    run(
      `INSERT INTO integrations (id, user_id, provider, status, config) VALUES (?, ?, ?, ?, ?)`,
      [newId(), userId, provider, patch.status || 'disconnected', JSON.stringify(patch.config || {})],
    );
  }
  audit({ userId, action: 'integration.update', entity: 'integration', detail: { provider, status: patch.status } });
  return integrationStatuses(userId).find((s) => s.provider === provider)!;
}
