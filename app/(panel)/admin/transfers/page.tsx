import { notFound } from 'next/navigation'
import { requirePanelPage } from '../../_session'
import { hasTotalScope } from '@/lib/auth'
import { adminTransfers } from '@/lib/admin-transfers/server'
import { canManageTransfers, filterKey, kpisOf, matchesFilter, STUCK_DAYS, TRANSFER_FILTER_LABELS, TRANSFER_FILTERS } from '@/lib/admin-transfers/core'
import { Kpis } from '@/components/ds/Kpi'
import { TransfersAdmin } from '@/components/admin/TransfersAdmin'
import '@/components/admin/transfers-admin.css'

export const metadata = { title: 'Transferências — HouseArt' }

/** Admin › Transferências (audit 2026-10-25 §5): the off-platform transfers, what each waits for, the stuck ones; admin and manager resend the invite or cancel. */
export default async function AdminTransfersPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { user } = await requirePanelPage('/admin/transfers')
  if (!hasTotalScope(user)) notFound()
  const f = filterKey((await searchParams).f)
  const rows = await adminTransfers({ profile: user.profile })
  const k = kpisOf(rows)
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Transferências fora da plataforma</h1></div>
      <Kpis items={[
        { label: 'Em curso', value: String(k.open), note: k.feePaidOpen ? `${k.feePaidOpen} com a taxa já paga` : 'nenhuma com taxa paga' },
        { label: 'Travadas', value: String(k.stuck), note: `paradas há mais de ${STUCK_DAYS} dias no mesmo passo` },
        { label: 'Esperando KYC', value: String(k.kyc), note: 'decidir em KYC' },
        { label: 'Esperando o toque', value: String(k.tap), note: 'só o comprador, com a obra em mãos' },
      ]} />
      <TransfersAdmin rows={rows.filter((r) => matchesFilter(r, f))} filter={f} manages={canManageTransfers(user)} filters={TRANSFER_FILTERS.map((key) => ({ key, label: TRANSFER_FILTER_LABELS[key], count: rows.filter((r) => matchesFilter(r, key)).length }))} />
    </div>
  )
}
