import { notFound } from 'next/navigation'
import { requirePanelPage } from '../../_session'
import { hasTotalScope } from '@/lib/auth'
import { canApproveMembers } from '@/lib/auth/profiles'
import { adminOps } from '@/lib/admin-ops/server'
import { Kpis } from '@/components/ds/Kpi'
import { OpsAdmin } from '@/components/admin/OpsAdmin'
import '@/components/admin/ops-admin.css'

export const metadata = { title: 'Saúde operacional — HouseArt' }
export const dynamic = 'force-dynamic'

/** Admin › Saúde operacional (audit 2026-10-25 §5): the crons' trail and health, the Stripe webhooks, the finance alerts and the configuration present. */
export default async function AdminOpsPage() {
  const { user } = await requirePanelPage('/admin/ops')
  if (!hasTotalScope(user)) notFound()
  const v = await adminOps()
  const k = v.kpis
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Saúde operacional</h1></div>
      <Kpis items={[
        { label: 'Crons em dia', value: `${k.cronsOk}/${v.crons.length}`, note: k.cronsBad ? `${k.cronsBad} ${k.cronsBad === 1 ? 'precisa de atenção' : 'precisam de atenção'}` : k.cronsNever ? `${k.cronsNever} sem registro ainda` : 'todos rodaram no prazo' },
        { label: 'Webhooks com falha', value: String(k.webhookFailures7d), note: 'últimos 7 dias · a Stripe reenvia' },
        { label: 'Alertas do financeiro', value: String(k.financeAlerts), note: 'estornos e repasses sem registro, 30 dias' },
        { label: 'Configuração', value: `${v.config.filter((c) => c.ok).length}/${v.config.length}`, note: 'presença, nunca o valor' },
      ]} />
      <OpsAdmin view={v} canRun={canApproveMembers(user)} />
    </div>
  )
}
