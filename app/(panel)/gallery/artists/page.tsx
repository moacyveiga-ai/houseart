import { requirePanelPage } from '../../_session'
import { representedArtists } from '@/lib/gallery/artists-server'
import { ArtistsScreen } from '@/components/gallery/ArtistsScreen'
import '@/components/gallery/artists.css'

export const metadata = { title: 'Artistas representados — HouseArt' }

export default async function GalleryArtistsPage() {
  const { scope } = await requirePanelPage('/gallery/artists')
  const artists = await representedArtists(scope)
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Artistas representados</h1></div>
      <ArtistsScreen artists={artists} />
    </div>
  )
}
