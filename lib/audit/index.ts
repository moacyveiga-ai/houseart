// AuditLog — every relevant write. Fire-and-forget but kept alive by
// `detached` so the response never cuts the insert (ported from the origin).
import { rawIpFromHeaders } from '@/lib/http/ip'
import { prisma } from '@/lib/prisma'
import { detachedSafe } from '@/lib/after'

export interface AuditActor {
  userId?: number
  userName?: string
  ip?: string
  userAgent?: string
  origin?: 'ui' | 'api' | 'job' | 'webhook' | 'public-link'
}

export interface AuditEntry extends AuditActor {
  entity: string
  entityId: string | number
  action: string
  before?: unknown
  after?: unknown
}

function serialize(value: unknown): string {
  try {
    return JSON.stringify(value, (_k, v) => (v instanceof Date ? v.toISOString() : typeof v === 'bigint' ? v.toString() : v)).slice(0, 50_000)
  } catch {
    return String(value).slice(0, 50_000)
  }
}

export function recordAudit(e: AuditEntry): Promise<void> {
  return detachedSafe(prisma.auditLog.create({
    data: {
      entity: e.entity,
      entityId: String(e.entityId),
      action: e.action,
      before: e.before !== undefined ? serialize(e.before) : null,
      after: e.after !== undefined ? serialize(e.after) : null,
      userId: e.userId ?? null,
      userName: e.userName ?? null,
      ip: e.ip ?? null,
      userAgent: e.userAgent ?? null,
      origin: e.origin ?? 'ui',
    },
  }).then(() => undefined).catch((err) => {
    console.error('[audit] falha ao gravar log:', err instanceof Error ? err.message : err)
  }))
}

export const audit = {
  create: (e: Omit<AuditEntry, 'action' | 'before'> & { after: unknown }) => recordAudit({ ...e, action: 'create' }),
  update: (e: Omit<AuditEntry, 'action'> & { before: unknown; after: unknown }) => recordAudit({ ...e, action: 'update' }),
  remove: (e: Omit<AuditEntry, 'action' | 'after'> & { before: unknown }) => recordAudit({ ...e, action: 'delete' }),
  event: (e: AuditEntry) => recordAudit(e),
}

export function requestContext(req: Request): Pick<AuditActor, 'ip' | 'userAgent'> {
  const raw = rawIpFromHeaders(req.headers)
  return { ip: raw === 'no-ip' ? undefined : raw, userAgent: req.headers.get('user-agent') ?? undefined }
}
