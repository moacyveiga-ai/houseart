import { notFound } from 'next/navigation'
import { requirePanelPage } from '../../_session'
import { hasTotalScope } from '@/lib/auth'
import { adminKyc } from '@/lib/admin-kyc/server'
import { canDecideKyc, filterKey, KYC_FILTER_LABELS, KYC_FILTERS, matchesFilter } from '@/lib/admin-kyc/core'
import { Kpis } from '@/components/ds/Kpi'
import { KycAdmin } from '@/components/admin/KycAdmin'
import '@/components/admin/kyc-admin.css'

export const metadata = { title: 'KYC — HouseArt' }

/** Admin › KYC (audit 2026-10-25 §5): the identity queue; admin and manager decide, the rest of the team reads. */
export default async function AdminKycPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { user } = await requirePanelPage('/admin/kyc')
  if (!hasTotalScope(user)) notFound()
  const f = filterKey((await searchParams).f)
  const { rows, kpis: k } = await adminKyc({ profile: user.profile })
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">KYC · verificação de identidade</h1></div>
      <Kpis items={[
        { label: 'Na fila', value: String(k.pending), note: k.waiting ? `${k.waiting} ${k.waiting === 1 ? 'transferência esperando' : 'transferências esperando'}` : 'nenhuma transferência esperando' },
        { label: 'Aprovadas', value: String(k.approved), note: k.expired ? `${k.expired} vencidas` : 'nenhuma vencida' },
        { label: 'Reprovadas', value: String(k.rejected), note: 'só a mais recente de cada pessoa' },
        { label: 'Alerta PEP', value: String(k.pep), note: 'pessoa exposta politicamente' },
      ]} />
      <KycAdmin rows={rows.filter((r) => matchesFilter(r, f))} filter={f} decides={canDecideKyc(user)} filters={KYC_FILTERS.map((key) => ({ key, label: KYC_FILTER_LABELS[key], count: rows.filter((r) => matchesFilter(r, key)).length }))} />
    </div>
  )
}
