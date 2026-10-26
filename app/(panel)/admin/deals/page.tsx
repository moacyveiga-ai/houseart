import { notFound } from 'next/navigation'
import { requirePanelPage } from '../../_session'
import { hasTotalScope } from '@/lib/auth'
import { adminDeals } from '@/lib/admin-deals/server'
import { DEAL_FILTER_LABELS, DEAL_FILTERS, dealKpis, filterKey, matchesFilter } from '@/lib/admin-deals/core'
import { formatBRL } from '@/lib/artworks/domain'
import { Kpis } from '@/components/ds/Kpi'
import { DealsAdmin } from '@/components/admin/DealsAdmin'
import '@/components/admin/deals-admin.css'

export const metadata = { title: 'Negócios — HouseArt' }

/** Admin › Negócios (audit 2026-10-25): every deal of the house, the guarantee, the payouts, and what the desk does about them. */
export default async function AdminDealsPage({ searchParams }: { searchParams: Promise<{ f?: string; deal?: string }> }) {
  const { user } = await requirePanelPage('/admin/deals')
  if (!hasTotalScope(user)) notFound()
  const sp = await searchParams
  const f = filterKey(sp.f)
  const openId = /^\d{1,9}$/.test(sp.deal ?? '') ? Number(sp.deal) : null
  const rows = await adminDeals()
  const k = dealKpis(rows)
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Negócios</h1></div>
      <Kpis items={[
        { label: 'Em andamento', value: String(k.open), note: `${formatBRL(k.escrowCents)} em garantia` },
        { label: 'Repasses a fazer', value: String(k.releasedCount), note: `${formatBRL(k.releasedCents)} liberados e não pagos` },
        { label: 'Repasses com falha', value: String(k.failed), note: k.failed ? 'a Stripe recusou · Tentar de novo' : 'nenhum' },
        { label: 'Em disputa', value: String(k.disputes), note: k.disputes ? 'aguardam a equipe' : 'nenhuma' },
      ]} />
      <DealsAdmin rows={rows.filter((d) => matchesFilter(d, f))} filter={f} openId={openId} filters={DEAL_FILTERS.map((key) => ({ key, label: DEAL_FILTER_LABELS[key], count: rows.filter((d) => matchesFilter(d, key)).length }))} />
    </div>
  )
}
