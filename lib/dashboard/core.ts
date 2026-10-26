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

// ---- "Vendas em {ano}" (handoff "Web Artista" › Início): one bar per month from January to the
// current month, the current one in sand; the caption "R$ 268 mil em 11 obras".
export const MONTH_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const

/** "R$ 980", "R$ 1,5 mil", "R$ 12 mil", "R$ 268 mil", "R$ 1,2 mi" — the short reais of the chart; the band is chosen AFTER rounding (R$ 999.999 is "R$ 1 mi", never "R$ 1.000 mil"). */
export function shortBRL(cents: bigint): string {
  const reais = Number(cents / 100n)
  const mi = Math.round(reais / 100_000) / 10
  if (mi >= 1) return `R$ ${mi.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (reais < 1_000) return `R$ ${reais.toLocaleString('pt-BR')}`
  const mil = reais < 10_000 ? Math.round(reais / 100) / 10 : Math.round(reais / 1_000)
  return `R$ ${mil.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
}

export interface SalesBar { month: string; count: number; cents: bigint; label: string; pct: number; current: boolean }
export interface SalesChart { bars: SalesBar[]; total: string; empty: boolean }

/**
 * Deals completed this year, bucketed by the month of `day` (YYYY-MM-DD in the house timezone).
 * `currentMonth` is 1–12; the chart runs from January to it (the prototype draws jan–out in October).
 */
export function salesChart(sales: { day: string; amountCents: bigint }[], year: number, currentMonth: number): SalesChart {
  const months = Math.min(12, Math.max(1, currentMonth))
  const bars: SalesBar[] = Array.from({ length: months }, (_, i) => ({ month: MONTH_SHORT[i], count: 0, cents: 0n, label: '', pct: 0, current: i === months - 1 }))
  let totalCents = 0n, totalCount = 0
  for (const s of sales) {
    const [y, m] = s.day.split('-').map(Number)
    if (y !== year || !m || m > months) continue
    const b = bars[m - 1]
    b.count += 1; b.cents += s.amountCents; totalCents += s.amountCents; totalCount += 1
  }
  const max = bars.reduce((acc, b) => (b.cents > acc ? b.cents : acc), 0n)
  for (const b of bars) {
    b.pct = max > 0n ? Math.max(b.cents > 0n ? 4 : 0, Math.round(Number((b.cents * 100n) / max))) : 0
    b.label = b.cents > 0n ? shortBRL(b.cents) : ''
  }
  return { bars, total: totalCount ? `${shortBRL(totalCents)} em ${totalCount} ${totalCount === 1 ? 'obra' : 'obras'}` : 'Nenhuma venda concluída ainda', empty: totalCount === 0 }
}
