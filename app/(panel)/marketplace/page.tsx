import { requirePanelPage } from '../_session'
import { listPublicArtworks } from '@/lib/marketplace/public-server'
import { Chip } from '@/components/ds/Chip'
import { MarketplaceGrid } from '@/components/marketplace/MarketplaceGrid'

export const metadata = { title: 'Marketplace — HouseArt' }

const CHIPS = [
  { key: 'all', label: 'Só autenticadas', q: {} },
  { key: 'painting', label: 'Pintura', q: { category: 'PAINTING' } },
  { key: 'under50', label: 'Até R$ 50 mil', q: { max: '5000000' } },
  { key: 'primary', label: 'Primário', q: { market: 'PRIMARY' } },
  { key: 'ba', label: 'Bahia', q: { uf: 'BA' } },
]

export default async function MarketplacePage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  await requirePanelPage('/marketplace')
  const f = (await searchParams).f ?? 'all'
  const chip = CHIPS.find((c) => c.key === f) ?? CHIPS[0]
  const q = chip.q as { category?: string; max?: string; market?: string; uf?: string }
  const items = await listPublicArtworks({ category: q.category ?? null, maxPriceCents: q.max ? BigInt(q.max) : null, market: q.market ?? null, uf: q.uf ?? null })
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Marketplace</h1></div>
      <div className="ha-row">{CHIPS.map((c) => <Chip key={c.key} on={c.key === f} href={`/marketplace?f=${c.key}`}>{c.label}</Chip>)}</div>
      <MarketplaceGrid items={items} />
    </div>
  )
}
