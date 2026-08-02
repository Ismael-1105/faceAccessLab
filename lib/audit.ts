import { AuditLog } from './models.ts';

export interface AuditEntry {
  actor: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId?: string;
  details?: string;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await AuditLog.create(entry);
  } catch (e) {
    console.error('[Audit] Error registrando auditoría:', e);
  }
}

export async function getAuditLogs(limit = 50): Promise<Record<string, unknown>[]> {
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(limit);
  return logs.map(l => ({
    id: l._id,
    actor: l.actor,
    actorEmail: l.actorEmail,
    action: l.action,
    targetType: l.targetType,
    targetId: l.targetId,
    details: l.details,
    createdAt: l.createdAt,
  }));
}
