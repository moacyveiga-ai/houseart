// Handoff Fase 5: conversations (contact filter, system lines from the offer flow), community feed, reactions, comments, polls, push subscriptions.
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { listArtworkForSale, startPublicOffer } from '@/lib/offers/server'
import { listConversations, openConversation, readConversation, sendMessage, unreadMessages } from '@/lib/messaging/server'
import { addComment, artworkCounts, artworkSignals, commentsOf, createPost, deleteComment, feed, toggleReaction, vote } from '@/lib/community/server'
import { isExpoEndpoint, pushConfig, savePushSubscription } from '@/lib/notifications/push'
import { createScenario, type Scenario } from './fixtures'
import { asPanel } from './session'
import { truncateTables } from './db'

let s: Scenario
let buyerId: number
beforeEach(async () => {
  process.env.FLAG_TENANT_SCOPE = '1'
  s = await createScenario()
  await truncateTables(['Mandate', 'Offer', 'Deal', 'Contact', 'Notification', 'Conversation', 'Post', 'PostComment', 'Reaction', 'PollVote', 'PushSubscription', 'NewsArticle', 'AgendaEvent', 'rate_limit_bucket'])
  await prisma.artwork.update({ where: { id: s.a1.artworkId }, data: { status: 'AUTHENTICATED', seal: 'GREEN', publicId: 'HA-2026-TEST-0007' } })
  await asPanel(s.a1.userId, async ({ scope, user }) => {
    await listArtworkForSale(scope, s.a1.artworkId, { listPriceCents: 1_000_000n, reservePriceCents: 600_000n, autoNegotiatorOn: false, autoAcceptMinBps: 10000, fixedPrice: false }, { userId: user.id })
  })
  buyerId = (await prisma.user.create({ data: { email: 'lia@col.test', name: 'Lia Souza', profile: 'collector', active: true, emailVerifiedAt: new Date() } })).id
})

describe('conversations', () => {
  it('opens one row per pair+artwork, refuses contacts, counts unread, and the offer writes a system line', async () => {
    const id = await openConversation(buyerId, s.a1.artworkId)
    expect(await openConversation(buyerId, s.a1.artworkId)).toBe(id)
    await expect(sendMessage(buyerId, id, 'me chama no 71 99999-1234')).rejects.toMatchObject({ code: 'CONTACT' })
    const m = await sendMessage(buyerId, id, 'A obra ainda está disponível?')
    expect(m.mine).toBe(true)
    expect(await unreadMessages(s.a1.userId)).toBe(1)
    expect(await unreadMessages(buyerId)).toBe(0)
    const list = await listConversations(s.a1.userId)
    expect(list).toHaveLength(1); expect(list[0]).toMatchObject({ unread: 1, other: { name: 'Lia Souza', sub: 'Colecionador' }, artworkPublicId: 'HA-2026-TEST-0007' })
    const read = await readConversation(s.a1.userId, id)
    expect(read.messages.map((x) => x.body)).toEqual(['A obra ainda está disponível?'])
    expect(await unreadMessages(s.a1.userId)).toBe(0)
    // a stranger cannot read it
    await expect(readConversation(s.a2.userId, id)).rejects.toMatchObject({ status: 404 })
    // the offer flow (logged buyer, e-mail verified → no OTP) appends a system line
    const r = await startPublicOffer({ publicId: 'HA-2026-TEST-0007', buyerName: 'Lia Souza', buyerEmail: 'lia@col.test', buyerDocument: '52998224725', offeredCents: 800_000n, buyerUserId: buyerId })
    expect(r.ok).toBe(true)
    const after = await readConversation(buyerId, id)
    expect(after.messages.at(-1)).toMatchObject({ kind: 'OFFER', body: expect.stringContaining('Proposta enviada') })
  }, 60_000)
})

describe('community', () => {
  it('feed mixes posts, news and agenda; like/save/follow toggle; comments and poll votes', async () => {
    await prisma.newsArticle.create({ data: { slug: 'n1', category: 'Mercado', title: 'Colecionadores jovens', summary: 'x', publishedAt: new Date() } })
    const ev = await prisma.agendaEvent.create({ data: { kind: 'FAIR', title: 'Feira', venue: 'Pavilhão', city: 'São Paulo/SP', startsOn: '2099-11-07' } })
    const p = await createPost(s.a1.userId, { kind: 'POLL', body: 'Que técnica?', pollOptions: ['Pintura', 'Fotografia'] })
    await createPost(s.a1.userId, { kind: 'PHOTO', body: 'Ateliê hoje', artworkId: s.a1.artworkId })
    await expect(createPost(buyerId, { kind: 'TEXT', body: '' })).rejects.toMatchObject({ code: 'BAD_POST' })
    const f0 = await feed(buyerId)
    expect(f0.map((i) => i.kind).sort()).toEqual(['AGENDA', 'NEWS', 'PHOTO', 'POLL'])
    expect(f0.find((i) => i.kind === 'PHOTO')).toMatchObject({ artwork: { publicId: 'HA-2026-TEST-0007' }, author: { sub: 'Galeria', following: false } })

    expect(await toggleReaction(buyerId, 'POST', p.id, 'LIKE')).toEqual({ on: true, count: 1 })
    expect(await toggleReaction(buyerId, 'POST', p.id, 'LIKE')).toEqual({ on: false, count: 0 })
    await toggleReaction(buyerId, 'POST', p.id, 'SAVE')
    await toggleReaction(buyerId, 'EVENT', ev.id, 'RSVP')
    await toggleReaction(buyerId, 'MEMBER', s.a1.memberId, 'FOLLOW')
    await expect(toggleReaction(buyerId, 'POST', p.id, 'RSVP')).rejects.toMatchObject({ code: 'BAD_REACTION' })
    await expect(toggleReaction(s.a1.userId, 'MEMBER', s.a1.memberId, 'FOLLOW')).rejects.toMatchObject({ code: 'SELF' })
    const saved = await feed(buyerId, { tab: 'SAVED' })
    expect(saved.map((i) => i.key)).toEqual([`P${p.id}`])
    const f1 = await feed(buyerId)
    expect(f1.find((i) => i.kind === 'AGENDA')).toMatchObject({ going: 1, iAmGoing: true })
    expect(f1.find((i) => i.kind === 'POLL')).toMatchObject({ saved: true, author: { following: true } })

    await vote(buyerId, p.id, 1); await vote(buyerId, p.id, 0)
    await expect(vote(buyerId, p.id, 5)).rejects.toMatchObject({ code: 'BAD_OPTION' })
    expect((await feed(buyerId)).find((i) => i.kind === 'POLL')?.poll).toMatchObject({ myVote: 0, total: 1, options: [{ label: 'Pintura', pct: 100 }, { label: 'Fotografia', pct: 0 }] })

    const c = await addComment(buyerId, 'POST', p.id, 'Pintura, sempre.')
    expect(await commentsOf(buyerId, 'POST', p.id)).toMatchObject([{ body: 'Pintura, sempre.', mine: true }])
    expect((await prisma.post.findUniqueOrThrow({ where: { id: p.id } })).commentCount).toBe(1)
    await expect(deleteComment(s.a2.userId, c.id)).rejects.toMatchObject({ status: 404 })
    await deleteComment(s.a1.userId, c.id) // the post author moderates
    expect(await commentsOf(buyerId, 'POST', p.id)).toEqual([])
    expect((await prisma.notification.findMany({ where: { userId: s.a1.userId, kind: 'community.commented' } })).length).toBe(1)
  }, 60_000)
})

describe('push', () => {
  it('push is off without the envs and subscriptions upsert by endpoint', async () => {
    expect(pushConfig({})).toBeNull()
    expect(pushConfig({ WEB_PUSH_VAPID_PUBLIC_KEY: 'a', WEB_PUSH_VAPID_PRIVATE_KEY: 'b', WEB_PUSH_SUBJECT: 'mailto:x@y.z' })).toMatchObject({ publicKey: 'a' })
    await savePushSubscription(buyerId, { endpoint: 'https://push.example/1', keys: { p256dh: 'k', auth: 'a' } }, 'ua')
    await savePushSubscription(buyerId, { endpoint: 'https://push.example/1', keys: { p256dh: 'k2', auth: 'a' } }, 'ua')
    expect(await prisma.pushSubscription.count({ where: { userId: buyerId } })).toBe(1)
    await expect(savePushSubscription(buyerId, { endpoint: 'http://x', keys: { p256dh: 'k', auth: 'a' } }, null)).rejects.toThrow()
    // the mobile app (Expo) registers its device token on the same table
    expect(isExpoEndpoint('expo:ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]')).toBe(true)
    expect(isExpoEndpoint('expo:garbage')).toBe(false)
    await savePushSubscription(buyerId, { endpoint: 'expo:ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]', keys: { p256dh: 'expo', auth: 'expo' } }, 'houseart-mobile')
    expect(await prisma.pushSubscription.count({ where: { userId: buyerId } })).toBe(2)
  })
})

describe('artwork favorites and search', () => {
  it('likes/saves a public artwork, lists favorites, and the search finds it by title and id', async () => {
    const { favoritesOf, artworkFlags } = await import('@/lib/community/server')
    const { search } = await import('@/lib/search/server')
    expect(await toggleReaction(buyerId, 'ARTWORK', s.a1.artworkId, 'SAVE')).toEqual({ on: true, count: 1 })
    await toggleReaction(buyerId, 'ARTWORK', s.a1.artworkId, 'LIKE')
    await expect(toggleReaction(buyerId, 'ARTWORK', 999_999, 'LIKE')).rejects.toMatchObject({ status: 404 })
    const favs = await favoritesOf(buyerId)
    expect(favs).toMatchObject([{ publicId: 'HA-2026-TEST-0007', liked: true, saved: true }])
    expect((await artworkFlags(buyerId, [s.a1.artworkId])).get(s.a1.artworkId)).toEqual({ liked: true, saved: true })
    const title = (await prisma.artwork.findUniqueOrThrow({ where: { id: s.a1.artworkId } })).title
    expect((await search(title)).artworks.map((a) => a.publicId)).toContain('HA-2026-TEST-0007')
    expect((await search('ha-2026-test-0007')).artworks).toHaveLength(1)
    expect((await search('')).total).toBe(0)
  })
})

describe('comments on an artwork', () => {
  it('a public artwork takes comments, counts them, tells the seller; a private one does not', async () => {
    const c = await addComment(buyerId, 'ARTWORK', s.a1.artworkId, 'Que cor linda ao vivo.')
    expect(c.id).toBeGreaterThan(0)
    const rows = await commentsOf(buyerId, 'ARTWORK', s.a1.artworkId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ body: 'Que cor linda ao vivo.', mine: true })
    await toggleReaction(buyerId, 'ARTWORK', s.a1.artworkId, 'LIKE')
    expect((await artworkCounts([s.a1.artworkId])).get(s.a1.artworkId)).toEqual({ likes: 1, comments: 1 })
    expect(await artworkSignals(buyerId, s.a1.artworkId)).toMatchObject({ likes: 1, liked: true, comments: 1 })
    // the seller (the member holding it) gets the notice
    expect(await prisma.notification.count({ where: { userId: s.a1.userId, kind: 'community.commented' } })).toBe(1)
    // the artwork of b has no public page: no comment, nothing to read
    await expect(addComment(buyerId, 'ARTWORK', s.b.artworkId, 'oi')).rejects.toMatchObject({ status: 404 })
    expect(await commentsOf(buyerId, 'ARTWORK', s.b.artworkId)).toEqual([])
    await deleteComment(buyerId, c.id)
    expect((await artworkCounts([s.a1.artworkId])).get(s.a1.artworkId)).toEqual({ likes: 1, comments: 0 })
  }, 60_000)

  it('the seller is the thread author by id, moderates it, and an archived work closes it', async () => {
    const own = await addComment(s.a1.userId, 'ARTWORK', s.a1.artworkId, 'Obrigada!')
    const other = await addComment(buyerId, 'ARTWORK', s.a1.artworkId, 'spam')
    // a buyer named like the gallery does not become the author
    await prisma.user.update({ where: { id: buyerId }, data: { name: 'Ana Ladeira' } })
    const asBuyer = await commentsOf(buyerId, 'ARTWORK', s.a1.artworkId)
    expect(asBuyer.map((r) => [r.byOwner, r.canDelete])).toEqual([[true, false], [false, true]])
    const asSeller = await commentsOf(s.a1.userId, 'ARTWORK', s.a1.artworkId)
    expect(asSeller.every((r) => r.canDelete)).toBe(true)
    await deleteComment(s.a1.userId, other.id)
    expect((await commentsOf(null, 'ARTWORK', s.a1.artworkId)).map((r) => r.id)).toEqual([own.id])
    // archived: the page is gone, so the thread is too (read, write and like)
    await prisma.artwork.update({ where: { id: s.a1.artworkId }, data: { status: 'ARCHIVED' } })
    expect(await commentsOf(null, 'ARTWORK', s.a1.artworkId)).toEqual([])
    await expect(addComment(buyerId, 'ARTWORK', s.a1.artworkId, 'oi')).rejects.toMatchObject({ status: 404 })
    await expect(toggleReaction(buyerId, 'COMMENT', own.id, 'LIKE')).rejects.toMatchObject({ status: 404 })
  }, 60_000)
})

