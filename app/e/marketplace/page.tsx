import type { Metadata } from 'next'
import { Marketplace } from '@/components/public/Marketplace'
import { marketArtists, marketItems } from '@/lib/marketplace/public-server'
import { selectionFromParams, type SortKey } from '@/lib/marketplace/filter-core'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Marketplace — HouseArt' }

const SORTS: SortKey[] = ['rel', 'lower', 'higher', 'recent']
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

export default async function PublicMarketplacePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams
  const sel = selectionFromParams(p)
  const q = one(p.q).trim().slice(0, 120)
  const sortRaw = one(p.sort) as SortKey
  const sort: SortKey = SORTS.includes(sortRaw) ? sortRaw : 'rel'
  const [items, artists] = await Promise.all([marketItems(500), marketArtists(6)])
  return <Marketplace items={items} artists={artists} sel={sel} q={q} sort={sort} />
}
