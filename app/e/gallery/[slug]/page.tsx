import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Gallery } from '@/components/public/Gallery'
import { publicGallery } from '@/lib/public-content/server'

export const dynamic = 'force-dynamic'

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ artista?: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = await publicGallery((await params).slug)
  return { title: g ? `${g.name} — HouseArt` : 'Galeria — HouseArt', description: g?.summary ?? undefined }
}

// Galeria (handoff "HouseArt Galeria"): the public page of a verified gallery.
export default async function PublicGalleryPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams])
  const g = await publicGallery(slug)
  if (!g) notFound()
  return <Gallery g={g} artistFilter={sp.artista ?? null} />
}
