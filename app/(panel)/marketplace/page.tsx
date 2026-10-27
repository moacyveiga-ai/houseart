import { requirePanelPage } from '../_session'
import { listPublicArtworks } from '@/lib/marketplace/public-server'
import { ALL_HREF, PANEL_CHIPS, categoryChip, isAll, panelQuery, parsePanelFilter, toggleHref } from '@/lib/marketplace/panel-filter-core'
import { Chip } from '@/components/ds/Chip'
import { MarketplaceGrid } from '@/components/marketplace/MarketplaceGrid'

export const metadata = { title: 'Marketplace — HouseArt' }

// The chips combine (audit web-app §16); "Só autenticadas" clears them (every listed work is authenticated).
export default async function MarketplacePage({ searchParams }: { searchParams: Promise<{ f?: string; category?: string }> }) {
  await requirePanelPage('/marketplace')
  const filter = parsePanelFilter(await searchParams)
  const items = await listPublicArtworks(panelQuery(filter))
  const cat = categoryChip(filter)
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Marketplace</h1></div>
      <div className="ha-row" role="group" aria-label="Filtros">
        <Chip on={isAll(filter)} href={ALL_HREF}>Só autenticadas</Chip>
        {PANEL_CHIPS.map((c) => <Chip key={c.key} on={filter.chips.includes(c.key)} href={toggleHref(filter, c.key)}>{c.label}</Chip>)}
        {cat ? <Chip on href={cat.clearHref}>{cat.label} ×</Chip> : null}
      </div>
      <MarketplaceGrid items={items} />
    </div>
  )
}
