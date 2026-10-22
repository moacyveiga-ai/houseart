import { listArtworks } from '@/lib/artworks/server'
import { listingOf } from '@/lib/gallery/listing-server'
import { chipCounts, summaryLine, type InventoryItem } from '@/components/gallery/inventory-core'
import { artworkErrorResponse, json } from '@/app/api/artworks/_http'
import { gallerySession, isResponse } from '../_http'

export const dynamic = 'force-dynamic'

/**
 * "Acervo" for the mobile app: the whole inventory of the scope, each listed
 * work with its engagement (views of 7 days, open offers, paused), the counts
 * of the chips and the summary line — what `app/(panel)/artworks/page.tsx`
 * builds for `InventoryList`. The chips and the search are applied in the app.
 */
export async function GET() {
  const s = await gallerySession(); if (isResponse(s)) return s
  try {
    const { items } = await listArtworks(s.scope, { filter: 'all' })
    const listings = await Promise.all(items.map((a) => (a.status === 'LISTED' ? listingOf(s.scope, a.id).catch(() => null) : Promise.resolve(null))))
    const all: InventoryItem[] = items.map((a, i) => {
      const l = listings[i]
      return { id: a.id, title: a.title, year: a.year, artistName: a.artistName, status: a.status, listPriceCents: a.listPriceCents, saleMode: a.saleMode, publicId: a.publicId, coverUrl: a.coverUrl, listing: l ? { views7d: l.stats.views7d, openOffers: l.stats.openOffers, paused: l.paused } : null }
    })
    return json({ ok: true, items: all, counts: chipCounts(all), summary: summaryLine(all) }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) { return artworkErrorResponse(e) }
}
