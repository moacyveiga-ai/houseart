// Admin review queue (Admin · Obras e certificados). Items are opened by the
// system (duplicates between accounts, contestation, first submission of a new
// issuer, marker removed, export restriction) and decided by staff with the
// effect written in core.ts (REVIEW_EFFECTS), shown before the confirmation.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { audit } from '@/lib/audit'
import { diaNoFuso } from '@/lib/timezone'
import { averageOpenHours, needsReason, openedAgo, REVIEW_KIND_LABELS, REVIEW_KINDS, shareLabel, type ReviewDecision, type ReviewKind } from './core'

export { REVIEW_KINDS, REVIEW_KIND_LABELS, type ReviewKind }

export async function openReviewItem(opt: { kind: ReviewKind; artworkId?: number | null; tenantId?: number | null; reason: string; refId?: number | null }) {
  return totalScope('review:open', async () => {
    // One open item per (kind, artwork) — per check for duplicates: two lookalikes are two decisions.
    const existing = await prisma.reviewQueueItem.findFirst({ where: { kind: opt.kind, artworkId: opt.artworkId ?? null, status: 'OPEN', ...(opt.kind === 'DUPLICATE' && opt.refId != null ? { refId: opt.refId } : {}) } })
    if (existing) return existing
    return prisma.reviewQueueItem.create({ data: { kind: opt.kind, artworkId: opt.artworkId ?? null, tenantId: opt.tenantId ?? null, reason: opt.reason, refId: opt.refId ?? null } })
  })
}

/** Open items — the badge of "Obras e certificados" in the admin menu. */
export async function openReviewCount(): Promise<number> {
  return totalScope('review:count', () => prisma.reviewQueueItem.count({ where: { status: 'OPEN' } }))
}

const monthName = (d: Date) => new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'America/Bahia' }).format(d)

export async function reviewQueue(now = new Date()) {
  return totalScope('review:queue', async () => {
    const month = diaNoFuso(now)!.slice(0, 7)
    const monthStart = new Date(`${month}-01T03:00:00.000Z`)
    const [items, certified, certifiedThisMonth, contested] = await Promise.all([
      prisma.reviewQueueItem.findMany({ where: { status: 'OPEN' }, orderBy: { createdAt: 'asc' }, take: 200 }),
      prisma.artwork.count({ where: { status: { in: ['AUTHENTICATED', 'LISTED', 'IN_DEAL', 'SOLD'] } } }),
      prisma.certificate.count({ where: { issuedAt: { gte: monthStart } } }),
      prisma.reviewQueueItem.count({ where: { status: 'OPEN', kind: 'CONTESTATION' } }),
    ])
    const artworks = await prisma.artwork.findMany({ where: { id: { in: items.map((i) => i.artworkId).filter((x): x is number => x !== null) } }, select: { id: true, title: true, year: true, publicId: true, artist: { select: { name: true } }, media: { where: { kind: 'FRONT_COLOR_CARD' }, select: { publicUrl: true }, take: 1 } } })
    const byId = new Map(artworks.map((a) => [a.id, a]))
    const avg = averageOpenHours(now, items.map((i) => i.createdAt))
    return {
      kpis: {
        certified, open: items.length, contested,
        certifiedNote: `+${certifiedThisMonth.toLocaleString('pt-BR')} em ${monthName(now)}`,
        openNote: avg === null ? 'fila em dia' : `tempo médio ${avg} h`,
        contestedNote: shareLabel(contested, certified),
      },
      items: items.map((i) => {
        const a = i.artworkId ? byId.get(i.artworkId) : undefined
        return {
          id: i.id, kind: i.kind as ReviewKind, reason: i.reason, createdAt: i.createdAt, ago: openedAgo(now, i.createdAt),
          artwork: a ? { id: a.id, title: a.title, year: a.year, publicId: a.publicId, artist: a.artist.name, cover: a.media[0]?.publicUrl ?? null } : null,
        }
      }),
    }
  })
}

export class ReviewDecisionError extends Error {
  constructor(message: string) { super(message); this.name = 'ReviewDecisionError' }
}

/** Decision with the effect of each kind (core.ts REVIEW_EFFECTS — the text the staff confirmed). */
export async function decideReviewItem(id: number, decision: ReviewDecision, actor: { userId: number; name: string }, note?: string | null) {
  return totalScope('review:decide', async () => {
    const item = await prisma.reviewQueueItem.findUnique({ where: { id } })
    if (!item || item.status !== 'OPEN') return null
    const kind = item.kind as ReviewKind
    const reason = note?.trim().slice(0, 500) || null
    if (needsReason(kind, decision) && !reason) throw new ReviewDecisionError('Escreva o motivo da decisão.')
    const decided = await prisma.$transaction(async (tx) => {
      // Rejecting a duplicate or a new issuer sends the work back (draft / archived): only while it is not
      // certified yet — the text the staff confirmed would be false. A certified work leaves by contestation.
      if (item.artworkId && decision === 'REJECTED' && (kind === 'DUPLICATE' || kind === 'NEW_ISSUER')) {
        await tx.$queryRaw`SELECT id FROM "Artwork" WHERE id = ${item.artworkId} FOR UPDATE`
        const a = await tx.artwork.findUnique({ where: { id: item.artworkId }, select: { status: true } })
        if (a && a.status !== 'DRAFT' && a.status !== 'IN_CERTIFICATION') throw new ReviewDecisionError('A obra já foi certificada. Para retirar o certificado, abra uma contestação.')
      }
      const r = await tx.reviewQueueItem.updateMany({ where: { id, status: 'OPEN' }, data: { status: decision, decidedByUserId: actor.userId, decidedAt: new Date(), decisionNote: reason } })
      if (r.count === 0) return null
      if (item.artworkId) {
        const artworkId = item.artworkId
        if (kind === 'DUPLICATE' && decision === 'REJECTED') {
          await tx.artwork.updateMany({ where: { id: artworkId, status: { in: ['DRAFT', 'IN_CERTIFICATION'] } }, data: { status: 'ARCHIVED', seal: 'NONE' } })
          await tx.certificate.updateMany({ where: { artworkId, issuedAt: null }, data: { signedAt: null, signedByUserId: null, signatureJson: null, timestampTokenRef: null } })
        }
        if (kind === 'CONTESTATION' && decision === 'APPROVED') {
          await tx.certificate.updateMany({ where: { artworkId }, data: { status: 'REVOKED' } })
          await tx.artwork.update({ where: { id: artworkId }, data: { status: 'DISPUTED', seal: 'NONE' } })
        }
        if (kind === 'CONTESTATION' && decision === 'REJECTED') {
          await tx.certificate.updateMany({ where: { artworkId, status: 'CONTESTED' }, data: { status: 'ACTIVE' } })
        }
        if (kind === 'NEW_ISSUER' && decision === 'REJECTED') {
          await tx.artwork.updateMany({ where: { id: artworkId, status: 'IN_CERTIFICATION' }, data: { status: 'DRAFT', seal: 'NONE' } })
          // The signature covered the content sent; the work comes back editable, so it must be signed again.
          await tx.certificate.updateMany({ where: { artworkId, issuedAt: null }, data: { signedAt: null, signedByUserId: null, signatureJson: null, timestampTokenRef: null, stage: 0 } })
        }
        if (kind === 'MARKER_REMOVED' && decision === 'APPROVED') {
          await tx.physicalMarker.updateMany({ where: { artworkId }, data: { status: 'REVOKED', artworkId: null } })
          await tx.artwork.update({ where: { id: artworkId }, data: { publicId: null, seal: 'YELLOW', status: 'IN_CERTIFICATION' } })
          await tx.certificate.updateMany({ where: { artworkId }, data: { stage: 2 } })
        }
      }
      return item
    })
    if (decided) void audit.event({ entity: 'review_item', entityId: id, action: decision.toLowerCase(), userId: actor.userId, userName: actor.name, after: { kind, artworkId: item.artworkId, note: reason } })
    return decided
  })
}
