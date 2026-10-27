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
import { comparablesOf } from '@/lib/appraisal/server'
import { estimateFromComparables } from '@/lib/appraisal/estimate-core'
import { MIN_SALES_FOR_RANGE } from './price-range-core'
import { collectionValuation, type CollectionValuation } from './valuation-core'

export interface CollectionSummary {
  works: number; registeredCents: bigint; artists: number
  saved: number; liked: number; purchases: number; newSales: number
  /** Null when no work has both a registered value and a reference. */
  valuation: CollectionValuation | null
}

export async function collectionSummary(user: { id: number; memberId: number | null }): Promise<CollectionSummary> {
  const [wallet, favs, deals, offers, newSales] = await Promise.all([
    walletOf(user.id),
    favoritesOf(user.id).catch(() => []),
    flagOn('FLAG_DEALS') ? buyerDeals(user.id).catch(() => []) : Promise.resolve([]),
    prisma.offer.count({ where: { buyerUserId: user.id, status: { in: ['RECEIVED', 'BELOW_RESERVE', 'NEGOTIATING'] } } }),
    user.memberId ? prisma.offer.count({ where: { memberId: user.memberId, status: { in: ['RECEIVED', 'BELOW_RESERVE', 'NEGOTIATING'] } } }) : Promise.resolve(0),
  ])
  const valuation = await valuationOf(wallet.values).catch(() => null)
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
 * else the median of the artist's registered sales — only with MIN_SALES_FOR_RANGE or more, the
 * same floor as the selling range, so a single sale of someone else never becomes "your" value.
 */
async function valuationOf(values: readonly { artworkId: number; artistId: number; registeredCents: bigint | null }[]): Promise<CollectionValuation | null> {
  const priced = values.filter((v) => v.registeredCents && v.registeredCents > 0n)
  if (!priced.length) return null
  return totalScope('collection:valuation', async () => {
    const laudos = await prisma.appraisal.findMany({ where: { artworkId: { in: priced.map((v) => v.artworkId) }, status: 'ISSUED' }, orderBy: { issuedAt: 'desc' }, select: { artworkId: true, suggestedCents: true } })
    const byArtwork = new Map<number, bigint>()
    for (const l of laudos) if (!byArtwork.has(l.artworkId)) byArtwork.set(l.artworkId, l.suggestedCents)
    const artists = [...new Set(priced.filter((v) => !byArtwork.has(v.artworkId)).map((v) => v.artistId))].slice(0, MAX_ARTISTS_PRICED)
    const market = new Map<number, bigint>()
    for (const artistId of artists) {
      const comps = (await comparablesOf(artistId)).map((c) => c.priceCents)
      const e = comps.length >= MIN_SALES_FOR_RANGE ? estimateFromComparables(comps) : null
      if (e) market.set(artistId, e.suggestedCents)
    }
    return collectionValuation(priced.map((v) => ({ registeredCents: v.registeredCents, estimateCents: byArtwork.get(v.artworkId) ?? market.get(v.artistId) ?? null })))
  })
}
