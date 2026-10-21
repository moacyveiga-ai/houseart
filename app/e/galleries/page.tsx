import type { Metadata } from 'next'
import { Galleries } from '@/components/public/Galleries'
import { listPublicGalleries } from '@/lib/public-content/server'
import { tagsOf, ufsOf } from '@/lib/public-content/profile-core'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Galerias — HouseArt', description: 'Galerias verificadas pela HouseArt com obras à venda.' }

const clean = (v: string | undefined, max = 60) => { const s = (v ?? '').trim().slice(0, max); return s || null }

// Galerias (handoff "HouseArt Galerias"): the list of galleries with works for sale.
export default async function PublicGalleriesPage({ searchParams }: { searchParams: Promise<{ q?: string; uf?: string; tag?: string }> }) {
  const sp = await searchParams
  const f = { q: clean(sp.q), uf: clean(sp.uf, 2)?.toUpperCase() ?? null, tag: clean(sp.tag) }
  const [all, matched] = await Promise.all([listPublicGalleries(), listPublicGalleries({ q: f.q, uf: f.uf })])
  const items = f.tag ? matched.filter((g) => g.tags.includes(f.tag!)) : matched
  return <Galleries items={items} tags={tagsOf(matched)} ufs={ufsOf(all)} f={f} />
}
