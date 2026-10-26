import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Gallery } from '@/components/public/Gallery'
import { publicGallery } from '@/lib/public-content/server'
import { getSession } from '@/lib/auth'
import { reactedIds } from '@/lib/community/server'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ artista?: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = await publicGallery((await params).slug)
  const title = g ? `${g.name} — HouseArt` : 'Galeria — HouseArt'
  const description = g?.summary ?? undefined
  const image = g?.coverUrl ?? g?.rooms.find((r) => r.url)?.url ?? null
  // same rule as the artist page: openGraph only with an image, else the root layout's brand block stays
  return { title, description, ...(image ? { openGraph: { title, description, siteName: 'HouseArt', locale: 'pt_BR', type: 'website', images: [{ url: image, alt: g!.name }] } } : {}) }
}

// Galeria (handoff "HouseArt Galeria"): the public page of a verified gallery.
export default async function PublicGalleryPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const g = await publicGallery(slug)
  if (!g) notFound()
  const user = await getSession()
  const following = g.followMemberId ? (await reactedIds(user?.id ?? null, 'MEMBER', 'FOLLOW', [g.followMemberId])).has(g.followMemberId) : false
  return <Gallery g={g} artistFilter={sp.artista ?? null} viewer={{ signedIn: !!user, following }} />
}
