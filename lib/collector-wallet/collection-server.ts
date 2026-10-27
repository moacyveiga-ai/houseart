// "Minha coleção" (HouseArt Web Colecionador.dc.html › Coleção): the header the
// collector sees above Obras · Favoritos · Curtidos · Compras · Vendas — counts,
// registered value and artists. Every number comes from the same loaders the
// tabs use, so the header never disagrees with the list under it.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { walletOf } from './server'
import { favoritesOf } from '@/lib/community/server'
import { buyerDeals } from '@/lib/deals/server'
import { flagOn } from '@/lib/flags'
import { totalScope } from '@/lib/scope/context'
import { ScopeNotApplied } from '@/lib/scope/extension-core'
import { suggestedRange } from './price-range-core'
import { artistSaleAmounts } from './price-range-server'
import { collectionValuation, type CollectionValuation } from './valuation-core'

export interface CollectionSummary {
  works: number; registeredCents: bigint; artists: number
  saved: number; liked: number; purchases: number; newSales: number
  /** Null when no work has both a registered value and a reference. */
  valuation: CollectionValuation | null
}

export async function collectionSummary(user: { id: number; memberId: number | null }): Promise<CollectionSummary> {
  const [[wallet, valuation], favs, deals, offers, newSales] = await Promise.all([
    walletOf(user.id).then(async (w) => [w, await valuationOf(w.values).catch((e: unknown) => {
      if (e instanceof ScopeNotApplied) throw e
      console.warn('[collection] valorização', (e as Error)?.name)
      return null
    })] as const),
    favoritesOf(user.id).catch(() => []),
    flagOn('FLAG_DEALS') ? buyerDeals(user.id).catch(() => []) : Promise.resolve([]),
    prisma.offer.count({ where: { buyerUserId: user.id, status: { in: ['RECEIVED', 'BELOW_RESERVE', 'NEGOTIATING'] } } }),
    user.memberId ? prisma.offer.count({ where: { memberId: user.memberId, status: { in: ['RECEIVED', 'BELOW_RESERVE', 'NEGOTIATING'] } } }) : Promise.resolve(0),
  ])
  return {
    valuation,
    works: wallet.items.length, registeredCents: wallet.totalCents, artists: new Set(wallet.items.map((i) => i.artist)).size,
    saved: favs.filter((f) => f.saved).length, liked: favs.filter((f) => f.liked).length,
    purchases: deals.filter((d) => d.phase !== 'COMPLETED').length + offers, newSales,
  }
}

/** At most this many artists are priced per header (one comparables read each). */
const MAX_ARTISTS_PRICED = 12

/**
 * Today's reference for each work: its latest ISSUED laudo (the appraiser's suggested value),
 * else the middle of the artist's selling range — the same coarse range "Vender esta obra" shows
 * (sales of the last 12 months, six or more, quartile ends rounded outwards), never a median that
 * could be one sale of someone else.
 */
async function valuationOf(values: readonly { artworkId: number; artistId: number; registeredCents: bigint | null }[]): Promise<CollectionValuation | null> {
  const priced = values.filter((v) => v.registeredCents && v.registeredCents > 0n)
  if (!priced.length) return null
  const laudos = await totalScope('collection:valuation', async () => await prisma.appraisal.findMany({ where: { artworkId: { in: priced.map((v) => v.artworkId) }, status: 'ISSUED' }, orderBy: { issuedAt: 'desc' }, select: { artworkId: true, suggestedCents: true } }))
  const byArtwork = new Map<number, bigint>()
  for (const l of laudos) if (!byArtwork.has(l.artworkId)) byArtwork.set(l.artworkId, l.suggestedCents)
  const artists = [...new Set(priced.filter((v) => !byArtwork.has(v.artworkId)).map((v) => v.artistId))].slice(0, MAX_ARTISTS_PRICED)
  const market = new Map<number, bigint>()
  await Promise.all(artists.map(async (artistId) => {
    const r = suggestedRange(await artistSaleAmounts(artistId))
    if (r) market.set(artistId, (r.lowCents + r.highCents) / 2n)
  }))
  return collectionValuation(priced.map((v) => ({ registeredCents: v.registeredCents, estimateCents: byArtwork.get(v.artworkId) ?? market.get(v.artistId) ?? null })))
}
