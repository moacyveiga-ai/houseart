import { requirePanelPage } from '../_session'
import { listPublicArtworks, marketItems } from '@/lib/marketplace/public-server'
import { artworkFlags } from '@/lib/community/server'
import { ExploreScreen } from '@/components/collector/ExploreScreen'
import { chipOf, passesChip, viewOf, type ExploreItem } from '@/components/collector/explore-core'

export const metadata = { title: 'Explorar — HouseArt' }

/** The feed: the public cards (numeric id for the reactions) joined to the market items (seller, technique) by publicId. */
async function exploreItems(viewer: number): Promise<ExploreItem[]> {
  const [cards, market] = await Promise.all([listPublicArtworks({}, 60), marketItems(500)])
  const byId = new Map(market.map((m) => [m.publicId, m]))
  const flags = await artworkFlags(viewer, cards.map((c) => c.id))
  return cards.flatMap((c) => {
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
}

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ view?: string; cat?: string }> }) {
  const { user } = await requirePanelPage('/explore')
  const p = await searchParams
  const view = viewOf(p.view), chip = chipOf(p.cat)
  const items = (await exploreItems(user.id)).filter((i) => passesChip(i, chip))
  return <div className="ha-page"><ExploreScreen key={`${view}:${chip}`} items={items} view={view} chip={chip} /></div>
}
