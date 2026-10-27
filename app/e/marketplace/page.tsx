import type { Metadata } from 'next'
import { Marketplace } from '@/components/public/Marketplace'
import { marketArtists, marketItems } from '@/lib/marketplace/public-server'
import { artworkFlags } from '@/lib/community/server'
import { getSession } from '@/lib/auth'
import { pageFromParam, passes, selectionFromParams, sortItems, visibleCount, type SortKey } from '@/lib/marketplace/filter-core'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Marketplace — HouseArt', description: 'Obras autenticadas com escritura, à venda por artistas, galerias e colecionadores. Preço, origem e certificado em cada uma.' }

const SORTS: SortKey[] = ['rel', 'lower', 'higher', 'recent']
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

export default async function PublicMarketplacePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams
  const sel = selectionFromParams(p)
  const q = one(p.q).trim().slice(0, 120)
  const sortRaw = one(p.sort) as SortKey
  const sort: SortKey = SORTS.includes(sortRaw) ? sortRaw : 'rel'
  const page = pageFromParam(one(p.pagina))
  const [items, artists, session] = await Promise.all([marketItems(500), marketArtists(6), getSession()])
  // The heart of each card shown on this page: the numeric id (reactions) and whether this person already liked it.
  const shown = sortItems(items.filter((i) => passes(i, sel, q)), sort).slice(0, visibleCount(page, items.length))
  const ids = shown.map((i) => i.id).filter((id): id is number => typeof id === 'number')
  const flags = await artworkFlags(session?.id ?? null, ids)
  const byPublicId: Record<string, { id: number; liked: boolean }> = {}
  for (const i of shown) if (typeof i.id === 'number') byPublicId[i.publicId] = { id: i.id, liked: flags.get(i.id)?.liked ?? false }
  return <Marketplace items={items} artists={artists} sel={sel} q={q} sort={sort} page={page} reactions={{ signedIn: !!session, byPublicId }} />
}
