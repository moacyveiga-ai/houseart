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
  const title = a ? `${a.name} — HouseArt` : 'Artista — HouseArt'
  const description = a?.bio[0] ?? undefined
  // a page-level openGraph REPLACES the root layout's whole block (Next merges per field), so it is only
  // declared when there is a photo to show, and carries siteName/locale again; without one the brand image stays
  return { title, description, ...(a?.photoUrl ? { openGraph: { title, description, siteName: 'HouseArt', locale: 'pt_BR', type: 'profile', images: [{ url: a.photoUrl, alt: a.name }] } } : {}) }
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
