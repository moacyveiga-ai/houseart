import { requirePanelPage } from '../_session'
import { search } from '@/lib/search/server'
import { listPublicArtists } from '@/lib/public-content/server'
import { normalizeQuery } from '@/lib/search/core'
import { SearchScreen } from '@/components/search/SearchScreen'

export const metadata = { title: 'Busca — HouseArt' }

// Busca do painel (o topo do shell envia `GET /search?q=`): obras, artistas e
// galerias públicos; sem termo, as sugestões.
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = normalizeQuery((await searchParams).q)
  await requirePanelPage(q ? `/search?q=${encodeURIComponent(q)}` : '/search')
  const [result, featured] = await Promise.all([search(q), q ? [] : listPublicArtists(null, 8)])
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Busca</h1></div>
      <SearchScreen result={result} featured={featured} />
    </div>
  )
}
