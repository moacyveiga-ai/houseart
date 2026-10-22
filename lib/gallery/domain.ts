// Gallery operation (Phase 6, handoff "Web Galeria" / "App Galeria") — PURE allowlists and labels.
export const TEAM_ROLES = ['ADMIN', 'SALES', 'INVENTORY'] as const
export type TeamRole = (typeof TEAM_ROLES)[number]
export const TEAM_ROLE_LABELS: Record<TeamRole, { name: string; sub: string }> = {
  ADMIN: { name: 'Admin', sub: 'Diretora · todas as permissões' },
  SALES: { name: 'Vendas', sub: 'Vendas · ofertas, mensagens e vendas' },
  INVENTORY: { name: 'Acervo', sub: 'Acervo · cadastro, fotos e certificação' },
}
export const INVITE_TTL_DAYS = 7

export const CONTRACT_KINDS = ['REPRESENTED', 'CONSIGNMENT'] as const
export type ContractKind = (typeof CONTRACT_KINDS)[number]
export const CONTRACT_KIND_LABELS: Record<ContractKind, string> = { REPRESENTED: 'Representado', CONSIGNMENT: 'Consignação' }

export * from '@/lib/offers/rules-core'

/** Panel KPIs and actions (pure) — fed by the server with the counts. */
export interface PanelInput {
  monthSalesCents: bigint; monthSalesCount: number
  openOffers: number; biggestOpenOfferCents: bigint | null
  escrowCents: bigint
  views7d: number
}
export interface PanelKpi { key: string; label: string; value: string; detail: string; icon: string; href: string; dark?: true }
const brl = (c: bigint) => Number(c / 100n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
export function panelKpis(i: PanelInput, monthName: string): PanelKpi[] {
  return [
    { key: 'sales', label: `Vendas em ${monthName}`, value: brl(i.monthSalesCents), detail: `${i.monthSalesCount} ${i.monthSalesCount === 1 ? 'obra' : 'obras'}`, icon: 'trending_up', href: '/sales?tab=deals', dark: true },
    { key: 'offers', label: 'Ofertas abertas', value: String(i.openOffers), detail: i.biggestOpenOfferCents ? `maior: ${brl(i.biggestOpenOfferCents)}` : 'nenhuma agora', icon: 'request_quote', href: '/sales' },
    { key: 'escrow', label: 'Em garantia', value: brl(i.escrowCents), detail: 'libera na entrega', icon: 'lock', href: '/sales?tab=deals' },
    { key: 'views', label: 'Visualizações', value: i.views7d.toLocaleString('pt-BR'), detail: 'acervo · últimos 7 dias', icon: 'visibility', href: '/artworks' },
  ]
}
