// Listing management ("Gestão do anúncio", Phase 6) — I/O: the stats of a
// listed artwork, the price change (a new mandate version keeps the floor),
// accepting offers or not, pausing the listing without losing the mandate.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { canView, type Scope } from '@/lib/scope/core'
import { ArtworkError } from '@/lib/artworks/server'
import { audit } from '@/lib/audit'
import { OPEN_FOR_SELLER } from '@/lib/offers/domain'
import { LISTING_ROLES, requireSellerRole } from '@/lib/offers/seller-role-server'

const LISTING_FORBIDDEN = 'Seu papel na galeria não muda o anúncio.'
import { diaNoFuso } from '@/lib/timezone'
import { notify } from '@/lib/notifications/server'
import { afterResponseOrNow } from '@/lib/after'
import { priceDropNotice, priceDropRecipients } from './price-drop-core'

export interface ListingView {
  artworkId: number; title: string; status: string; paused: boolean; listPriceCents: bigint; acceptsOffers: boolean; fixedPrice: boolean
  stats: { views7d: number; views30d: number; openOffers: number; saves: number; likes: number }
  rules: { autoNegotiatorOn: boolean; autoAcceptMinBps: number }
  /** only on a price reduction: how many people who saved the work were told */
  priceDropNotified?: number
}

const ARTWORK_SELECT = { id: true, memberId: true, tenantId: true, title: true, status: true, listingPausedAt: true, saleMode: true } as const

async function reachable(scope: Scope, artworkId: number) {
  const a = await prisma.artwork.findUnique({ where: { id: artworkId }, select: ARTWORK_SELECT })
  if (!a || !canView(scope, a)) throw new ArtworkError('NOT_FOUND', 'Obra não encontrada.', 404)
  return a
}

function dayKey(d: Date): string { return diaNoFuso(d) ?? d.toISOString().slice(0, 10) }
const fromDay = (days: number, now: Date) => dayKey(new Date(now.getTime() - days * 86_400_000))

/** Views since `days` ago for many artworks in ONE query (absent = 0). No scope: the caller already recorded the ids. */
export async function viewsSinceMany(artworkIds: readonly number[], days: number, now = new Date()): Promise<Map<number, number>> {
  const ids = [...new Set(artworkIds)]
  if (ids.length === 0) return new Map()
  const rows = await prisma.artworkViewDay.groupBy({ by: ['artworkId'], where: { artworkId: { in: ids }, day: { gte: fromDay(days, now) } }, _sum: { count: true } })
  return new Map(rows.map((r) => [r.artworkId, r._sum.count ?? 0]))
}

/**
 * The listing of many artworks at a constant cost (the Acervo and the day
 * panel used to call `listingOf` once per work, ~5 queries each): one query
 * for the artworks, one for the ACTIVE mandates, one `groupBy` per view window
 * and one for the open offers. Works out of the scope (canView) or without an
 * ACTIVE mandate are absent from the map. Never carries the floor.
 */
export async function listingsOf(scope: Scope, artworkIds: readonly number[], now = new Date()): Promise<Map<number, ListingView>> {
  return (await loadListings(scope, artworkIds, now)).listings
}

async function loadListings(scope: Scope, artworkIds: readonly number[], now: Date): Promise<{ visible: Set<number>; listings: Map<number, ListingView> }> {
  const ids = [...new Set(artworkIds)].filter((id) => Number.isInteger(id) && id > 0)
  const out = new Map<number, ListingView>()
  if (ids.length === 0) return { visible: new Set(), listings: out }
  const artworks = (await prisma.artwork.findMany({ where: { id: { in: ids } }, select: ARTWORK_SELECT })).filter((a) => canView(scope, a))
  const visible = artworks.map((a) => a.id)
  if (visible.length === 0) return { visible: new Set(), listings: out }
  const [mandates, views7d, views30d, offers, reactions] = await Promise.all([
    prisma.mandate.findMany({
      where: { artworkId: { in: visible }, status: 'ACTIVE' },
      select: { artworkId: true, listPriceCents: true, fixedPrice: true, autoNegotiatorOn: true, autoAcceptMinBps: true },
      orderBy: [{ version: 'desc' }, { id: 'desc' }],
    }),
    viewsSinceMany(visible, 7, now),
    viewsSinceMany(visible, 30, now),
    prisma.offer.groupBy({ by: ['artworkId'], where: { artworkId: { in: visible }, status: { in: [...OPEN_FOR_SELLER] } }, _count: { _all: true } }),
    // "salvos · curtidas" of the public page (community reactions on the artwork; the collector's favourite is the SAVE)
    prisma.reaction.groupBy({ by: ['targetId', 'kind'], where: { targetKind: 'ARTWORK', targetId: { in: visible }, kind: { in: ['SAVE', 'LIKE'] } }, _count: { _all: true } }),
  ])
  const reactionsOf = new Map(reactions.map((r) => [`${r.targetId}:${r.kind}`, r._count._all]))
  const mandateOf = new Map<number, (typeof mandates)[number]>()
  for (const m of mandates) if (!mandateOf.has(m.artworkId)) mandateOf.set(m.artworkId, m)
  const offersOf = new Map(offers.map((o) => [o.artworkId, o._count._all]))
  for (const a of artworks) {
    const m = mandateOf.get(a.id)
    if (!m) continue
    out.set(a.id, {
      artworkId: a.id, title: a.title, status: a.status, paused: !!a.listingPausedAt, listPriceCents: m.listPriceCents, acceptsOffers: !m.fixedPrice, fixedPrice: m.fixedPrice,
      stats: { views7d: views7d.get(a.id) ?? 0, views30d: views30d.get(a.id) ?? 0, openOffers: offersOf.get(a.id) ?? 0, saves: reactionsOf.get(`${a.id}:SAVE`) ?? 0, likes: reactionsOf.get(`${a.id}:LIKE`) ?? 0 },
      rules: { autoNegotiatorOn: m.autoNegotiatorOn, autoAcceptMinBps: m.autoAcceptMinBps },
    })
  }
  return { visible: new Set(visible), listings: out }
}

/** One artwork: 404 out of the scope, null when it has no ACTIVE mandate; the same reader as the batch. */
export async function listingOf(scope: Scope, artworkId: number, now = new Date()): Promise<ListingView | null> {
  const { visible, listings } = await loadListings(scope, [artworkId], now)
  if (!visible.has(artworkId)) throw new ArtworkError('NOT_FOUND', 'Obra não encontrada.', 404)
  return listings.get(artworkId) ?? null
}

/** Price change = new mandate version with the same floor (never below it); the previous is SUPERSEDED. */
export async function changeListPrice(scope: Scope, artworkId: number, listPriceCents: bigint, actor: { userId: number }): Promise<ListingView> {
  const a = await reachable(scope, artworkId)
  await requireSellerRole(scope, LISTING_ROLES, LISTING_FORBIDDEN)
  const m = await prisma.mandate.findFirst({ where: { artworkId, status: 'ACTIVE' } })
  if (!m) throw new ArtworkError('NOT_LISTED', 'A obra não está à venda.', 409)
  if (listPriceCents <= 0n) throw new ArtworkError('BAD_PRICE', 'Informe o preço.', 400)
  if (listPriceCents < m.reservePriceCents) throw new ArtworkError('BELOW_FLOOR', 'O preço não pode ficar abaixo do piso do mandato.', 409)
  await prisma.$transaction(async (tx) => {
    const r = await tx.mandate.updateMany({ where: { id: m.id, status: 'ACTIVE' }, data: { status: 'SUPERSEDED' } })
    if (r.count === 0) throw new ArtworkError('CHANGED', 'O mandato acabou de mudar.', 409)
    await tx.mandate.create({ data: { artworkId, memberId: m.memberId, tenantId: m.tenantId, listPriceCents, reservePriceCents: m.reservePriceCents, fixedPrice: m.fixedPrice, autoNegotiatorOn: m.autoNegotiatorOn, autoAcceptMinBps: m.autoAcceptMinBps, acceptsTrade: m.acceptsTrade, shippingIncluded: m.shippingIncluded, version: m.version + 1 } })
    await tx.artwork.update({ where: { id: artworkId }, data: { listPriceCents } })
  })
  void audit.event({ entity: 'artwork', entityId: artworkId, action: 'list_price', userId: actor.userId, after: { listPriceCents: listPriceCents.toString(), from: m.listPriceCents.toString(), title: a.title } })
  const view = (await listingOf(scope, artworkId))!
  const notified = listPriceCents < m.listPriceCents && !a.listingPausedAt ? await tellSavers(artworkId, m.listPriceCents, listPriceCents, actor.userId) : 0
  return notified ? { ...view, priceDropNotified: notified } : view
}

/** "Preço reduzido": the people who saved the work (public reaction SAVE) hear about it, after the response. */
async function tellSavers(artworkId: number, fromCents: bigint, toCents: bigint, actorUserId: number): Promise<number> {
  const art = await prisma.artwork.findUnique({ where: { id: artworkId }, select: { title: true, publicId: true } })
  if (!art?.publicId) return 0
  const savers = await prisma.reaction.findMany({ where: { targetKind: 'ARTWORK', targetId: artworkId, kind: 'SAVE' }, select: { userId: true }, orderBy: { createdAt: 'desc' } })
  // only active accounts (blocked or deleted never hear from us)
  const active = new Set((await prisma.user.findMany({ where: { id: { in: [...new Set(savers.map((r) => r.userId))] }, active: true }, select: { id: true } })).map((u) => u.id))
  const to = priceDropRecipients(savers.map((r) => r.userId).filter((id) => active.has(id)), actorUserId)
  if (!to.length) return 0
  const n = priceDropNotice({ title: art.title, publicId: art.publicId }, fromCents, toCents)
  await afterResponseOrNow('listing:price_drop', async () => {
    for (let i = 0; i < to.length; i += 20) await Promise.all(to.slice(i, i + 20).map((userId) => notify({ userId, kind: 'artwork.price_drop', ...n })))
  })
  return to.length
}

export async function setAcceptsOffers(scope: Scope, artworkId: number, acceptsOffers: boolean, actor: { userId: number }): Promise<ListingView> {
  await reachable(scope, artworkId)
  await requireSellerRole(scope, LISTING_ROLES, LISTING_FORBIDDEN)
  const m = await prisma.mandate.findFirst({ where: { artworkId, status: 'ACTIVE' } })
  if (!m) throw new ArtworkError('NOT_LISTED', 'A obra não está à venda.', 409)
  await prisma.$transaction([
    prisma.mandate.update({ where: { id: m.id }, data: { fixedPrice: !acceptsOffers } }),
    prisma.artwork.update({ where: { id: artworkId }, data: { saleMode: acceptsOffers ? 'FIXED_WITH_OFFERS' : 'FIXED' } }),
  ])
  void audit.event({ entity: 'artwork', entityId: artworkId, action: 'accepts_offers', userId: actor.userId, after: { acceptsOffers } })
  return (await listingOf(scope, artworkId))!
}

/** Pause keeps status LISTED and the mandate; the marketplace hides it (listingPausedAt). */
export async function setPaused(scope: Scope, artworkId: number, paused: boolean, actor: { userId: number }): Promise<ListingView> {
  const a = await reachable(scope, artworkId)
  await requireSellerRole(scope, LISTING_ROLES, LISTING_FORBIDDEN)
  if (a.status !== 'LISTED') throw new ArtworkError('NOT_LISTED', 'A obra não está à venda.', 409)
  await prisma.artwork.update({ where: { id: artworkId }, data: { listingPausedAt: paused ? new Date() : null } })
  void audit.event({ entity: 'artwork', entityId: artworkId, action: paused ? 'pause_listing' : 'resume_listing', userId: actor.userId })
  return (await listingOf(scope, artworkId))!
}

/** A public view: one row per artwork and day, incremented (the route dedupes by IP+day before calling). */
export async function recordView(publicId: string, now = new Date()): Promise<boolean> {
  const a = await prisma.artwork.findUnique({ where: { publicId }, select: { id: true, status: true } })
  if (!a) return false
  const day = dayKey(now)
  await prisma.artworkViewDay.upsert({ where: { artworkId_day: { artworkId: a.id, day } }, create: { artworkId: a.id, day, count: 1 }, update: { count: { increment: 1 } } })
  return true
}

/** Likes and saves of each artwork (the public reactions of lib/community), for the panel's "Obras mais vistas". */
export async function reactionCountsOf(artworkIds: number[]): Promise<Map<number, { likes: number; saves: number }>> {
  const out = new Map<number, { likes: number; saves: number }>()
  if (!artworkIds.length) return out
  const rows = await prisma.reaction.groupBy({ by: ['targetId', 'kind'], where: { targetKind: 'ARTWORK', targetId: { in: artworkIds }, kind: { in: ['LIKE', 'SAVE'] } }, _count: { _all: true } })
  for (const r of rows) {
    const c = out.get(r.targetId) ?? { likes: 0, saves: 0 }
    if (r.kind === 'LIKE') c.likes = r._count._all; else c.saves = r._count._all
    out.set(r.targetId, c)
  }
  return out
}
