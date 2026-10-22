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

export interface ListingView {
  artworkId: number; title: string; status: string; paused: boolean; listPriceCents: bigint; acceptsOffers: boolean; fixedPrice: boolean
  stats: { views7d: number; views30d: number; openOffers: number }
  rules: { autoNegotiatorOn: boolean; autoAcceptMinBps: number }
}

async function reachable(scope: Scope, artworkId: number) {
  const a = await prisma.artwork.findUnique({ where: { id: artworkId }, select: { id: true, memberId: true, tenantId: true, title: true, status: true, listingPausedAt: true, saleMode: true } })
  if (!a || !canView(scope, a)) throw new ArtworkError('NOT_FOUND', 'Obra não encontrada.', 404)
  return a
}

function dayKey(d: Date): string { return diaNoFuso(d) ?? d.toISOString().slice(0, 10) }

export async function viewsSince(artworkId: number, days: number, now = new Date()): Promise<number> {
  const from = dayKey(new Date(now.getTime() - days * 86_400_000))
  const r = await prisma.artworkViewDay.aggregate({ where: { artworkId, day: { gte: from } }, _sum: { count: true } })
  return r._sum.count ?? 0
}

export async function listingOf(scope: Scope, artworkId: number, now = new Date()): Promise<ListingView | null> {
  const a = await reachable(scope, artworkId)
  const m = await prisma.mandate.findFirst({ where: { artworkId, status: 'ACTIVE' } })
  if (!m) return null
  const [views7d, views30d, openOffers] = await Promise.all([viewsSince(artworkId, 7, now), viewsSince(artworkId, 30, now), prisma.offer.count({ where: { artworkId, status: { in: [...OPEN_FOR_SELLER] } } })])
  return { artworkId, title: a.title, status: a.status, paused: !!a.listingPausedAt, listPriceCents: m.listPriceCents, acceptsOffers: !m.fixedPrice, fixedPrice: m.fixedPrice, stats: { views7d, views30d, openOffers }, rules: { autoNegotiatorOn: m.autoNegotiatorOn, autoAcceptMinBps: m.autoAcceptMinBps } }
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
  return (await listingOf(scope, artworkId))!
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

