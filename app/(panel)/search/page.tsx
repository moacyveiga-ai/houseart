import { requirePanelPage } from '../_session'
import { search } from '@/lib/search/server'
import { listPublicArtists } from '@/lib/public-content/server'
import { normalizeQuery } from '@/lib/search/core'
import { SearchScreen } from '@/components/search/SearchScreen'
import { collectorPanel } from '@/lib/collector-wallet/panel-server'
import { initialsOf } from '@/lib/profiles/core'
import { CollectorArtworkPanel } from '@/components/collector/CollectorArtworkPanel'
import { hasTotalScope } from '@/lib/auth'
import { adminSearch } from '@/lib/admin-search/server'
import { AdminSearchResults } from '@/components/search/AdminSearchResults'
import { recentKeyOf } from '@/components/search/recent-core'

export const metadata = { title: 'Busca — HouseArt' }

// Busca do painel (o topo do shell envia `GET /search?q=`): obras, artistas e
// galerias públicos; sem termo, as sugestões. A equipe (escopo total) vê antes os registros da
// casa em qualquer estado: obras, negócios e contas (auditoria 2026-10-25, correção 11).
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; work?: string }> }) {
  const sp = await searchParams
  const q = normalizeQuery(sp.q)
  const { user } = await requirePanelPage(q ? `/search?q=${encodeURIComponent(q)}` : '/search')
  const staff = hasTotalScope(user)
  const [result, featured, admin] = await Promise.all([search(q), q ? [] : listPublicArtists(null, 8), staff && q ? adminSearch(q) : null])
  const base = q ? `/search?q=${encodeURIComponent(q)}` : '/search'
  const panel = sp.work ? await collectorPanel(user, { work: sp.work }) : null
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Busca</h1></div>
      <SearchScreen result={result} featured={featured} recentKey={staff ? null : recentKeyOf(user.id)} workPrefix={`${base}${q ? '&' : '?'}work=`} before={admin && admin.total > 0 ? <AdminSearchResults r={admin} /> : null} />
      {panel ? <CollectorArtworkPanel key={panel.id} a={panel} meInitials={initialsOf(user.name)} meAvatarUrl={user.avatarUrl ?? null} closeHref={base} /> : null}
    </div>
  )
}
