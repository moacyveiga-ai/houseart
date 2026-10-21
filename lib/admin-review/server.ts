// Admin review queue (Admin · Obras e certificados). Items are opened by the
// system (duplicates, contestation, new issuer, marker removed, export
// restriction) and decided by staff with an effect per kind.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { audit } from '@/lib/audit'

export const REVIEW_KINDS = ['DUPLICATE', 'CONTESTATION', 'NEW_ISSUER', 'MARKER_REMOVED', 'EXPORT_RESTRICTION'] as const
export type ReviewKind = (typeof REVIEW_KINDS)[number]
export const REVIEW_KIND_LABELS: Record<ReviewKind, string> = {
  DUPLICATE: 'Duplicidade', CONTESTATION: 'Contestação', NEW_ISSUER: 'Emissor novo', MARKER_REMOVED: 'Etiqueta removida', EXPORT_RESTRICTION: 'Restrição IPHAN',
}

export async function openReviewItem(opt: { kind: ReviewKind; artworkId?: number | null; tenantId?: number | null; reason: string; refId?: number | null }) {
  return totalScope('review:open', async () => {
    const existing = await prisma.reviewQueueItem.findFirst({ where: { kind: opt.kind, artworkId: opt.artworkId ?? null, status: 'OPEN' } })
    if (existing) return existing
    return prisma.reviewQueueItem.create({ data: { kind: opt.kind, artworkId: opt.artworkId ?? null, tenantId: opt.tenantId ?? null, reason: opt.reason, refId: opt.refId ?? null } })
  })
}

export async function reviewQueue() {
  return totalScope('review:queue', async () => {
    const [items, certified, open, contested] = await Promise.all([
      prisma.reviewQueueItem.findMany({ where: { status: 'OPEN' }, orderBy: { createdAt: 'asc' }, take: 200 }),
      prisma.artwork.count({ where: { status: { in: ['AUTHENTICATED', 'LISTED', 'IN_DEAL', 'SOLD'] } } }),
      prisma.reviewQueueItem.count({ where: { status: 'OPEN' } }),
      prisma.reviewQueueItem.count({ where: { status: 'OPEN', kind: 'CONTESTATION' } }),
    ])
    const artworks = await prisma.artwork.findMany({ where: { id: { in: items.map((i) => i.artworkId).filter((x): x is number => x !== null) } }, select: { id: true, title: true, year: true, artist: { select: { name: true } }, media: { where: { kind: 'FRONT_COLOR_CARD' }, select: { publicUrl: true }, take: 1 } } })
    const byId = new Map(artworks.map((a) => [a.id, a]))
    return {
      kpis: { certified, open, contested },
      items: items.map((i) => {
        const a = i.artworkId ? byId.get(i.artworkId) : undefined
        return { id: i.id, kind: i.kind as ReviewKind, reason: i.reason, createdAt: i.createdAt, artwork: a ? { id: a.id, title: `${a.title}${a.year ? `, ${a.year}` : ''}`, artist: a.artist.name, cover: a.media[0]?.publicUrl ?? null } : null }
      }),
    }
  })
}

/** Decision with the effect of each kind (HOUSEART_BUILD.md §E.11). */
export async function decideReviewItem(id: number, decision: 'APPROVED' | 'REJECTED', actor: { userId: number; name: string }) {
  return totalScope('review:decide', async () => {
    const item = await prisma.reviewQueueItem.findUnique({ where: { id } })
    if (!item || item.status !== 'OPEN') return null
    const r = await prisma.reviewQueueItem.updateMany({ where: { id, status: 'OPEN' }, data: { status: decision, decidedByUserId: actor.userId, decidedAt: new Date() } })
    if (r.count === 0) return null
    if (item.artworkId) {
      if (item.kind === 'DUPLICATE' && decision === 'REJECTED') {
        await prisma.artwork.updateMany({ where: { id: item.artworkId, status: { in: ['DRAFT', 'IN_CERTIFICATION'] } }, data: { status: 'ARCHIVED' } })
      }
      if (item.kind === 'CONTESTATION' && decision === 'APPROVED') {
        await prisma.certificate.updateMany({ where: { artworkId: item.artworkId }, data: { status: 'REVOKED' } })
        await prisma.artwork.update({ where: { id: item.artworkId }, data: { status: 'DISPUTED', seal: 'NONE' } })
      }
      if (item.kind === 'CONTESTATION' && decision === 'REJECTED') {
        await prisma.certificate.updateMany({ where: { artworkId: item.artworkId, status: 'CONTESTED' }, data: { status: 'ACTIVE' } })
      }
      if (item.kind === 'MARKER_REMOVED' && decision === 'APPROVED') {
        await prisma.physicalMarker.updateMany({ where: { artworkId: item.artworkId }, data: { status: 'REVOKED', artworkId: null } })
        await prisma.artwork.update({ where: { id: item.artworkId }, data: { publicId: null, seal: 'YELLOW', status: 'IN_CERTIFICATION' } })
        await prisma.certificate.updateMany({ where: { artworkId: item.artworkId }, data: { stage: 2 } })
      }
    }
    void audit.event({ entity: 'review_item', entityId: id, action: decision.toLowerCase(), userId: actor.userId, userName: actor.name, after: { kind: item.kind, artworkId: item.artworkId } })
    return item
  })
}
