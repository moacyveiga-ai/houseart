// Community — I/O. Feed, posts, comments, reactions (like/save/rsvp/follow)
// and polls. Counters live on the row (incremented in the same transaction
// as the reaction row) so the feed never counts on read.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { ArtworkError } from '@/lib/artworks/server'
import { notify } from '@/lib/notifications/server'
import { whenLabel } from '@/lib/messaging/core'
import { publicUrlHosts } from '@/lib/public-url'
import { checkComment, checkPost, dayMonthOf, pollResult, reactionAllowed, type CommentTarget, type ReactionKind, type ReactionTarget } from './domain'

export interface FeedAuthor { name: string; initials: string; sub: string; memberId: number | null; memberSlug: string | null; following: boolean }
export interface FeedItem {
  key: string
  kind: 'PHOTO' | 'TEXT' | 'POLL' | 'EVENT' | 'NEWS' | 'AGENDA'
  id: number
  author: FeedAuthor
  when: string
  body: string
  imageUrl: string | null
  artwork: { publicId: string; title: string } | null
  // news
  title?: string; summary?: string | null; format?: string | null; href?: string
  // event / agenda
  day?: string; month?: string; venue?: string; startsAt?: string | null; going?: number; iAmGoing?: boolean
  // poll
  poll?: { options: { label: string; count: number; pct: number }[]; myVote: number | null; total: number }
  likes: number; liked: boolean; saved: boolean; comments: number; canComment: boolean
}

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?'
const HOUSE: FeedAuthor = { name: 'HouseArt Notícias', initials: 'HA', sub: 'Editorial', memberId: null, memberSlug: null, following: false }

async function authorsOf(userIds: number[], viewer: number | null): Promise<Map<number, FeedAuthor>> {
  const ids = [...new Set(userIds)]
  if (!ids.length) return new Map()
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, member: { select: { id: true, slug: true, kind: true, displayName: true, city: true } } } })
  const memberIds = users.map((u) => u.member?.id).filter((v): v is number => v != null)
  const follows = viewer && memberIds.length ? await prisma.reaction.findMany({ where: { userId: viewer, targetKind: 'MEMBER', kind: 'FOLLOW', targetId: { in: memberIds } }, select: { targetId: true } }) : []
  const fset = new Set(follows.map((f) => f.targetId))
  return new Map(users.map((u) => {
    const name = u.member?.displayName ?? u.name
    const sub = u.member ? (u.member.kind === 'GALLERY_STAFF' ? 'Galeria' : u.member.kind === 'ARTIST' ? 'Artista' : u.member.kind === 'COLLECTOR' ? 'Colecionador' : 'Consultor') + (u.member.city ? ` · ${u.member.city}` : '') : 'Colecionador'
    return [u.id, { name, initials: initials(name), sub, memberId: u.member?.id ?? null, memberSlug: u.member?.slug ?? null, following: u.member ? fset.has(u.member.id) : false }]
  }))
}

async function myReactions(viewer: number | null, targets: { kind: ReactionTarget; id: number }[]): Promise<Set<string>> {
  if (!viewer || !targets.length) return new Set()
  const rows = await prisma.reaction.findMany({ where: { userId: viewer, OR: targets.map((t) => ({ targetKind: t.kind, targetId: t.id })) }, select: { targetKind: true, targetId: true, kind: true } })
  return new Set(rows.map((r) => `${r.targetKind}:${r.targetId}:${r.kind}`))
}

async function countsOf(kind: ReactionTarget, ids: number[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map()
  const rows = await prisma.reaction.groupBy({ by: ['targetId', 'kind'], where: { targetKind: kind, targetId: { in: ids } }, _count: { _all: true } })
  return new Map(rows.map((r) => [`${r.targetId}:${r.kind}`, r._count._all]))
}

async function commentCounts(kind: CommentTarget, ids: number[]): Promise<Map<number, number>> {
  if (!ids.length) return new Map()
  const rows = await prisma.postComment.groupBy({ by: ['targetId'], where: { targetKind: kind, targetId: { in: ids }, hiddenAt: null }, _count: { _all: true } })
  return new Map(rows.map((r) => [r.targetId, r._count._all]))
}

/** The feed: posts, news and agenda of the last 60 days, newest first; followed authors first. */
export async function feed(viewer: number | null, opts: { take?: number; tab?: 'ALL' | 'SAVED' | 'EVENTS' | 'NEWS' } = {}): Promise<FeedItem[]> {
  const take = Math.min(opts.take ?? 40, 100)
  const since = new Date(Date.now() - 60 * 86_400_000)
  const tab = opts.tab ?? 'ALL'
  const savedKeys = tab === 'SAVED' && viewer ? await prisma.reaction.findMany({ where: { userId: viewer, kind: 'SAVE' }, select: { targetKind: true, targetId: true } }) : null
  const savedIds = (k: ReactionTarget) => savedKeys?.filter((s) => s.targetKind === k).map((s) => s.targetId) ?? []

  const [posts, news, agenda] = await Promise.all([
    tab === 'NEWS' ? [] : prisma.post.findMany({ where: { hiddenAt: null, ...(savedKeys ? { id: { in: savedIds('POST') } } : { createdAt: { gte: since } }), ...(tab === 'EVENTS' ? { kind: 'EVENT' } : {}) }, orderBy: { createdAt: 'desc' }, take }),
    tab === 'EVENTS' ? [] : prisma.newsArticle.findMany({ where: { publishedAt: { not: null, lte: new Date() }, ...(savedKeys ? { id: { in: savedIds('NEWS') } } : {}) }, orderBy: { publishedAt: 'desc' }, take: tab === 'NEWS' ? take : 10 }),
    tab === 'NEWS' ? [] : prisma.agendaEvent.findMany({ where: savedKeys ? { id: { in: savedIds('EVENT') } } : { startsOn: { gte: new Date().toISOString().slice(0, 10) } }, orderBy: { startsOn: 'asc' }, take: tab === 'EVENTS' ? take : 6 }),
  ])
  const authors = await authorsOf(posts.map((p) => p.authorUserId), viewer)
  const artIds = posts.map((p) => p.artworkId).filter((v): v is number => v != null)
  const arts = artIds.length ? await prisma.artwork.findMany({ where: { id: { in: artIds } }, select: { id: true, publicId: true, title: true, media: { where: { kind: 'FRONT_COLOR_CARD' }, select: { publicUrl: true }, take: 1 } } }) : []
  const byArt = new Map(arts.map((a) => [a.id, a]))
  const mine = await myReactions(viewer, [...posts.map((p) => ({ kind: 'POST' as const, id: p.id })), ...news.map((n) => ({ kind: 'NEWS' as const, id: n.id })), ...agenda.map((e) => ({ kind: 'EVENT' as const, id: e.id }))])
  const [newsCounts, eventCounts, newsComments] = await Promise.all([countsOf('NEWS', news.map((n) => n.id)), countsOf('EVENT', agenda.map((e) => e.id)), commentCounts('NEWS', news.map((n) => n.id))])
  const pollIds = posts.filter((p) => p.kind === 'POLL').map((p) => p.id)
  const votes = pollIds.length ? await prisma.pollVote.groupBy({ by: ['postId', 'optionIdx'], where: { postId: { in: pollIds } }, _count: { _all: true } }) : []
  const myVotes = viewer && pollIds.length ? await prisma.pollVote.findMany({ where: { userId: viewer, postId: { in: pollIds } }, select: { postId: true, optionIdx: true } }) : []

  const items: FeedItem[] = []
  for (const p of posts) {
    const a = authors.get(p.authorUserId) ?? { name: 'Membro', initials: 'M', sub: '', memberId: null, memberSlug: null, following: false }
    const art = p.artworkId ? byArt.get(p.artworkId) : null
    const item: FeedItem = {
      key: `P${p.id}`, kind: p.kind as FeedItem['kind'], id: p.id, author: a, when: whenLabel(p.createdAt), body: p.body,
      imageUrl: p.imageUrl ?? art?.media[0]?.publicUrl ?? null, artwork: art ? { publicId: art.publicId ?? '', title: art.title } : null,
      likes: p.likeCount, liked: mine.has(`POST:${p.id}:LIKE`), saved: mine.has(`POST:${p.id}:SAVE`), comments: p.commentCount, canComment: true,
    }
    if (p.kind === 'EVENT' && p.eventStartsOn) Object.assign(item, { ...dayMonthOf(p.eventStartsOn), title: p.eventTitle ?? '', venue: p.eventVenue ?? '', startsAt: p.eventStartsAt, going: p.rsvpCount, iAmGoing: mine.has(`POST:${p.id}:RSVP`) })
    if (p.kind === 'POLL') {
      const options: string[] = JSON.parse(p.pollOptionsJson ?? '[]')
      const counts = options.map((_, i) => votes.find((v) => v.postId === p.id && v.optionIdx === i)?._count._all ?? 0)
      item.poll = { options: pollResult(options, counts), myVote: myVotes.find((v) => v.postId === p.id)?.optionIdx ?? null, total: counts.reduce((x, y) => x + y, 0) }
    }
    items.push(item)
  }
  for (const n of news) items.push({
    key: `N${n.id}`, kind: 'NEWS', id: n.id, author: HOUSE, when: n.publishedAt ? whenLabel(n.publishedAt) : '', body: n.summary ?? '', imageUrl: n.imageUrl, artwork: null,
    title: n.title, summary: n.summary, format: n.category, href: `/e/news/${n.slug}`,
    likes: newsCounts.get(`${n.id}:LIKE`) ?? 0, liked: mine.has(`NEWS:${n.id}:LIKE`), saved: mine.has(`NEWS:${n.id}:SAVE`), comments: newsComments.get(n.id) ?? 0, canComment: true,
  })
  for (const e of agenda) items.push({
    key: `E${e.id}`, kind: 'AGENDA', id: e.id, author: { ...HOUSE, name: 'Agenda', initials: 'AG', sub: 'Agenda de arte' }, when: 'agenda', body: '', imageUrl: null, artwork: null,
    title: e.title, venue: `${e.venue} · ${e.city}${e.period ? ` · ${e.period}` : ''}`, ...dayMonthOf(e.startsOn), href: e.url ?? undefined,
    going: eventCounts.get(`${e.id}:RSVP`) ?? 0, iAmGoing: mine.has(`EVENT:${e.id}:RSVP`),
    likes: eventCounts.get(`${e.id}:LIKE`) ?? 0, liked: mine.has(`EVENT:${e.id}:LIKE`), saved: mine.has(`EVENT:${e.id}:SAVE`), comments: 0, canComment: false,
  })
  // Order: followed authors' posts first, then by recency; agenda keeps its own order at its slot.
  const score = (i: FeedItem) => (i.author.following ? 1 : 0)
  const stamp = new Map<string, number>([...posts.map((p) => [`P${p.id}`, p.createdAt.getTime()] as const), ...news.map((n) => [`N${n.id}`, n.publishedAt?.getTime() ?? 0] as const)])
  const dated = items.filter((i) => i.kind !== 'AGENDA').sort((x, y) => score(y) - score(x) || (stamp.get(y.key) ?? 0) - (stamp.get(x.key) ?? 0))
  const ag = items.filter((i) => i.kind === 'AGENDA')
  if (tab === 'EVENTS' || tab === 'SAVED' || tab === 'NEWS') return [...dated, ...ag]
  const out: FeedItem[] = []
  dated.forEach((i, idx) => { out.push(i); if ((idx + 1) % 3 === 0 && ag.length) out.push(ag.shift()!) })
  return [...out, ...ag]
}

/** A post image is only one the house serves: the public media route or the Blob store. */
function isOwnImageUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return publicUrlHosts().includes(u.host) || /\.public\.blob\.vercel-storage\.com$/.test(u.host)
  } catch { return false }
}

export async function createPost(userId: number, raw: Record<string, unknown>): Promise<{ id: number }> {
  const chk = checkPost(raw)
  if (!chk.ok) throw new ArtworkError('BAD_POST', chk.error, 422)
  const v = chk.value
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { memberId: true, tenantId: true } })
  if (v.imageUrl && !isOwnImageUrl(v.imageUrl)) throw new ArtworkError('BAD_IMAGE', 'A foto do post precisa ser uma imagem enviada à HouseArt.', 422)
  if (v.artworkId) {
    const a = await prisma.artwork.findUnique({ where: { id: v.artworkId }, select: { memberId: true, status: true, publicId: true } })
    if (!a || !a.publicId || !['LISTED', 'AUTHENTICATED', 'IN_DEAL', 'SOLD'].includes(a.status)) throw new ArtworkError('ARTWORK', 'Só obras autenticadas entram num post.', 422)
  }
  const p = await prisma.post.create({ data: {
    authorUserId: userId, authorMemberId: u.memberId, tenantId: u.tenantId, kind: v.kind, body: v.body, imageUrl: v.imageUrl ?? null, artworkId: v.artworkId ?? null,
    pollOptionsJson: v.pollOptions ? JSON.stringify(v.pollOptions) : null,
    eventTitle: v.event?.title ?? null, eventVenue: v.event?.venue ?? null, eventStartsOn: v.event?.startsOn ?? null, eventStartsAt: v.event?.startsAt ?? null,
  } })
  return { id: p.id }
}

export async function deletePost(userId: number, postId: number): Promise<void> {
  const r = await prisma.post.updateMany({ where: { id: postId, authorUserId: userId, hiddenAt: null }, data: { hiddenAt: new Date() } })
  if (!r.count) throw new ArtworkError('NOT_FOUND', 'Post não encontrado.', 404)
}

/** Toggles a reaction; returns the new state and the counter. */
export async function toggleReaction(userId: number, target: string, targetId: number, kind: string): Promise<{ on: boolean; count: number }> {
  if (!reactionAllowed(target, kind)) throw new ArtworkError('BAD_REACTION', 'Reação inválida.', 422)
  if (target === 'MEMBER') {
    const m = await prisma.member.findUnique({ where: { id: targetId }, select: { userId: true } })
    if (!m) throw new ArtworkError('NOT_FOUND', 'Perfil não encontrado.', 404)
    if (m.userId === userId) throw new ArtworkError('SELF', 'Você não segue a si mesmo.', 400)
  }
  if (target === 'ARTWORK') {
    const a = await prisma.artwork.findFirst({ where: { id: targetId, publicId: { not: null }, seal: 'GREEN' }, select: { id: true } })
    if (!a) throw new ArtworkError('NOT_FOUND', 'Obra não encontrada.', 404)
  }
  let postAuthor: number | null = null
  if (target === 'POST') {
    const p = await prisma.post.findFirst({ where: { id: targetId, hiddenAt: null }, select: { kind: true, authorUserId: true } })
    if (!p) throw new ArtworkError('NOT_FOUND', 'Post não encontrado.', 404)
    if (kind === 'RSVP' && p.kind !== 'EVENT') throw new ArtworkError('BAD_REACTION', '"Eu vou" só vale para um evento.', 422)
    postAuthor = p.authorUserId
  }
  if (target === 'NEWS' && !(await prisma.newsArticle.findFirst({ where: { id: targetId, publishedAt: { not: null, lte: new Date() } }, select: { id: true } }))) throw new ArtworkError('NOT_FOUND', 'Notícia não encontrada.', 404)
  if (target === 'EVENT' && !(await prisma.agendaEvent.findUnique({ where: { id: targetId }, select: { id: true } }))) throw new ArtworkError('NOT_FOUND', 'Evento não encontrado.', 404)
  if (target === 'COMMENT' && !(await prisma.postComment.findFirst({ where: { id: targetId, hiddenAt: null }, select: { id: true } }))) throw new ArtworkError('NOT_FOUND', 'Comentário não encontrado.', 404)
  const col = kind === 'LIKE' ? 'likeCount' : kind === 'SAVE' ? 'saveCount' : kind === 'RSVP' ? 'rsvpCount' : null
  const result = await prisma.$transaction(async (tx) => {
    // Two taps in flight on the same reaction wait for each other (the unique index would 500 the second).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`react:${userId}:${target}:${targetId}:${kind}`}))`
    const existing = await tx.reaction.findUnique({ where: { userId_targetKind_targetId_kind: { userId, targetKind: target, targetId, kind } } })
    let on: boolean
    if (existing) { await tx.reaction.delete({ where: { id: existing.id } }); on = false } else { await tx.reaction.create({ data: { userId, targetKind: target, targetId, kind: kind as ReactionKind } }); on = true }
    const delta = on ? 1 : -1
    if (target === 'POST' && col) await tx.post.updateMany({ where: { id: targetId }, data: { [col]: { increment: delta } } })
    if (target === 'COMMENT') await tx.postComment.updateMany({ where: { id: targetId }, data: { likeCount: { increment: delta } } })
    const count = await tx.reaction.count({ where: { targetKind: target, targetId, kind } })
    return { on, count }
  })
  if (result.on && target === 'POST' && kind === 'LIKE' && postAuthor != null && postAuthor !== userId) await notify({ userId: postAuthor, kind: 'community.liked', title: 'Curtiram seu post', href: '/community' })
  return result
}

export interface CommentRow { id: number; author: FeedAuthor; body: string; when: string; likes: number; liked: boolean; mine: boolean }

export async function commentsOf(viewer: number | null, target: CommentTarget, targetId: number): Promise<CommentRow[]> {
  const rows = await prisma.postComment.findMany({ where: { targetKind: target, targetId, hiddenAt: null }, orderBy: { id: 'asc' }, take: 200 })
  const authors = await authorsOf(rows.map((r) => r.userId), viewer)
  const mine = await myReactions(viewer, rows.map((r) => ({ kind: 'COMMENT' as const, id: r.id })))
  return rows.map((r) => ({ id: r.id, author: authors.get(r.userId)!, body: r.body, when: whenLabel(r.createdAt), likes: r.likeCount, liked: mine.has(`COMMENT:${r.id}:LIKE`), mine: r.userId === viewer }))
}

export async function addComment(userId: number, target: string, targetId: number, raw: unknown): Promise<{ id: number }> {
  if (target !== 'POST' && target !== 'NEWS') throw new ArtworkError('BAD_TARGET', 'Alvo inválido.', 422)
  const chk = checkComment(raw)
  if (!chk.ok) throw new ArtworkError('BAD_COMMENT', chk.error, 422)
  const post = target === 'POST' ? await prisma.post.findFirst({ where: { id: targetId, hiddenAt: null }, select: { id: true, authorUserId: true } }) : null
  if (target === 'POST' && !post) throw new ArtworkError('NOT_FOUND', 'Post não encontrado.', 404)
  if (target === 'NEWS' && !(await prisma.newsArticle.findUnique({ where: { id: targetId }, select: { id: true } }))) throw new ArtworkError('NOT_FOUND', 'Notícia não encontrada.', 404)
  const c = await prisma.$transaction(async (tx) => {
    const row = await tx.postComment.create({ data: { targetKind: target, targetId, postId: post?.id ?? null, userId, body: chk.body } })
    if (post) await tx.post.update({ where: { id: post.id }, data: { commentCount: { increment: 1 } } })
    return row
  })
  if (post && post.authorUserId !== userId) await notify({ userId: post.authorUserId, kind: 'community.commented', title: 'Comentaram no seu post', body: chk.body.slice(0, 120), href: '/community' })
  return { id: c.id }
}

export async function deleteComment(userId: number, commentId: number): Promise<void> {
  const c = await prisma.postComment.findUnique({ where: { id: commentId }, select: { userId: true, postId: true, hiddenAt: true, post: { select: { authorUserId: true } } } })
  if (!c || c.hiddenAt || (c.userId !== userId && c.post?.authorUserId !== userId)) throw new ArtworkError('NOT_FOUND', 'Comentário não encontrado.', 404)
  await prisma.$transaction(async (tx) => {
    await tx.postComment.update({ where: { id: commentId }, data: { hiddenAt: new Date() } })
    if (c.postId) await tx.post.update({ where: { id: c.postId }, data: { commentCount: { decrement: 1 } } })
  })
}

export async function vote(userId: number, postId: number, optionIdx: number): Promise<void> {
  const p = await prisma.post.findFirst({ where: { id: postId, kind: 'POLL', hiddenAt: null }, select: { pollOptionsJson: true } })
  if (!p) throw new ArtworkError('NOT_FOUND', 'Enquete não encontrada.', 404)
  const n = (JSON.parse(p.pollOptionsJson ?? '[]') as string[]).length
  if (!Number.isInteger(optionIdx) || optionIdx < 0 || optionIdx >= n) throw new ArtworkError('BAD_OPTION', 'Opção inválida.', 422)
  await prisma.pollVote.upsert({ where: { postId_userId: { postId, userId } }, create: { postId, userId, optionIdx }, update: { optionIdx } })
}

export async function followingOf(viewer: number): Promise<number[]> {
  const rows = await prisma.reaction.findMany({ where: { userId: viewer, targetKind: 'MEMBER', kind: 'FOLLOW' }, select: { targetId: true } })
  return rows.map((r) => r.targetId)
}

export interface FavoriteArtwork { id: number; publicId: string; title: string; year: number | null; artist: string; priceCents: bigint | null; saleMode: string | null; status: string; cover: string | null; liked: boolean; saved: boolean; at: string }

/** The artworks the person liked or saved, newest reaction first (the marketplace cards + the two flags). */
export async function favoritesOf(userId: number, take = 100): Promise<FavoriteArtwork[]> {
  const rows = await prisma.reaction.findMany({ where: { userId, targetKind: 'ARTWORK', kind: { in: ['LIKE', 'SAVE'] } }, orderBy: { createdAt: 'desc' }, take: take * 2 })
  const ids = [...new Set(rows.map((r) => r.targetId))].slice(0, take)
  if (!ids.length) return []
  const arts = await prisma.artwork.findMany({ where: { id: { in: ids }, publicId: { not: null } }, select: { id: true, publicId: true, title: true, year: true, listPriceCents: true, saleMode: true, status: true, artist: { select: { name: true } }, media: { where: { kind: 'FRONT_COLOR_CARD' }, select: { publicUrl: true }, take: 1 } } })
  const byId = new Map(arts.map((a) => [a.id, a]))
  return ids.flatMap((id) => {
    const a = byId.get(id); if (!a) return []
    const mine = rows.filter((r) => r.targetId === id)
    return [{ id: a.id, publicId: a.publicId!, title: a.title, year: a.year, artist: a.artist.name, priceCents: a.status === 'LISTED' && a.saleMode !== 'ON_REQUEST' ? a.listPriceCents : null, saleMode: a.saleMode, status: a.status, cover: a.media[0]?.publicUrl ?? null, liked: mine.some((r) => r.kind === 'LIKE'), saved: mine.some((r) => r.kind === 'SAVE'), at: mine[0]!.createdAt.toISOString() }]
  })
}

/** The viewer's like/save flags for a set of artworks (public cards). */
export async function artworkFlags(viewer: number | null, artworkIds: number[]): Promise<Map<number, { liked: boolean; saved: boolean }>> {
  const out = new Map<number, { liked: boolean; saved: boolean }>()
  if (!viewer || !artworkIds.length) return out
  const rows = await prisma.reaction.findMany({ where: { userId: viewer, targetKind: 'ARTWORK', targetId: { in: artworkIds } }, select: { targetId: true, kind: true } })
  for (const r of rows) { const f = out.get(r.targetId) ?? { liked: false, saved: false }; if (r.kind === 'LIKE') f.liked = true; if (r.kind === 'SAVE') f.saved = true; out.set(r.targetId, f) }
  return out
}

/** The viewer's like/save flags and the counts of one article (the news page). */
export async function newsSignals(viewer: number | null, newsId: number): Promise<{ likes: number; liked: boolean; saved: boolean; comments: number }> {
  const [counts, mine, comments] = await Promise.all([countsOf('NEWS', [newsId]), myReactions(viewer, [{ kind: 'NEWS', id: newsId }]), commentCounts('NEWS', [newsId])])
  return { likes: counts.get(`${newsId}:LIKE`) ?? 0, liked: mine.has(`NEWS:${newsId}:LIKE`), saved: mine.has(`NEWS:${newsId}:SAVE`), comments: comments.get(newsId) ?? 0 }
}

/** Which of `ids` the viewer already reacted to with `kind` (public pages: "Seguindo", "Salvo"). */
export async function reactedIds(viewer: number | null, targetKind: string, kind: string, ids: number[]): Promise<Set<number>> {
  if (!viewer || !ids.length) return new Set()
  const rows = await prisma.reaction.findMany({ where: { userId: viewer, targetKind, kind, targetId: { in: ids } }, select: { targetId: true } })
  return new Set(rows.map((r) => r.targetId))
}
