import { all, newId, run } from '@/lib/db';

export type AuditAction =
  | 'auth.register'
  | 'auth.login'
  | 'auth.logout'
  | 'auth.password_change'
  | 'auth.session_revoke'
  | 'data.create'
  | 'data.update'
  | 'data.delete'
  | 'data.export'
  | 'data.purge'
  | 'assistant.tool'
  | 'assistant.approval'
  | 'settings.update'
  | 'integration.update';

export interface AuditEntry {
  userId: string | null;
  action: AuditAction | string;
  entity?: string;
  entityId?: string | null;
  detail?: unknown;
  ip?: string | null;
}

/** Registro de auditoría. Nunca lanza: la auditoría no debe romper la operación. */
export function audit(entry: AuditEntry): void {
  try {
    run(
      `INSERT INTO audit_logs (id, user_id, action, entity, entity_id, detail, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        entry.userId,
        entry.action,
        entry.entity ?? null,
        entry.entityId ?? null,
        entry.detail ? JSON.stringify(entry.detail) : null,
        entry.ip ?? null,
      ],
    );
  } catch (err) {
    console.error('[audit] fallo al registrar:', err);
  }
}

export interface AuditRow {
  id: string;
  user_id: string;
  action: string;
  entity: string | null;
  entity_id: string | null;
  detail: string | null;
  ip: string | null;
  created_at: string;
}

export function listAudit(userId: string, limit = 100): AuditRow[] {
  return all<AuditRow>(
    `SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    [userId, limit],
  );
}
