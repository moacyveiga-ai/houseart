// Perfil público do artista (o próprio): o que /e/artist/[slug] mostra.
import { notFound } from 'next/navigation'
import { requirePanelPage } from '../../_session'
import { ContentError } from '@/lib/public-content/editor-core'
import { artistProfileView, ownArtistId } from '@/lib/public-content/editor-server'
import { ArtistProfileEditor } from '@/components/content-editor/ArtistProfileEditor'
import '@/components/content-editor/content-editor.css'

export const metadata = { title: 'Perfil público — HouseArt' }

export default async function ArtistPublicProfilePage() {
  const { scope } = await requirePanelPage('/profile/public')
  const artistId = await ownArtistId(scope).catch((e) => { if (e instanceof ContentError) return null; throw e })
  if (!artistId) notFound()
  const view = await artistProfileView(artistId)
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Perfil público</h1></div>
      <ArtistProfileEditor initial={view} saveUrl="/api/artist/profile" uploadUrl="/api/artist/profile/images" publicHref={`/e/artist/${view.artist.slug}`}
        intro="O que colecionadores e galerias leem na sua página de artista. As obras certificadas à venda entram sozinhas." />
    </div>
  )
}
