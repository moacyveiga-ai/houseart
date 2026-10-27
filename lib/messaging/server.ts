// Messaging — I/O. A conversation is one row per (pair of users, artwork);
// the other side of an artwork is the member's login (or the gallery admin).
// System lines (offer sent / countered / accepted) are appended by the offer
// flow through `systemLine`, never by the people.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { notify } from '@/lib/notifications/server'
import { ArtworkError } from '@/lib/artworks/server'
import { formatBRL } from '@/lib/artworks/domain'
import { openReviewItem } from '@/lib/admin-review/server'
import sharp from 'sharp'
import { contentTypeOf } from '@/lib/storage/content-type'
import { savePrivateFile } from '@/lib/storage/private-vault'
import { CONTENT_IMAGE_MAX_SIDE, contentImageVerdict } from '@/lib/public-content/editor-core'
import { PHOTO_BODY, checkMessage, isReportReason, otherOf, pairOf, previewOf, redactContacts, REPORT_NOTE_MAX, reportReasonLabel, sideOfConversation, verifiedByHouse, whenLabel, type MessageKind } from './core'

export interface ConversationRow {
  id: number; artworkId: number | null; artworkTitle: string | null; artworkPublicId: string | null; artworkCoverUrl: string | null
  other: { id: number; name: string; initials: string; sub: string; verified?: boolean }; preview: string; when: string; unread: number
  /** only on the open conversation: my side of the counter, the asking price and whether "Ofertar" applies */
  myRole?: 'buyer' | 'seller'; artworkPrice?: string | null; canOffer?: boolean
}
export interface MessageRow { id: number; mine: boolean; kind: MessageKind; body: string; at: string; offerId: number | null
  /** kind IMAGE: the scoped route that streams the photo (only the two participants); never the vault ref. */
  imageUrl?: string | null }

const photoUrl = (conversationId: number, messageId: number) => `/api/messages/${conversationId}/photos/${messageId}`

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?'

/** The login that answers for an artwork: the member's user, else an admin of its tenant. */
export async function counterpartOfArtwork(artworkId: number): Promise<{ userId: number; label: string } | null> {
  const a = await prisma.artwork.findUnique({ where: { id: artworkId }, select: { memberId: true } })
  return a ? counterpartOfMember(a.memberId) : null
}

/** Who answers for a member: its own login, or the tenant's first active ADMIN (a gallery member without a login). */
export async function counterpartOfMember(memberId: number): Promise<{ userId: number; label: string } | null> {
  const m = await prisma.member.findUnique({ where: { id: memberId }, select: { userId: true, displayName: true, tenantId: true, user: { select: { active: true } } } })
  if (!m) return null
  // a member whose own login is blocked answers through the tenant's admin, never into an unread inbox
  if (m.userId && m.user?.active) return { userId: m.userId, label: m.displayName }
  const admin = await prisma.user.findFirst({ where: { tenantId: m.tenantId, tenantRole: 'ADMIN', active: true }, select: { id: true }, orderBy: { id: 'asc' } })
  return admin ? { userId: admin.id, label: m.displayName } : null
}

async function subOf(userId: number): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { member: { select: { kind: true, displayName: true, city: true } } } })
  if (u?.member) return u.member.kind === 'GALLERY_STAFF' ? 'Galeria' : u.member.kind === 'ARTIST' ? 'Artista' : u.member.kind === 'COLLECTOR' ? 'Colecionador' : 'Consultor'
  return 'Colecionador'
}

/** Opens (or finds) the conversation between `me` and the other side of the artwork. */
export async function openConversation(me: number, artworkId: number | null, otherUserId?: number): Promise<number> {
  let other: number | null = null
  if (artworkId != null) { const c = await counterpartOfArtwork(artworkId); other = c?.userId ?? null }
  else if (otherUserId != null) {
    // A direct conversation only with someone who answers for artworks (a member) — never collector ↔ collector by id.
    const u = await prisma.user.findFirst({ where: { id: otherUserId, active: true, member: { status: 'ACTIVE' } }, select: { id: true } })
    other = u?.id ?? null
  }
  if (other == null) throw new ArtworkError('NO_COUNTERPART', artworkId != null ? 'Esta obra ainda não tem quem responda por ela.' : 'Pessoa não encontrada.', 404)
  return openConversationWith(me, other, artworkId)
}

/** "Falar com a galeria" of the public gallery page: the conversation (no artwork) with who answers for the
 *  gallery — its first active team member's login, else the tenant's first active ADMIN. Only an ACTIVE gallery. */
export async function openGalleryConversation(me: number, slug: string): Promise<number> {
  const g = await prisma.galleryPublicProfile.findUnique({ where: { slug }, select: { tenantId: true, tenant: { select: { status: true } } } })
  if (!g || g.tenant.status !== 'ACTIVE') throw new ArtworkError('NOT_FOUND', 'Galeria não encontrada.', 404)
  const desk = await prisma.member.findFirst({ where: { tenantId: g.tenantId, kind: 'GALLERY_STAFF', status: 'ACTIVE' }, orderBy: { id: 'asc' }, select: { id: true } })
  const c = desk ? await counterpartOfMember(desk.id) : null
  if (!c) throw new ArtworkError('NO_COUNTERPART', 'A galeria ainda não tem quem responda pela HouseArt.', 404)
  return openConversationWith(me, c.userId, null)
}

/** The row between two KNOWN users about an artwork — only for callers that already authorized the pair
 *  (the seller answering an offer talks to its proponent). */
export async function openConversationWith(me: number, other: number, artworkId: number | null): Promise<number> {
  if (other === me) throw new ArtworkError('SELF', 'Você não pode conversar com você mesmo.', 400)
  const pair = pairOf(me, other)
  return prisma.$transaction(async (tx) => {
    // One row per pair (+ artwork): the unique index does not cover artworkId NULL, so the pair is serialized here.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`conv:${pair.userAId}:${pair.userBId}:${artworkId ?? 0}`}))`
    const found = await tx.conversation.findFirst({ where: { ...pair, artworkId }, select: { id: true } })
    if (found) return found.id
    const c = await tx.conversation.create({ data: { ...pair, artworkId, participants: { create: [{ userId: me }, { userId: other }] } } })
    return c.id
  })
}

export async function listConversations(me: number, q?: string | null): Promise<ConversationRow[]> {
  const rows = await prisma.conversation.findMany({
    where: { OR: [{ userAId: me }, { userBId: me }], lastMessageAt: { not: null } },
    orderBy: { lastMessageAt: 'desc' }, take: 100,
    include: { participants: { where: { userId: me } } },
  })
  const otherIds = [...new Set(rows.map((r) => otherOf(r, me)))]
  const users = otherIds.length ? await prisma.user.findMany({ where: { id: { in: otherIds } }, select: { id: true, name: true, member: { select: { kind: true, displayName: true } } } }) : []
  const artIds = [...new Set(rows.map((r) => r.artworkId).filter((v): v is number => v != null))]
  const arts = artIds.length ? await prisma.artwork.findMany({ where: { id: { in: artIds } }, select: { id: true, title: true, publicId: true, coverMediaId: true, media: { where: { kind: 'FRONT_COLOR_CARD' }, select: { publicUrl: true }, take: 1 } } }) : []
  const byUser = new Map(users.map((u) => [u.id, u])); const byArt = new Map(arts.map((a) => [a.id, a]))
  const out: ConversationRow[] = []
  for (const r of rows) {
    const u = byUser.get(otherOf(r, me)); if (!u) continue
    const a = r.artworkId ? byArt.get(r.artworkId) : null
    const name = u.member?.displayName ?? u.name
    const row: ConversationRow = {
      id: r.id, artworkId: r.artworkId, artworkTitle: a?.title ?? null, artworkPublicId: a?.publicId ?? null, artworkCoverUrl: a?.media[0]?.publicUrl ?? null,
      other: { id: u.id, name, initials: initials(name), sub: u.member ? (u.member.kind === 'GALLERY_STAFF' ? 'Galeria' : u.member.kind === 'ARTIST' ? 'Artista' : u.member.kind === 'COLLECTOR' ? 'Colecionador' : 'Consultor') : 'Colecionador' },
      preview: r.lastPreview ?? '', when: r.lastMessageAt ? whenLabel(r.lastMessageAt) : '', unread: r.participants[0]?.unread ?? 0,
    }
    if (q && !`${row.other.name} ${row.artworkTitle ?? ''}`.toLowerCase().includes(q.toLowerCase())) continue
    out.push(row)
  }
  return out
}

export async function unreadMessages(me: number): Promise<number> {
  const r = await prisma.conversationParticipant.aggregate({ where: { userId: me, unread: { gt: 0 } }, _sum: { unread: true } })
  return r._sum.unread ?? 0
}

/**
 * Conversations waiting on me: the last line is a person's message from the other side (system
 * lines do not count). Who is waiting, by name, newest first — for the gallery's "Precisa de você".
 */
export async function unansweredConversations(me: number, take = 20): Promise<{ id: number; name: string }[]> {
  const rows = await prisma.conversation.findMany({ where: { OR: [{ userAId: me }, { userBId: me }], lastMessageAt: { not: null } }, orderBy: { lastMessageAt: 'desc' }, take: 50, select: { id: true, userAId: true, userBId: true } })
  if (!rows.length) return []
  const last = await prisma.message.findMany({ where: { conversationId: { in: rows.map((r) => r.id) } }, orderBy: [{ conversationId: 'asc' }, { id: 'desc' }], distinct: ['conversationId'], select: { conversationId: true, senderUserId: true, kind: true } })
  const waiting = new Set(last.filter((m) => (m.kind === 'TEXT' || m.kind === 'IMAGE') && m.senderUserId != null && m.senderUserId !== me).map((m) => m.conversationId))
  const out = rows.filter((r) => waiting.has(r.id)).slice(0, take)
  const users = out.length ? await prisma.user.findMany({ where: { id: { in: out.map((r) => otherOf(r, me)) } }, select: { id: true, name: true, member: { select: { displayName: true } } } }) : []
  const byUser = new Map(users.map((u) => [u.id, u.member?.displayName ?? u.name]))
  return out.map((r) => ({ id: r.id, name: byUser.get(otherOf(r, me)) ?? 'Alguém' }))
}

async function requireParticipant(me: number, conversationId: number) {
  const c = await prisma.conversation.findUnique({ where: { id: conversationId }, include: { participants: true } })
  if (!c || !c.participants.some((p) => p.userId === me)) throw new ArtworkError('NOT_FOUND', 'Conversa não encontrada.', 404)
  return c
}

export async function readConversation(me: number, conversationId: number, afterId = 0): Promise<{ header: ConversationRow; messages: MessageRow[] }> {
  const c = await requireParticipant(me, conversationId)
  const other = otherOf(c, me)
  const u = await prisma.user.findUniqueOrThrow({ where: { id: other }, select: { id: true, name: true, collectorVerifiedAt: true, emailVerifiedAt: true, phoneVerifiedAt: true, member: { select: { displayName: true, kind: true, status: true, approvedAt: true } } } })
  const meRow = await prisma.user.findUniqueOrThrow({ where: { id: me }, select: { tenantId: true, member: { select: { kind: true } } } })
  const a = c.artworkId ? await prisma.artwork.findUnique({ where: { id: c.artworkId }, select: { title: true, publicId: true, status: true, seal: true, saleMode: true, listPriceCents: true, listingPausedAt: true, member: { select: { userId: true, tenantId: true } }, media: { where: { kind: 'FRONT_COLOR_CARD' }, select: { publicUrl: true }, take: 1 } } }) : null
  // the artwork's member lost its login (SetNull): the tenant ADMIN answers for it, as in counterpartOfArtwork
  const answerer = a ? a.member.userId ?? (await prisma.user.findFirst({ where: { tenantId: a.member.tenantId, tenantRole: 'ADMIN', active: true }, select: { id: true }, orderBy: { id: 'asc' } }))?.id ?? null : null
  const myRole = a ? sideOfConversation({ artworkMemberUserId: answerer, artworkTenantId: a.member.tenantId, me, myTenantId: meRow.tenantId, myMemberKind: meRow.member?.kind ?? null }) : undefined
  const listed = !!a && a.status === 'LISTED' && a.seal === 'GREEN' && !!a.publicId && !a.listingPausedAt
  const artworkPrice = !listed ? null : a!.saleMode === 'ON_REQUEST' || a!.listPriceCents === null ? 'Sob consulta' : formatBRL(a!.listPriceCents)
  const msgs = await prisma.message.findMany({ where: { conversationId, id: { gt: afterId } }, orderBy: { id: 'asc' }, take: 200 })
  await prisma.conversationParticipant.updateMany({ where: { conversationId, userId: me }, data: { unread: 0, lastReadAt: new Date() } })
  const name = u.member?.displayName ?? u.name
  return {
    header: { id: c.id, artworkId: c.artworkId, artworkTitle: a?.title ?? null, artworkPublicId: a?.publicId ?? null, artworkCoverUrl: a?.media[0]?.publicUrl ?? null, other: { id: u.id, name, initials: initials(name), sub: await subOf(u.id), verified: verifiedByHouse({ memberStatus: u.member?.status ?? null, memberApprovedAt: u.member?.approvedAt ?? null, collectorVerifiedAt: u.collectorVerifiedAt, emailVerifiedAt: u.emailVerifiedAt, phoneVerifiedAt: u.phoneVerifiedAt }) }, preview: c.lastPreview ?? '', when: c.lastMessageAt ? whenLabel(c.lastMessageAt) : '', unread: 0,
      myRole, artworkPrice, canOffer: listed && myRole === 'buyer' && a!.saleMode === 'FIXED_WITH_OFFERS' },
    messages: msgs.map((m) => ({ id: m.id, mine: m.senderUserId === me, kind: m.kind as MessageKind, body: m.body, at: m.createdAt.toISOString(), offerId: m.offerId, imageUrl: m.kind === 'IMAGE' && m.imageRef ? photoUrl(conversationId, m.id) : null })),
  }
}

async function append(conversationId: number, sender: number | null, kind: MessageKind, body: string, offerId: number | null, imageRef: string | null = null): Promise<MessageRow> {
  const c = await prisma.conversation.findUniqueOrThrow({ where: { id: conversationId } })
  const m = await prisma.$transaction(async (tx) => {
    const row = await tx.message.create({ data: { conversationId, senderUserId: sender, kind, body, offerId, imageRef } })
    await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: row.createdAt, lastPreview: previewOf(body, false, kind) } })
    await tx.conversationParticipant.updateMany({ where: { conversationId, userId: sender == null ? undefined : { not: sender } }, data: { unread: { increment: 1 } } })
    return row
  })
  // A system line only updates the thread: the offer flow already sends its own aviso to each side.
  if (sender != null) {
    const sName = await prisma.user.findUnique({ where: { id: sender }, select: { name: true, member: { select: { displayName: true } } } })
    await notify({ userId: otherOf(c, sender), kind: 'message.received', title: `Mensagem de ${sName?.member?.displayName ?? sName?.name ?? 'alguém'}`, body: body.slice(0, 120), href: `/messages/${conversationId}` })
  }
  return { id: m.id, mine: false, kind, body, at: m.createdAt.toISOString(), offerId, imageUrl: imageRef ? photoUrl(conversationId, m.id) : null }
}

export async function sendMessage(me: number, conversationId: number, raw: unknown): Promise<MessageRow> {
  await requireParticipant(me, conversationId)
  const chk = checkMessage(raw)
  if (!chk.ok) throw new ArtworkError(chk.code, chk.error, 422)
  const m = await append(conversationId, me, 'TEXT', chk.body, null)
  return { ...m, mine: true }
}

/**
 * "Enviar foto" (the camera button of the composer): the bytes are checked (JPEG, PNG or WebP, up to
 * 10 MB), re-encoded (≤ 2048 px JPEG, EXIF and GPS dropped) and kept in the PRIVATE vault — a photo of a
 * collection is not public content. The line carries "Foto" for the preview and the push.
 */
/** a 10 MB PNG can decode to hundreds of MB: anything above 40 MP is refused before decoding */
const PHOTO_MAX_PIXELS = 40_000_000

export async function sendPhoto(me: number, conversationId: number, bytes: Buffer): Promise<MessageRow> {
  await requireParticipant(me, conversationId)
  const type = contentTypeOf(bytes.subarray(0, 32), null)
  const v = contentImageVerdict(type, bytes.length)
  if (!v.ok) throw new ArtworkError('INVALID_FILE', v.error, v.status)
  let out: Buffer
  try {
    out = await sharp(bytes, { failOn: 'error', limitInputPixels: PHOTO_MAX_PIXELS }).rotate()
      .resize({ width: CONTENT_IMAGE_MAX_SIDE, height: CONTENT_IMAGE_MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' }).jpeg({ quality: 85 }).toBuffer()
  } catch { throw new ArtworkError('INVALID_FILE', 'Imagem ilegível.', 415) }
  const ref = await savePrivateFile({ buffer: out, contentType: 'image/jpeg', prefix: `messages/${conversationId}` })
  const m = await append(conversationId, me, 'IMAGE', PHOTO_BODY, null, ref)
  return { ...m, mine: true }
}

/** The photo of a message, for one of the two participants only (404 for anyone else or any other line). */
export async function photoOf(me: number, conversationId: number, messageId: number): Promise<string | null> {
  await requireParticipant(me, conversationId)
  const m = await prisma.message.findFirst({ where: { id: messageId, conversationId, kind: 'IMAGE' }, select: { imageRef: true } })
  return m?.imageRef ?? null
}

/** A system line in the conversation of the offer's buyer and seller (best-effort; a buyer without login has no conversation). */
export async function systemLine(opts: { buyerUserId: number | null; artworkId: number; kind: 'OFFER' | 'COUNTER' | 'SYSTEM'; body: string; offerId?: number }): Promise<void> {
  if (!opts.buyerUserId) return
  try {
    const id = await openConversation(opts.buyerUserId, opts.artworkId)
    await append(id, null, opts.kind, opts.body, opts.offerId ?? null)
  } catch (e) { console.warn('[messaging] system line skipped', (e as Error).name) }
}

/** Denunciar: the person flags the OTHER side of a conversation; it goes to the staff review queue
 *  (one open report per conversation). Only the reason, the note and who is who — never the messages. */
export async function reportConversation(me: number, conversationId: number, raw: { reason?: unknown; note?: unknown }): Promise<{ id: number }> {
  const c = await requireParticipant(me, conversationId)
  if (!isReportReason(raw.reason)) throw new ArtworkError('BAD_REASON', 'Escolha o motivo da denúncia.', 422)
  const note = typeof raw.note === 'string' ? redactContacts(raw.note.replace(/\s+/g, ' ').trim()).slice(0, REPORT_NOTE_MAX) : ''
  const otherId = otherOf(c, me)
  const [reporter, reported] = await Promise.all([
    prisma.user.findUnique({ where: { id: me }, select: { name: true } }),
    prisma.user.findUnique({ where: { id: otherId }, select: { name: true, tenantId: true, member: { select: { displayName: true } } } }),
  ])
  const reason = [
    reportReasonLabel(raw.reason),
    `denunciado: ${reported?.member?.displayName ?? reported?.name ?? `#${otherId}`} (conta #${otherId})`,
    `por: ${reporter?.name ?? `#${me}`} (conta #${me})`,
    `conversa #${conversationId}`,
    note ? `“${note}”` : null,
  ].filter(Boolean).join(' · ')
  const item = await openReviewItem({ kind: 'MESSAGE_REPORT', artworkId: c.artworkId, tenantId: reported?.tenantId ?? null, reason, refId: conversationId, reporterUserId: me })
  return { id: item.id }
}
