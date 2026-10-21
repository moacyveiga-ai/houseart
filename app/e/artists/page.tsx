import type { Metadata } from 'next'
import { Artists } from '@/components/public/Artists'
import { listPublicArtists } from '@/lib/public-content/server'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Artistas — HouseArt' }

export default async function PublicArtistsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const p = await searchParams
  const q = (Array.isArray(p.q) ? p.q[0] : p.q ?? '').trim().slice(0, 80)
  const artists = await listPublicArtists(q || null, 120)
  return <Artists artists={artists} q={q} />
}
