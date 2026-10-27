// The detail of one review item for the desk (Admin · Obras e certificados › item).
// Total scope on purpose: the house reviews works of every account.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { openedAgo, type ReviewDecision, type ReviewKind } from './core'
import { similarityLabel } from './detail-core'

const day = (d: Date | null) => (d ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Bahia' }).format(d) : null)
const when = (d: Date) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bahia' }).format(d)

export interface ReviewArtwork {
  id: number; title: string; year: number | null; publicId: string | null; artist: string; seller: string | null; cover: string | null
  status: string; seal: string
  certificate: { status: string; signedOn: string | null; issuedOn: string | null } | null
}

export type ReviewContext =
  | { kind: 'DUPLICATE'; similarity: string; checkDecision: string; other: ReviewArtwork | null }
  | { kind: 'MARKER_REMOVED'; uid: string | null; markerStatus: string | null; reads: { at: string; purpose: string; authenticated: boolean; tamper: boolean }[] }
  | { kind: 'MESSAGE_REPORT'; reporter: string | null; messages: { id: number; at: string; who: string; body: string; system: boolean }[] }
  | { kind: 'TEXT'; text: string }

export interface ReviewDetail {
  id: number; kind: ReviewKind; reason: string; openedAt: string; ago: string
  decided: { decision: ReviewDecision; by: string | null; at: string; note: string | null } | null
  artwork: ReviewArtwork | null
  context: ReviewContext
}

async function artworkOf(id: number): Promise<ReviewArtwork | null> {
  const a = await prisma.artwork.findUnique({
    where: { id },
    select: {
      id: true, title: true, year: true, publicId: true, status: true, seal: true,
      artist: { select: { name: true } }, member: { select: { displayName: true } },
      media: { where: { kind: 'FRONT_COLOR_CARD' }, select: { publicUrl: true }, take: 1 },
      certificate: { select: { status: true, signedAt: true, issuedAt: true } },
    },
  })
  if (!a) return null
  return {
    id: a.id, title: a.title, year: a.year, publicId: a.publicId, artist: a.artist.name, seller: a.member?.displayName ?? null,
    cover: a.media[0]?.publicUrl ?? null, status: a.status, seal: a.seal,
    certificate: a.certificate ? { status: a.certificate.status, signedOn: day(a.certificate.signedAt), issuedOn: day(a.certificate.issuedAt) } : null,
  }
}

const nameOf = async (ids: number[]) => new Map((ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : []).map((u) => [u.id, u.name]))

export async function reviewItemDetail(id: number, now = new Date()): Promise<ReviewDetail | null> {
  return totalScope('review:detail', async () => {
    const item = await prisma.reviewQueueItem.findUnique({ where: { id } })
    if (!item) return null
    const kind = item.kind as ReviewKind
    const artwork = item.artworkId ? await artworkOf(item.artworkId) : null
    let context: ReviewContext = { kind: 'TEXT', text: item.reason }
    if (kind === 'DUPLICATE' && item.refId) {
      const check = await prisma.duplicateCheck.findUnique({ where: { id: item.refId }, select: { similarityBps: true, decision: true, candidateArtworkId: true } })
      if (check) context = { kind: 'DUPLICATE', similarity: similarityLabel(check.similarityBps), checkDecision: check.decision, other: await artworkOf(check.candidateArtworkId) }
    }
    if (kind === 'MARKER_REMOVED' && item.artworkId) {
      // after an approval the tag is unlinked from the work: the reads go with it
      const marker = await prisma.physicalMarker.findFirst({ where: { artworkId: item.artworkId }, select: { uid: true, status: true, reads: { orderBy: { createdAt: 'desc' }, take: 10, select: { createdAt: true, purpose: true, cmacValid: true, tamperFlag: true } } } })
      context = { kind: 'MARKER_REMOVED', uid: marker?.uid ?? null, markerStatus: marker?.status ?? null, reads: (marker?.reads ?? []).map((r) => ({ at: when(r.createdAt), purpose: r.purpose, authenticated: r.cmacValid, tamper: r.tamperFlag })) }
    }
    if (kind === 'MESSAGE_REPORT' && item.refId) {
      const messages = (await prisma.message.findMany({ where: { conversationId: item.refId }, orderBy: { id: 'desc' }, take: 20, select: { id: true, createdAt: true, senderUserId: true, kind: true, body: true } })).reverse()
      const names = await nameOf([...new Set([...messages.map((m) => m.senderUserId), item.reporterUserId].filter((x): x is number => x !== null))])
      context = { kind: 'MESSAGE_REPORT', reporter: item.reporterUserId ? names.get(item.reporterUserId) ?? null : null, messages: messages.map((m) => ({ id: m.id, at: when(m.createdAt), who: m.senderUserId ? names.get(m.senderUserId) ?? 'Conta removida' : 'HouseArt', body: m.body, system: m.senderUserId === null })) }
    }
    const decider = item.decidedByUserId ? (await nameOf([item.decidedByUserId])).get(item.decidedByUserId) ?? null : null
    return {
      id: item.id, kind, reason: item.reason, openedAt: when(item.createdAt), ago: openedAgo(now, item.createdAt),
      decided: item.status === 'APPROVED' || item.status === 'REJECTED' ? { decision: item.status as ReviewDecision, by: decider, at: item.decidedAt ? when(item.decidedAt) : '', note: item.decisionNote } : null,
      artwork, context,
    }
  })
}
