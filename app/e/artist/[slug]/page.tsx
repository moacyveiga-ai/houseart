import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Artist } from '@/components/public/Artist'
import { publicArtist } from '@/lib/public-content/server'
import { workFilterOf } from '@/lib/public-content/profile-core'
import { getSession } from '@/lib/auth'
import { reactedIds } from '@/lib/community/server'

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
  const user = await getSession()
  const following = a.followMemberId ? (await reactedIds(user?.id ?? null, 'MEMBER', 'FOLLOW', [a.followMemberId])).has(a.followMemberId) : false
  return <Artist a={a} filter={workFilterOf(sp.obras)} viewer={{ signedIn: !!user, following }} />
}
