import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Artist } from '@/components/public/Artist'
import { publicArtist } from '@/lib/public-content/server'
import { workFilterOf } from '@/lib/public-content/profile-core'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ obras?: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await publicArtist((await params).slug)
  return { title: a ? `${a.name} — HouseArt` : 'Artista — HouseArt', description: a?.bio[0] ?? undefined }
}

// Artista (handoff "HouseArt Artista"): the public profile of an artist.
export default async function PublicArtistPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const a = await publicArtist(slug)
  if (!a) notFound()
  return <Artist a={a} filter={workFilterOf(sp.obras)} />
}
