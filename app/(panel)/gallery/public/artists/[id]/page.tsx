// Perfil público de um artista representado sem conta, editado pela galeria (ADMIN).
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePanelPage } from '../../../../_session'
import { ContentError } from '@/lib/public-content/editor-core'
import { artistProfileView, galleryAdminTenant, representedArtistId } from '@/lib/public-content/editor-server'
import { ArtistProfileEditor } from '@/components/content-editor/ArtistProfileEditor'
import '@/components/content-editor/content-editor.css'

export const metadata = { title: 'Perfil público do artista — HouseArt' }

export default async function RepresentedArtistProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const raw = (await params).id
  const { scope } = await requirePanelPage(`/gallery/public/artists/${raw}`)
  const id = Number(raw)
  if (!Number.isInteger(id) || id <= 0 || id > 2_147_483_647) notFound()
  const artistId = await galleryAdminTenant(scope).then((t) => representedArtistId(t, id)).catch((e) => { if (e instanceof ContentError) return null; throw e })
  if (!artistId) notFound()
  const view = await artistProfileView(artistId)
  return (
    <div className="ha-page">
      <div className="ha-page__head">
        <div>
          <div className="ha-eyebrow"><Link href="/gallery/public" className="ha-link ha-link--quiet">Perfil público da galeria</Link></div>
          <h1 className="ha-h1">{view.artist.name}</h1>
        </div>
      </div>
      <ArtistProfileEditor initial={view} saveUrl={`/api/gallery/public-profile/artists/${artistId}`} uploadUrl="/api/gallery/public-profile/images" publicHref={`/e/artist/${view.artist.slug}`}
        intro="O artista ainda não tem conta: a galeria fala por ele na página pública. Quando ele entrar, passa a editar o próprio perfil." />
    </div>
  )
}
