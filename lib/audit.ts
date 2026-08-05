import { AuditLog } from './models.ts';

export interface AuditEntry {
  actor: string;
  actorEmail: string;
  /** Rol del usuario que ejecutó la acción (admin | docente). */
  actorRole?: string;
  action: string;
  targetType: string;
  targetId?: string;
  details?: string;
  ip?: string;
  userAgent?: string;
  before?: string;
  after?: string;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await AuditLog.create(entry);
  } catch (e) {
    console.error('[Audit] Error registrando auditoría:', e);
  }
}

function mapAuditLog(l: InstanceType<typeof AuditLog>): Record<string, unknown> {
  return {
    id: l._id,
    actor: l.actor,
    actorEmail: l.actorEmail,
    actorRole: l.actorRole,
    action: l.action,
    targetType: l.targetType,
    targetId: l.targetId,
    details: l.details,
    ip: l.ip,
    userAgent: l.userAgent,
    before: l.before,
    after: l.after,
    createdAt: l.createdAt,
  };
}

export interface AuditPage {
  logs: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

/**
 * Página de auditoría consultada en la base de datos (no todo el historial en
 * memoria). El buscador opcional filtra por correo, actor, acción o detalle.
 */
export async function getAuditLogsPage(page = 1, pageSize = 10, search = ''): Promise<AuditPage> {
  const filter = search
    ? {
        $or: [
          { actorEmail: { $regex: search, $options: 'i' } },
          { actor: { $regex: search, $options: 'i' } },
          { action: { $regex: search, $options: 'i' } },
          { details: { $regex: search, $options: 'i' } },
        ],
      }
    : {};

  const [total, docs] = await Promise.all([
    AuditLog.countDocuments(filter),
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return {
    logs: docs.map(mapAuditLog),
    total,
    page,
    pageSize,
    totalPages,
    hasMore: page < totalPages,
  };
}

/** Extrae la IP del cliente desde cabeceras estándar (proxy/Nginx/CloudFront). */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'desconocida';
}

export function getUserAgent(req: Request): string {
  return req.headers.get('user-agent') || 'desconocido';
}
