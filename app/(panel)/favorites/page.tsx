import { requirePanelPage } from '../_session'
import { favoritesOf } from '@/lib/community/server'
import { FavoritesScreen, type FavoritesTab } from '@/components/collector/FavoritesScreen'
import { collectionSummary } from '@/lib/collector-wallet/collection-server'
import { CollectionHeader } from '@/components/collector/CollectionHeader'

export const metadata = { title: 'Favoritos e curtidos — HouseArt' }

export default async function FavoritesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { user, nav } = await requirePanelPage('/favorites')
  const tab: FavoritesTab = (await searchParams).tab === 'liked' ? 'liked' : 'saved'
  const rows = (await favoritesOf(user.id)).map((r) => ({ ...r, priceCents: r.priceCents === null ? null : r.priceCents.toString(), at: undefined }))
  const summary = nav === 'collector' ? await collectionSummary(user) : null
  return <div className="ha-page">{summary ? <CollectionHeader s={summary} active={tab === 'liked' ? 'liked' : 'saved'} /> : null}<FavoritesScreen key={tab} rows={rows.map(({ at: _at, ...r }) => r)} tab={tab} bare={!!summary} /></div>
}
