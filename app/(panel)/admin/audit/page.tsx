import { notFound } from 'next/navigation'
import { requirePanelPage } from '../../_session'
import { hasTotalScope } from '@/lib/auth'
import { adminAudit } from '@/lib/admin-audit/server'
import { parseQuery } from '@/lib/admin-audit/core'
import { Kpis } from '@/components/ds/Kpi'
import { AuditAdmin } from '@/components/admin/AuditAdmin'
import '@/components/admin/audit-admin.css'

export const metadata = { title: 'Auditoria — HouseArt' }

/** Admin › Auditoria (audit 2026-10-25 §5): the trail every write leaves, read-only, with filters in the URL. */
export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { user } = await requirePanelPage('/admin/audit')
  if (!hasTotalScope(user)) notFound()
  const q = parseQuery(await searchParams)
  const page = await adminAudit(q)
  const k = page.kpis
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Auditoria</h1></div>
      <Kpis items={[
        { label: 'Últimas 24 h', value: k.today.toLocaleString('pt-BR'), note: 'registros' },
        { label: 'Últimos 7 dias', value: k.week.toLocaleString('pt-BR'), note: k.entities[0] ? `mais em ${k.entities[0].label}` : 'nenhum registro' },
        { label: 'Neste filtro', value: page.total.toLocaleString('pt-BR'), note: page.pages > 1 ? `${page.pages} páginas` : 'uma página' },
      ]} />
      <AuditAdmin query={q} page={page} />
    </div>
  )
}
