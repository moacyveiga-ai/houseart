// Admin › Auditoria — I/O, read-only: a page of the trail with the filters, and the counts of
// the last day and week. The desk never writes here; the rows are what the writers recorded.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { ACTION_LABELS, compact, ENTITY_LABELS, hrefOf, ORIGIN_LABELS, PAGE_SIZE, rangeOf, type AuditPage, type AuditQuery } from './core'

export async function adminAudit(q: AuditQuery, now = new Date()): Promise<AuditPage> {
  return totalScope('admin:audit', async () => {
    const range = rangeOf(q, now)
    const where = {
      ...(q.entity ? { entity: q.entity } : {}),
      ...(q.entityId ? { entityId: q.entityId } : {}),
      ...(q.action ? { action: q.action } : {}),
      ...(q.who ? (/^#?\d+$/.test(q.who) ? { userId: Number(q.who.replace('#', '')) } : { userName: { contains: q.who, mode: 'insensitive' as const } }) : {}),
      ...(range.from || range.to ? { createdAt: { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) } } : {}),
    }
    const dayAgo = new Date(now.getTime() - 86_400_000), weekAgo = new Date(now.getTime() - 7 * 86_400_000)
    const [total, rows, today, week, byEntity] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({ where, orderBy: { id: 'desc' }, skip: (q.page - 1) * PAGE_SIZE, take: PAGE_SIZE, select: { id: true, createdAt: true, entity: true, entityId: true, action: true, userName: true, userId: true, origin: true, ip: true, before: true, after: true } }),
      prisma.auditLog.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.auditLog.groupBy({ by: ['entity'], where: { createdAt: { gte: weekAgo } }, _count: { _all: true }, orderBy: { _count: { entity: 'desc' } }, take: 5 }),
    ])
    return {
      total, page: q.page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)), cut: range.cut,
      rows: rows.map((r) => ({
        id: r.id, at: r.createdAt.toISOString(), entity: r.entity, entityLabel: ENTITY_LABELS[r.entity] ?? r.entity, entityId: r.entityId,
        action: r.action, actionLabel: ACTION_LABELS[r.action] ?? r.action, who: r.userName, whoId: r.userId, origin: r.origin, originLabel: ORIGIN_LABELS[r.origin] ?? r.origin, ip: r.ip,
        before: compact(r.before), after: compact(r.after), href: hrefOf(r.entity, r.entityId),
      })),
      kpis: { today, week, entities: byEntity.map((e) => ({ entity: e.entity, label: ENTITY_LABELS[e.entity] ?? e.entity, count: e._count._all })) },
    }
  })
}
