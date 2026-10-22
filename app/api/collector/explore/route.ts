import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { listPublicArtworks, marketItems } from '@/lib/marketplace/public-server'
import { artworkFlags } from '@/lib/community/server'
import { artworkErrorResponse } from '@/app/api/artworks/_http'

export const dynamic = 'force-dynamic'

/**
 * The Explorar feed for the mobile app (handoff "HouseArt App Colecionador" › Explorar):
 * the same join the web page `app/(panel)/explore/page.tsx` does — the public
 * cards (numeric id for the reactions) + the market item (seller, technique) by
 * publicId + the viewer's liked/saved flags. The chips are applied by the client.
 */
export async function GET() {
  try {
    const u = await requireAuth()
    const [cards, market] = await Promise.all([listPublicArtworks({}, 60), marketItems(500)])
    const byId = new Map(market.map((m) => [m.publicId, m]))
    const flags = await artworkFlags(u.id, cards.map((c) => c.id))
    const items = cards.flatMap((c) => {
      const m = byId.get(c.publicId)
      if (!m) return []
      const f = flags.get(c.id)
      return [{
        id: c.id, publicId: c.publicId, title: c.title, year: c.year, artist: c.artist, category: c.category,
        priceCents: c.priceCents === null ? null : c.priceCents.toString(), saleMode: c.saleMode, cover: c.cover,
        technique: m.technique, dimensions: m.dimensions, seller: m.seller, sellerKind: m.sellerKind, market: m.market, uf: m.uf,
        liked: f?.liked ?? false, saved: f?.saved ?? false,
      }]
    })
    return NextResponse.json({ items }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) { return artworkErrorResponse(e) }
}
