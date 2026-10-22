import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Artwork } from '@/components/public/Artwork'
import { isPublicId } from '@/lib/physical-markers/domain'
import { publicArtwork, relatedArtworks } from '@/lib/marketplace/public-server'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ publicId: string }> }

const idOf = async (params: Params['params']) => (await params).publicId.toUpperCase()

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const publicId = await idOf(params)
  if (!isPublicId(publicId)) return { title: 'Obra — HouseArt' }
  const a = await publicArtwork(publicId)
  if (!a) return { title: 'Obra — HouseArt' }
  const title = `${a.title}${a.year ? `, ${a.year}` : ''} — ${a.artist} — HouseArt`
  const description = [a.technique, a.dimensions !== '—' ? a.dimensions : null, `Obra autenticada ${a.publicId}`].filter(Boolean).join(' · ')
  return { title, description, openGraph: { title, description, type: 'article', ...(a.cover ? { images: [{ url: a.cover, alt: a.title }] } : {}) } }
}

// The public page of the artwork (handoff "HouseArt Obra").
export default async function PublicArtworkPage({ params }: Params) {
  const publicId = await idOf(params)
  if (!isPublicId(publicId)) notFound()
  const a = await publicArtwork(publicId)
  if (!a) notFound()
  const [related, session] = await Promise.all([relatedArtworks(publicId, 4), getSession()])
  return <Artwork artwork={a} related={related} signedIn={!!session} />
}
