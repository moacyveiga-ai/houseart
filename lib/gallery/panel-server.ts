// "Galeria · painel do dia" (Phase 6) — I/O: the KPIs of the month, open
// offers, escrow, views, and the actions of the day, from the existing readers.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { memberFilter, type Scope } from '@/lib/scope/core'
import { sellerOffers } from '@/lib/offers/server'
import { sellerDeals } from '@/lib/deals/server'
import { flagOn } from '@/lib/flags'
import { panelKpis, type PanelKpi } from './domain'
import { viewsSince } from './listing-server'

export interface PanelAction { icon: string; title: string; sub: string; tag: string; tone: 'pending' | 'alert' | 'neutral'; href: string }
export interface DayPanel { kpis: PanelKpi[]; actions: PanelAction[]; monthName: string }

const brl = (c: bigint) => Number(c / 100n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

function startOfMonthInTz(now: Date): Date {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit' }).formatToParts(now)
  const y = parts.find((p) => p.type === 'year')!.value, m = parts.find((p) => p.type === 'month')!.value
  return new Date(`${y}-${m}-01T03:00:00Z`)
}

export async function dayPanel(scope: Scope, now = new Date()): Promise<DayPanel> {
  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'America/Bahia' }).format(now)
  const offers = await sellerOffers(scope, now)
  const deals = flagOn('FLAG_DEALS') ? await sellerDeals(scope) : []
  const since = startOfMonthInTz(now)
  const monthDeals = await prisma.deal.findMany({ where: { ...memberFilter(scope), createdAt: { gte: since } }, select: { amountCents: true } })
  const open = offers.filter((o) => o.open)
  const escrow = deals.filter((d) => d.escrowPaid && d.phase !== 'COMPLETED').reduce((a, d) => a + d.amountCents, 0n)
  const artworkIds = await prisma.artwork.findMany({ where: { ...memberFilter(scope), status: 'LISTED' }, select: { id: true } })
  let views7d = 0
  for (const a of artworkIds) views7d += await viewsSince(a.id, 7, now)
  const kpis = panelKpis({ monthSalesCents: monthDeals.reduce((a, d) => a + d.amountCents, 0n), monthSalesCount: monthDeals.length, openOffers: open.length, biggestOpenOfferCents: open.length ? open.reduce((m, o) => (o.currentCents > m ? o.currentCents : m), 0n) : null, escrowCents: escrow, views7d }, monthName)
  const actions: PanelAction[] = []
  for (const o of open) actions.push({ icon: 'request_quote', title: `Oferta de ${brl(o.currentCents)}`, sub: `${o.artworkTitle} · ${o.buyer}${o.differenceLabel ? ` · ${o.differenceLabel}` : ''}`, tag: `expira em ${o.expiresIn}`, tone: 'pending', href: '/sales' })
  for (const o of offers.filter((x) => x.status === 'ACCEPTED')) actions.push({ icon: 'hourglass_top', title: 'Aguardando pagamento', sub: `${o.artworkTitle} · ${o.buyer}`, tag: 'até 24 h', tone: 'neutral', href: '/sales?tab=deals' })
  for (const d of deals.filter((x) => x.phase === 'ESCROW' && !x.sellerSigned)) actions.push({ icon: 'draw', title: 'Assinar o termo de transferência', sub: `${d.artworkTitle} · vendida para ${d.buyerName}`, tag: 'hoje', tone: 'alert', href: '/sales?tab=deals' })
  for (const d of deals.filter((x) => x.phase === 'DOCUMENTS')) actions.push({ icon: 'inventory_2', title: 'Embalar e agendar a coleta', sub: `${d.artworkTitle} · vendida para ${d.buyerName}`, tag: 'hoje', tone: 'alert', href: '/sales?tab=deals' })
  const inCert = await prisma.artwork.count({ where: { ...memberFilter(scope), status: 'IN_CERTIFICATION' } })
  if (inCert) actions.push({ icon: 'verified', title: `${inCert} ${inCert === 1 ? 'obra' : 'obras'} em certificação`, sub: 'Vincule a etiqueta e assine o certificado', tag: 'pendente', tone: 'neutral', href: '/certification' })
  return { kpis, actions, monthName }
}
