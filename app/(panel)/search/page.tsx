import { requirePanelPage } from '../_session'
import { search } from '@/lib/search/server'
import { listPublicArtists } from '@/lib/public-content/server'
import { normalizeQuery } from '@/lib/search/core'
import { SearchScreen } from '@/components/search/SearchScreen'
import { collectorPanel } from '@/lib/collector-wallet/panel-server'
import { CollectorArtworkPanel } from '@/components/collector/CollectorArtworkPanel'

export const metadata = { title: 'Busca — HouseArt' }

// Busca do painel (o topo do shell envia `GET /search?q=`): obras, artistas e
// galerias públicos; sem termo, as sugestões.
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; work?: string }> }) {
  const sp = await searchParams
  const q = normalizeQuery(sp.q)
  const { user } = await requirePanelPage(q ? `/search?q=${encodeURIComponent(q)}` : '/search')
  const [result, featured] = await Promise.all([search(q), q ? [] : listPublicArtists(null, 8)])
  const base = q ? `/search?q=${encodeURIComponent(q)}` : '/search'
  const panel = sp.work ? await collectorPanel(user.id, { work: sp.work }) : null
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Busca</h1></div>
      <SearchScreen result={result} featured={featured} workPrefix={`${base}${q ? '&' : '?'}work=`} />
      {panel ? <CollectorArtworkPanel key={panel.id} a={panel} closeHref={base} /> : null}
    </div>
  )
}
