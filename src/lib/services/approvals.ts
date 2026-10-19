import { all, newId, nowIso, one, run } from '@/lib/db';
import { badRequest, notFound } from '@/lib/api/errors';
import { audit } from './audit';
import { executeApprovedTool, type ToolContext } from './tools';
import { loadSettings } from '@/lib/auth/session';

export interface ApprovalRow {
  id: string;
  user_id: string;
  tool_run_id: string;
  tool_name: string;
  summary: string;
  input: string;
  risk_level: number;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  requested_at: string;
  decided_at: string | null;
}

export function listApprovals(userId: string, status = 'pending'): ApprovalRow[] {
  return all<ApprovalRow>(
    'SELECT * FROM approvals WHERE user_id = ? AND status = ? ORDER BY requested_at DESC LIMIT 100',
    [userId, status],
  );
}

export function getApproval(userId: string, id: string): ApprovalRow {
  const row = one<ApprovalRow>('SELECT * FROM approvals WHERE id = ? AND user_id = ?', [id, userId]);
  if (!row) throw notFound('Aprobación no encontrada.');
  return row;
}

export function pendingApprovalsCount(userId: string): number {
  const row = one<{ c: number }>(
    `SELECT COUNT(*) AS c FROM approvals WHERE user_id = ? AND status = 'pending'`,
    [userId],
  );
  return Number(row?.c ?? 0);
}

/**
 * Aprueba y ejecuta la acción pendiente. Solo el propietario puede hacerlo.
 * La ejecución se registra en `assistant_tool_runs` (auditoría real).
 */
export async function decideApproval(
  userId: string,
  id: string,
  decision: 'approve' | 'reject',
  ip?: string | null,
): Promise<{ status: string; message: string }> {
  const approval = getApproval(userId, id);
  if (approval.status !== 'pending') {
    throw badRequest(`Esta aprobación ya fue ${approval.status === 'approved' ? 'aprobada' : 'rechazada'}.`);
  }

  const runRow = one<{ id: string; conversation_id: string | null }>(
    'SELECT id, conversation_id FROM assistant_tool_runs WHERE id = ? AND user_id = ?',
    [approval.tool_run_id, userId],
  );
  if (!runRow) throw notFound('Ejecución asociada no encontrada.');

  if (decision === 'reject') {
    run('UPDATE approvals SET status = ?, decided_at = ? WHERE id = ?', ['rejected', nowIso(), id]);
    run('UPDATE assistant_tool_runs SET status = ?, error = ?, finished_at = ? WHERE id = ?', [
      'rejected',
      'Rechazada por el usuario',
      nowIso(),
      approval.tool_run_id,
    ]);
    audit({ userId, action: 'assistant.approval', entity: 'approval', entityId: id, detail: { decision: 'reject' }, ip });
    return { status: 'rejected', message: 'Acción rechazada. No se ejecutó ningún cambio.' };
  }

  const settings = loadSettings(userId);
  const ctx: ToolContext = {
    userId,
    conversationId: runRow.conversation_id,
    ip: ip ?? null,
    tz: settings?.timezone || 'America/Monterrey',
    source: 'dashboard',
  };
  const args = JSON.parse(approval.input || '{}') as Record<string, unknown>;
  const result = await executeApprovedTool(ctx, approval.tool_name, args, approval.tool_run_id);

  run('UPDATE approvals SET status = ?, decided_at = ? WHERE id = ?', [
    result.status === 'success' ? 'approved' : 'pending',
    nowIso(),
    id,
  ]);
  audit({
    userId,
    action: 'assistant.approval',
    entity: 'approval',
    entityId: id,
    detail: { decision: 'approve', result: result.status },
    ip,
  });

  if (result.status === 'error') {
    return { status: 'error', message: `No se pudo ejecutar: ${result.error}` };
  }
  return { status: 'executed', message: result.summary };
}

export function expireStaleApprovals(userId: string, hours = 72): number {
  const res = run(
    `UPDATE approvals SET status = 'expired', decided_at = ?
     WHERE user_id = ? AND status = 'pending' AND requested_at < ?`,
    [nowIso(), userId, new Date(Date.now() - hours * 3600000).toISOString()],
  );
  return res.changes;
}

export function newApprovalId(): string {
  return newId();
}
