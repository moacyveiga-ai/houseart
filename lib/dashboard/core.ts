// Dashboard — PURE: KPIs per profile and the next actions, from counts.
import { formatBRL } from '@/lib/artworks/domain'
import type { KpiData } from '@/components/ds/Kpi'

export interface DashboardCounts {
  authenticated: number
  listed: number
  soldThisYear: number
  soldThisYearCents: bigint
  inventory: number
  consigned: number
  openOffers: number
  royaltyCents: bigint
  awaitingSignature: number
  pendingMedia: number
  markersToLink: number
}

export function kpisFor(profile: 'artist' | 'gallery', c: DashboardCounts, year: number): KpiData[] {
  if (profile === 'gallery') {
    return [
      { label: 'Obras em inventário', value: String(c.inventory), note: `${c.consigned} em consignação` },
      { label: 'Certificadas', value: String(c.authenticated), note: c.inventory ? `${Math.round((c.authenticated / c.inventory) * 100)}% do inventário` : '—' },
      { label: `GMV em ${year}`, value: formatBRL(c.soldThisYearCents), note: `${c.soldThisYear} obras vendidas` },
      { label: 'Ofertas abertas', value: String(c.openOffers), note: c.openOffers ? 'responda pela sua alçada' : 'nenhuma no momento' },
    ]
  }
  return [
    { label: 'Obras certificadas', value: String(c.authenticated), note: c.awaitingSignature ? `${c.awaitingSignature} aguardando assinatura` : 'todas assinadas' },
    { label: 'À venda', value: String(c.listed), note: c.listed ? 'no marketplace' : 'nenhuma listada' },
    { label: `Vendidas em ${year}`, value: String(c.soldThisYear), note: `${formatBRL(c.soldThisYearCents)} no total` },
    { label: 'Direito de sequência', value: formatBRL(c.royaltyCents), note: 'recebido em revendas' },
  ]
}

export interface NextAction { icon: string; title: string; subtitle: string; href: string }

export function nextActionsFor(c: DashboardCounts): NextAction[] {
  const out: NextAction[] = []
  if (c.awaitingSignature) out.push({ icon: 'draw', title: 'Assinar certificado', subtitle: `${c.awaitingSignature} obra(s) com etiqueta vinculada`, href: '/certification' })
  if (c.openOffers) out.push({ icon: 'handshake', title: 'Responder ofertas', subtitle: `${c.openOffers} proposta(s) aberta(s)`, href: '/sales' })
  if (c.pendingMedia) out.push({ icon: 'add_a_photo', title: 'Completar as fotos', subtitle: `${c.pendingMedia} rascunho(s) sem a frontal ou o verso`, href: '/artworks?filter=drafts' })
  if (c.markersToLink) out.push({ icon: 'contactless', title: 'Vincular etiquetas', subtitle: `${c.markersToLink} etiqueta(s) recebida(s)`, href: '/certification' })
  return out
}

export function greetingFor(name: string, now: Date, tz = 'America/Bahia'): string {
  const hour = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: tz }).format(now))
  const part = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  return `${part}, ${name.split(' ')[0]}`
}

export function dateLabel(now: Date, tz = 'America/Bahia'): string {
  const s = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz }).format(now)
  return s.charAt(0).toUpperCase() + s.slice(1)
}
