// "Galeria · painel do dia" (Phase 6) — I/O: the KPIs of the month, open
// offers, escrow, views, and the actions of the day, from the existing readers.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { memberFilter, type Scope } from '@/lib/scope/core'
import { sellerOffers } from '@/lib/offers/server'
import { sellerDeals } from '@/lib/deals/server'
import { flagOn } from '@/lib/flags'
import { tenantOfScope } from '@/lib/scope/core'
import { unansweredConversations } from '@/lib/messaging/server'
import { AGENDA_KIND_LABELS, type AgendaKind } from '@/lib/public-content/domain'
import { panelKpis, type PanelKpi } from './domain'
import { viewsSinceMany } from './listing-server'
import { agendaOf, certificationActions, draftsAction, offerSub, unansweredAction, type AgendaItem, type AgendaSource, type PanelAction } from './panel-core'

export type { AgendaItem, PanelAction } from './panel-core'
export interface DayPanel { kpis: PanelKpi[]; actions: PanelAction[]; agenda: AgendaItem[]; monthName: string }

const brl = (c: bigint) => Number(c / 100n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

function startOfMonthInTz(now: Date): Date {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit' }).formatToParts(now)
  const y = parts.find((p) => p.type === 'year')!.value, m = parts.find((p) => p.type === 'month')!.value
  return new Date(`${y}-${m}-01T03:00:00Z`)
}

function todayInTz(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Bahia', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const g = (t: string) => parts.find((p) => p.type === t)!.value
  return `${g('year')}-${g('month')}-${g('day')}`
}

/**
 * The Agenda of the panel: the gallery's own event posts (openings), the events the person
 * confirmed (RSVP on a post or on the house agenda) and the agenda entries the gallery posted.
 * Upcoming only, from today in the house's zone.
 */
async function agendaFor(scope: Scope, userId: number | null, now: Date): Promise<AgendaItem[]> {
  const tenantId = tenantOfScope(scope)
  const today = todayInTz(now)
  const ownWhere = scope.kind === 'member' ? { authorMemberId: scope.memberId } : tenantId ? { tenantId } : null
  const [own, rsvps] = await Promise.all([
    ownWhere ? prisma.post.findMany({ where: { ...ownWhere, kind: 'EVENT', hiddenAt: null, eventStartsOn: { gte: today } }, orderBy: { eventStartsOn: 'asc' }, take: 10, select: { id: true, eventTitle: true, eventVenue: true, eventStartsOn: true, eventStartsAt: true } }) : [],
    userId ? prisma.reaction.findMany({ where: { userId, kind: 'RSVP', targetKind: { in: ['POST', 'EVENT'] } }, select: { targetKind: true, targetId: true } }) : [],
  ])
  const postIds = rsvps.filter((r) => r.targetKind === 'POST').map((r) => r.targetId)
  const eventIds = rsvps.filter((r) => r.targetKind === 'EVENT').map((r) => r.targetId)
  const [going, events] = await Promise.all([
    postIds.length ? prisma.post.findMany({ where: { id: { in: postIds }, kind: 'EVENT', hiddenAt: null, eventStartsOn: { gte: today } }, select: { id: true, eventTitle: true, eventVenue: true, eventStartsOn: true, eventStartsAt: true } }) : [],
    prisma.agendaEvent.findMany({ where: { startsOn: { gte: today }, OR: [...(eventIds.length ? [{ id: { in: eventIds } }] : []), ...(tenantId ? [{ tenantId }] : [])] }, orderBy: { startsOn: 'asc' }, take: 10, select: { id: true, kind: true, title: true, venue: true, city: true, startsOn: true } }),
  ])
  const post = (p: { id: number; eventTitle: string | null; eventVenue: string | null; eventStartsOn: string | null; eventStartsAt: string | null }, kind: 'OPENING' | 'GOING'): AgendaSource | null =>
    p.eventStartsOn ? { key: `p${p.id}`, startsOn: p.eventStartsOn, title: p.eventTitle ?? 'Evento', sub: [p.eventVenue, p.eventStartsAt].filter(Boolean).join(' · ') || 'Evento da comunidade', kind, href: '/community?tab=events' } : null
  const sources: AgendaSource[] = [
    ...own.map((p) => post(p, 'OPENING')).filter((x): x is AgendaSource => !!x),
    ...going.map((p) => post(p, 'GOING')).filter((x): x is AgendaSource => !!x),
    ...events.map((e) => ({ key: `e${e.id}`, startsOn: e.startsOn, title: e.title, sub: `${AGENDA_KIND_LABELS[e.kind as AgendaKind] ?? e.kind} · ${e.venue}${e.city ? ` · ${e.city}` : ''}`, kind: eventIds.includes(e.id) ? 'GOING' as const : 'AGENDA' as const, href: '/community?tab=events' })),
  ]
  return agendaOf(sources, today)
}

/** `userId`: the person at the desk — their RSVPs and the conversations waiting on them. */
export async function dayPanel(scope: Scope, now = new Date(), userId: number | null = null): Promise<DayPanel> {
  const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'America/Bahia' }).format(now)
  const offers = await sellerOffers(scope, now)
  const deals = flagOn('FLAG_DEALS') ? await sellerDeals(scope) : []
  const since = startOfMonthInTz(now)
  const monthDeals = await prisma.deal.findMany({ where: { ...memberFilter(scope), createdAt: { gte: since } }, select: { amountCents: true } })
  const open = offers.filter((o) => o.open)
  const escrow = deals.filter((d) => d.escrowPaid && d.phase !== 'COMPLETED').reduce((a, d) => a + d.amountCents, 0n)
  const artworkIds = await prisma.artwork.findMany({ where: { ...memberFilter(scope), status: 'LISTED' }, select: { id: true } })
  let views7d = 0
  for (const v of (await viewsSinceMany(artworkIds.map((a) => a.id), 7, now)).values()) views7d += v
  const kpis = panelKpis({ monthSalesCents: monthDeals.reduce((a, d) => a + d.amountCents, 0n), monthSalesCount: monthDeals.length, openOffers: open.length, biggestOpenOfferCents: open.length ? open.reduce((m, o) => (o.currentCents > m ? o.currentCents : m), 0n) : null, escrowCents: escrow, views7d }, monthName)
  const actions: PanelAction[] = []
  for (const o of open) actions.push({ icon: 'request_quote', title: `Oferta de ${brl(o.currentCents)}`, sub: offerSub(o), tag: `expira em ${o.expiresIn}`, tone: 'pending', href: '/sales' })
  for (const o of offers.filter((x) => x.status === 'ACCEPTED')) actions.push({ icon: 'hourglass_top', title: 'Aguardando pagamento', sub: `${o.artworkTitle} · ${o.buyer}`, tag: 'até 24 h', tone: 'neutral', href: '/sales?tab=deals' })
  for (const d of deals.filter((x) => x.phase === 'ESCROW' && !x.sellerSigned)) actions.push({ icon: 'draw', title: 'Confirmar venda', sub: `${d.artworkTitle} · vendida para ${d.buyerName}`, tag: 'hoje', tone: 'alert', href: `/sales?tab=deals&sale=${d.id}` })
  for (const d of deals.filter((x) => x.phase === 'DOCUMENTS')) actions.push({ icon: 'inventory_2', title: 'Embalar e registrar o envio', sub: `${d.artworkTitle} · vendida para ${d.buyerName}`, tag: 'hoje', tone: 'alert', href: `/sales?tab=deals&sale=${d.id}` })
  const [waiting, inCert, drafts, agenda] = await Promise.all([
    userId ? unansweredConversations(userId) : [],
    prisma.artwork.findMany({ where: { ...memberFilter(scope), status: 'IN_CERTIFICATION' }, orderBy: { submittedAt: 'asc' }, take: 200, select: { id: true, title: true, year: true, publicId: true, certificate: { select: { signedAt: true, issuedAt: true } } } }),
    prisma.artwork.count({ where: { ...memberFilter(scope), status: 'DRAFT' } }),
    agendaFor(scope, userId, now),
  ])
  const unanswered = unansweredAction(waiting.map((w) => w.name))
  if (unanswered) actions.push(unanswered)
  actions.push(...certificationActions(inCert.map((a) => ({ id: a.id, title: `${a.title}${a.year ? `, ${a.year}` : ''}`, linked: !!a.publicId, signed: !!a.certificate?.signedAt, issued: !!a.certificate?.issuedAt }))))
  const draft = draftsAction(drafts)
  if (draft) actions.push(draft)
  return { kpis, actions, agenda, monthName }
}
