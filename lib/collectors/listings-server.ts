// "Anúncios ativos" (Vendas do colecionador): the works of the scope that are on the marketplace,
// with the listing's mode, its views of the last 7 days and the likes and comments of the public page.
import 'server-only'
import type { Scope } from '@/lib/scope/core'
import { listArtworks } from '@/lib/artworks/server'
import { listingsOf } from '@/lib/gallery/listing-server'
import { artworkCounts } from '@/lib/community/server'

export interface ActiveListingRow {
  id: number; publicId: string | null; title: string; year: number | null; artistName: string; coverUrl: string | null
  /** as string: BigInt never crosses the RSC boundary */
  listPriceCents: string | null; saleMode: string | null; paused: boolean
  stats: { views: number; likes: number; comments: number }
}

export async function activeListings(scope: Scope): Promise<ActiveListingRow[]> {
  const { items } = await listArtworks(scope, { filter: 'listed' })
  const listed = items.filter((a) => a.status === 'LISTED')
  if (listed.length === 0) return []
  const ids = listed.map((a) => a.id)
  const [listings, counts] = await Promise.all([listingsOf(scope, ids), artworkCounts(ids)])
  return listed.map((a) => {
    const l = listings.get(a.id)
    const c = counts.get(a.id)
    return {
      id: a.id, publicId: a.publicId, title: a.title, year: a.year, artistName: a.artistName, coverUrl: a.coverUrl,
      listPriceCents: a.listPriceCents?.toString() ?? null, saleMode: a.saleMode, paused: l?.paused ?? false,
      stats: { views: l?.stats.views7d ?? 0, likes: c?.likes ?? 0, comments: c?.comments ?? 0 },
    }
  })
}
