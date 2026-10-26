import { requirePanelPage } from '../_session'
import { favoritesOf } from '@/lib/community/server'
import { FavoritesScreen, type FavoritesTab } from '@/components/collector/FavoritesScreen'
import { collectionSummary } from '@/lib/collector-wallet/collection-server'
import { CollectionHeader } from '@/components/collector/CollectionHeader'
import { collectorPanel } from '@/lib/collector-wallet/panel-server'
import { CollectorArtworkPanel } from '@/components/collector/CollectorArtworkPanel'

export const metadata = { title: 'Favoritos e curtidos — HouseArt' }

export default async function FavoritesPage({ searchParams }: { searchParams: Promise<{ tab?: string; work?: string }> }) {
  const { user, nav } = await requirePanelPage('/favorites')
  const sp = await searchParams
  const tab: FavoritesTab = sp.tab === 'liked' ? 'liked' : 'saved'
  const panel = sp.work ? await collectorPanel(user.id, { work: sp.work }) : null
  const rows = (await favoritesOf(user.id)).map((r) => ({ ...r, priceCents: r.priceCents === null ? null : r.priceCents.toString(), at: undefined }))
  const summary = nav === 'collector' ? await collectionSummary(user) : null
  return <div className="ha-page">{summary ? <CollectionHeader s={summary} active={tab === 'liked' ? 'liked' : 'saved'} /> : null}<FavoritesScreen key={tab} rows={rows.map(({ at: _at, ...r }) => r)} tab={tab} bare={!!summary} />{panel ? <CollectorArtworkPanel key={panel.id} a={panel} closeHref={tab === 'liked' ? '/favorites?tab=liked' : '/favorites'} /> : null}</div>
}
