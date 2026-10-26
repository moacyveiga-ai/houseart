import type { Metadata } from 'next'
import { Marketplace } from '@/components/public/Marketplace'
import { listPublicArtworks, marketArtists, marketItems } from '@/lib/marketplace/public-server'
import { artworkFlags } from '@/lib/community/server'
import { getSession } from '@/lib/auth'
import { selectionFromParams, type SortKey } from '@/lib/marketplace/filter-core'

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
  const [items, artists, cards, session] = await Promise.all([marketItems(500), marketArtists(6), listPublicArtworks({}, 500), getSession()])
  // The heart of each card: the numeric id (reactions) and whether this person already liked it.
  const flags = await artworkFlags(session?.id ?? null, cards.map((c) => c.id))
  const byPublicId: Record<string, { id: number; liked: boolean }> = {}
  for (const c of cards) byPublicId[c.publicId] = { id: c.id, liked: flags.get(c.id)?.liked ?? false }
  return <Marketplace items={items} artists={artists} sel={sel} q={q} sort={sort} reactions={{ signedIn: !!session, byPublicId }} />
}
