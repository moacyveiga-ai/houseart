import { notFound } from 'next/navigation'
import { requirePanelPage } from '../../_session'
import { hasTotalScope } from '@/lib/auth'
import { adminTenants } from '@/lib/admin-tenants/server'
import { canManageTenants, filterKey, kpisOf, matchesFilter, TENANT_FILTER_LABELS, TENANT_FILTERS } from '@/lib/admin-tenants/core'
import { Kpis } from '@/components/ds/Kpi'
import { Icon } from '@/components/ds/Icon'
import { TenantsAdmin } from '@/components/admin/TenantsAdmin'
import '@/components/admin/tenants-admin.css'

export const metadata = { title: 'Galerias e contas — HouseArt' }

/** Admin › Galerias e contas (audit 2026-10-25 §5): every tenant with plan, team, contracts and inventory; admin and manager grant plans and suspend. */
export default async function AdminTenantsPage({ searchParams }: { searchParams: Promise<{ q?: string; f?: string }> }) {
  const { user } = await requirePanelPage('/admin/tenants')
  if (!hasTotalScope(user)) notFound()
  const sp = await searchParams
  const q = sp.q ?? ''
  const f = filterKey(sp.f)
  const { rows, plans } = await adminTenants({ profile: user.profile }, q)
  const k = kpisOf(rows)
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Galerias e contas</h1></div>
      <form className="ha-atenants__search" action="/admin/tenants" method="get" role="search">
        <label className="ha-field__label" htmlFor="tenant-q">Buscar</label>
        <div className="ha-atenants__searchrow">
          <input id="tenant-q" className="ha-input" name="q" defaultValue={q} placeholder="nome, endereço público, razão social ou #id" />
          {f !== 'all' ? <input type="hidden" name="f" value={f} /> : null}
          <button type="submit" className="ha-btn ha-btn--secondary ha-btn--md"><Icon name="search" /> Buscar</button>
        </div>
      </form>
      <Kpis items={[
        { label: 'Galerias', value: String(k.galleries), note: k.pendingInvites ? `${k.pendingInvites} ${k.pendingInvites === 1 ? 'convite de equipe pendente' : 'convites de equipe pendentes'}` : 'nenhum convite pendente' },
        { label: 'Autônomos', value: String(k.persons), note: 'artistas, consultores e colecionadores' },
        { label: 'Com plano pago', value: String(k.paid), note: k.pastDue ? `${k.pastDue} em atraso` : 'nenhum em atraso' },
        { label: 'Suspensas', value: String(k.suspended), note: 'sem painel e fora do site' },
      ]} />
      <TenantsAdmin rows={rows.filter((r) => matchesFilter(r, f))} plans={plans} filter={f} query={q} manages={canManageTenants(user)} filters={TENANT_FILTERS.map((key) => ({ key, label: TENANT_FILTER_LABELS[key], count: rows.filter((r) => matchesFilter(r, key)).length }))} />
    </div>
  )
}
