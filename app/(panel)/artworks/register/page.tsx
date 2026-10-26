import { redirect } from 'next/navigation'
import { requirePanelPage } from '../../_session'
import { RegisterArtworkScreen, type RegisterVariant } from '@/components/collector/RegisterArtworkScreen'
import { galleryRegisterDraft } from '@/lib/gallery/register-server'
import { representedArtists } from '@/lib/gallery/artists-server'
import { artistOptionsOf, GALLERY_NEXT_STEPS, GALLERY_PROVENANCE, GALLERY_REGISTER_STEPS } from '@/lib/gallery/register-core'
import { GALLERY_SOURCE_CARDS } from '@/lib/artworks/domain'

export const metadata = { title: 'Cadastrar obra — HouseArt' }

/**
 * Cadastrar obra da galeria (handoff "HouseArt Web Galeria" › Cadastrar obra): De onde vem esta obra? ·
 * Artista · Fotos guiadas · Ficha · Revisão → Obra cadastrada. The draft is born when the artist is
 * chosen and the URL carries it (?draft=<id>), so leaving and coming back resumes where it stopped.
 * Artists have the six-step wizard; collectors have /wallet/register.
 */
export default async function GalleryRegisterPage({ searchParams }: { searchParams: Promise<{ draft?: string }> }) {
  const { scope, nav } = await requirePanelPage('/artworks/register')
  if (nav !== 'gallery' && nav !== 'advisor') redirect(nav === 'collector' ? '/wallet/register' : '/artworks/new')
  const id = Number((await searchParams).draft)
  const draft = Number.isInteger(id) && id > 0 ? await galleryRegisterDraft(scope, id) : null
  if (Number.isInteger(id) && id > 0 && !draft) redirect('/artworks')
  const artists = artistOptionsOf(await representedArtists(scope).catch(() => []))
  const variant: RegisterVariant = {
    kind: 'gallery', steps: GALLERY_REGISTER_STEPS, originCards: GALLERY_SOURCE_CARDS, originLabel: 'De onde vem esta obra',
    createUrl: '/api/gallery/artworks', resumeHref: (d) => `/artworks/register?draft=${d}`, exitHref: '/artworks', exitLabel: 'Ver no acervo',
    nextSteps: GALLERY_NEXT_STEPS, provenance: GALLERY_PROVENANCE, artists,
  }
  // keyed by the draft: going from one draft to another (or to a new register) starts the screen over
  return <div className="ha-page"><RegisterArtworkScreen key={draft?.id ?? 'new'} draft={draft} variant={variant} /></div>
}
