import { notFound } from 'next/navigation'
import { requirePanelPage } from '../../_session'
import { hasTotalScope } from '@/lib/auth'
import { adminCatalog } from '@/lib/admin-catalog/server'
import { canEditCatalog } from '@/lib/admin-catalog/core'
import { Kpis } from '@/components/ds/Kpi'
import { CatalogAdmin } from '@/components/admin/CatalogAdmin'
import '@/components/admin/catalog-admin.css'

export const metadata = { title: 'Catálogo — HouseArt' }

/** Admin › Catálogo (audit 2026-10-25 §5): the plans, the services and the marker price, edited by admin and manager; the rest of the staff reads. */
export default async function AdminCatalogPage() {
  const { user } = await requirePanelPage('/admin/catalog')
  if (!hasTotalScope(user)) notFound()
  const { plans, services } = await adminCatalog()
  const kit = services.find((s) => s.code === 'TAG_KIT')
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Catálogo</h1></div>
      <p className="ha-muted ha-sm">Preços e limites valem para o que for contratado daqui em diante: assinatura em curso, pedido pago e taxa já cobrada ficam como estão. Toda alteração vai à auditoria.</p>
      <Kpis items={[
        { label: 'Planos ativos', value: String(plans.filter((p) => p.active).length), note: `${plans.reduce((n, p) => n + p.activeSubscriptions, 0)} assinaturas vivas` },
        { label: 'Serviços ativos', value: String(services.filter((s) => s.active).length), note: `${services.reduce((n, s) => n + s.orders30d, 0)} pedidos em 30 dias` },
        { label: 'Etiqueta NFC', value: kit ? `R$ ${(Number(kit.priceCents) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—', note: kit ? (kit.active ? 'por unidade, no kit do artista' : 'kit desligado') : 'sem linha TAG_KIT' },
      ]} />
      <CatalogAdmin plans={plans} services={services} edits={canEditCatalog(user)} />
    </div>
  )
}
