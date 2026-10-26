import { requirePanelPage } from '../_session'
import { listPublicArtworks, marketItems } from '@/lib/marketplace/public-server'
import { artworkFlags } from '@/lib/community/server'
import { ExploreScreen } from '@/components/collector/ExploreScreen'
import { chipOf, exploreHref, passesChip, viewOf, type ExploreItem } from '@/components/collector/explore-core'
import { collectorPanel } from '@/lib/collector-wallet/panel-server'
import { CollectorArtworkPanel } from '@/components/collector/CollectorArtworkPanel'

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

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ view?: string; cat?: string; work?: string }> }) {
  const { user } = await requirePanelPage('/explore')
  const p = await searchParams
  const view = viewOf(p.view), chip = chipOf(p.cat)
  const items = (await exploreItems(user.id)).filter((i) => passesChip(i, chip))
  // the artwork opens in the side panel over the feed (Web Colecionador › obra)
  const panel = p.work ? await collectorPanel(user, { work: p.work }) : null
  return (
    <div className="ha-page">
      <ExploreScreen key={`${view}:${chip}`} items={items} view={view} chip={chip} />
      {panel ? <CollectorArtworkPanel key={panel.id} a={panel} closeHref={exploreHref(view, chip)} /> : null}
    </div>
  )
}
