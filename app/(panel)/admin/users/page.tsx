import { notFound } from 'next/navigation'
import { requirePanelPage } from '../../_session'
import { hasTotalScope } from '@/lib/auth'
import { adminUsers } from '@/lib/admin-users/server'
import { filterKey, kpisOf, matchesFilter, USER_FILTER_LABELS, USER_FILTERS } from '@/lib/admin-users/core'
import { Kpis } from '@/components/ds/Kpi'
import { Icon } from '@/components/ds/Icon'
import { UsersAdmin } from '@/components/admin/UsersAdmin'
import '@/components/admin/users-admin.css'

export const metadata = { title: 'Usuários e contas — HouseArt' }

/** Admin › Usuários e contas (audit 2026-10-25 §5): search, profiles, block, password link, staff role, team invite. */
export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; f?: string }> }) {
  const { user } = await requirePanelPage('/admin/users')
  if (!hasTotalScope(user)) notFound()
  const sp = await searchParams
  const q = sp.q ?? ''
  const f = filterKey(sp.f)
  const rows = await adminUsers({ id: user.id, profile: user.profile }, q)
  const k = kpisOf(rows)
  return (
    <div className="ha-page">
      <div className="ha-page__head">
        <h1 className="ha-h1">Usuários e contas</h1>
        <form className="ha-markers__search" role="search" method="get">
          <Icon name="search" size={20} />
          <input name="q" className="ha-topbar__input" placeholder="Nome, e-mail ou #id" aria-label="Buscar conta" defaultValue={q} />
          {f !== 'all' ? <input type="hidden" name="f" value={f} /> : null}
        </form>
      </div>
      <Kpis items={[
        { label: q ? 'Encontradas' : 'Contas', value: String(k.total), note: q ? `para "${q}"` : rows.length >= 200 ? 'as 200 mais novas · busque pelo nome' : 'todas' },
        { label: 'Equipe', value: String(k.staff), note: 'admin, gestor, operador, financeiro' },
        { label: 'Bloqueadas', value: String(k.blocked), note: k.deletion ? `${k.deletion} com exclusão pedida` : 'nenhuma exclusão pedida' },
        { label: 'Membros em análise', value: String(k.pendingMembers), note: 'artistas e galerias' },
      ]} />
      <UsersAdmin rows={rows.filter((r) => matchesFilter(r, f))} filter={f} query={q} viewerId={user.id} filters={USER_FILTERS.map((key) => ({ key, label: USER_FILTER_LABELS[key], count: rows.filter((r) => matchesFilter(r, key)).length }))} />
    </div>
  )
}
