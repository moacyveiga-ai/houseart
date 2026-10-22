// Messaging — I/O. A conversation is one row per (pair of users, artwork);
// the other side of an artwork is the member's login (or the gallery admin).
// System lines (offer sent / countered / accepted) are appended by the offer
// flow through `systemLine`, never by the people.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { notify } from '@/lib/notifications/server'
import { ArtworkError } from '@/lib/artworks/server'
import { checkMessage, otherOf, pairOf, previewOf, whenLabel, type MessageKind } from './core'

export interface ConversationRow { id: number; artworkId: number | null; artworkTitle: string | null; artworkPublicId: string | null; artworkCoverUrl: string | null; other: { id: number; name: string; initials: string; sub: string }; preview: string; when: string; unread: number }
export interface MessageRow { id: number; mine: boolean; kind: MessageKind; body: string; at: string; offerId: number | null }

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?'

/** The login that answers for an artwork: the member's user, else an admin of its tenant. */
export async function counterpartOfArtwork(artworkId: number): Promise<{ userId: number; label: string } | null> {
  const a = await prisma.artwork.findUnique({ where: { id: artworkId }, select: { member: { select: { userId: true, displayName: true, tenantId: true, kind: true } } } })
  if (!a) return null
  if (a.member.userId) return { userId: a.member.userId, label: a.member.displayName }
  const admin = await prisma.user.findFirst({ where: { tenantId: a.member.tenantId, tenantRole: 'ADMIN', active: true }, select: { id: true }, orderBy: { id: 'asc' } })
  return admin ? { userId: admin.id, label: a.member.displayName } : null
}

async function subOf(userId: number): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { member: { select: { kind: true, displayName: true, city: true } } } })
  if (u?.member) return u.member.kind === 'GALLERY_STAFF' ? 'Galeria' : u.member.kind === 'ARTIST' ? 'Artista' : 'Consultor'
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
      other: { id: u.id, name, initials: initials(name), sub: u.member ? (u.member.kind === 'GALLERY_STAFF' ? 'Galeria' : u.member.kind === 'ARTIST' ? 'Artista' : 'Consultor') : 'Colecionador' },
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

async function requireParticipant(me: number, conversationId: number) {
  const c = await prisma.conversation.findUnique({ where: { id: conversationId }, include: { participants: true } })
  if (!c || !c.participants.some((p) => p.userId === me)) throw new ArtworkError('NOT_FOUND', 'Conversa não encontrada.', 404)
  return c
}

export async function readConversation(me: number, conversationId: number, afterId = 0): Promise<{ header: ConversationRow; messages: MessageRow[] }> {
  const c = await requireParticipant(me, conversationId)
  const other = otherOf(c, me)
  const u = await prisma.user.findUniqueOrThrow({ where: { id: other }, select: { id: true, name: true, member: { select: { displayName: true } } } })
  const a = c.artworkId ? await prisma.artwork.findUnique({ where: { id: c.artworkId }, select: { title: true, publicId: true, media: { where: { kind: 'FRONT_COLOR_CARD' }, select: { publicUrl: true }, take: 1 } } }) : null
  const msgs = await prisma.message.findMany({ where: { conversationId, id: { gt: afterId } }, orderBy: { id: 'asc' }, take: 200 })
  await prisma.conversationParticipant.updateMany({ where: { conversationId, userId: me }, data: { unread: 0, lastReadAt: new Date() } })
  const name = u.member?.displayName ?? u.name
  return {
    header: { id: c.id, artworkId: c.artworkId, artworkTitle: a?.title ?? null, artworkPublicId: a?.publicId ?? null, artworkCoverUrl: a?.media[0]?.publicUrl ?? null, other: { id: u.id, name, initials: initials(name), sub: await subOf(u.id) }, preview: c.lastPreview ?? '', when: c.lastMessageAt ? whenLabel(c.lastMessageAt) : '', unread: 0 },
    messages: msgs.map((m) => ({ id: m.id, mine: m.senderUserId === me, kind: m.kind as MessageKind, body: m.body, at: m.createdAt.toISOString(), offerId: m.offerId })),
  }
}

async function append(conversationId: number, sender: number | null, kind: MessageKind, body: string, offerId: number | null): Promise<MessageRow> {
  const c = await prisma.conversation.findUniqueOrThrow({ where: { id: conversationId } })
  const m = await prisma.$transaction(async (tx) => {
    const row = await tx.message.create({ data: { conversationId, senderUserId: sender, kind, body, offerId } })
    await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: row.createdAt, lastPreview: previewOf(body, false, kind) } })
    await tx.conversationParticipant.updateMany({ where: { conversationId, userId: sender == null ? undefined : { not: sender } }, data: { unread: { increment: 1 } } })
    return row
  })
  // A system line only updates the thread: the offer flow already sends its own aviso to each side.
  if (sender != null) {
    const sName = await prisma.user.findUnique({ where: { id: sender }, select: { name: true, member: { select: { displayName: true } } } })
    await notify({ userId: otherOf(c, sender), kind: 'message.received', title: `Mensagem de ${sName?.member?.displayName ?? sName?.name ?? 'alguém'}`, body: body.slice(0, 120), href: `/messages/${conversationId}` })
  }
  return { id: m.id, mine: false, kind, body, at: m.createdAt.toISOString(), offerId }
}

export async function sendMessage(me: number, conversationId: number, raw: unknown): Promise<MessageRow> {
  await requireParticipant(me, conversationId)
  const chk = checkMessage(raw)
  if (!chk.ok) throw new ArtworkError(chk.code, chk.error, 422)
  const m = await append(conversationId, me, 'TEXT', chk.body, null)
  return { ...m, mine: true }
}

/** A system line in the conversation of the offer's buyer and seller (best-effort; a buyer without login has no conversation). */
export async function systemLine(opts: { buyerUserId: number | null; artworkId: number; kind: 'OFFER' | 'COUNTER' | 'SYSTEM'; body: string; offerId?: number }): Promise<void> {
  if (!opts.buyerUserId) return
  try {
    const id = await openConversation(opts.buyerUserId, opts.artworkId)
    await append(id, null, opts.kind, opts.body, opts.offerId ?? null)
  } catch (e) { console.warn('[messaging] system line skipped', (e as Error).name) }
}
