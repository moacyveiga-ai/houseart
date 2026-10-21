// CRM — I/O: contacts deduped per tenant by e-mail, opportunities on the
// Kanban, and the sync from offers (an offer confirmed = an opportunity in
// "Proposta"; accepted = Fechado/WON; refused/expired = Fechado/LOST).
import 'server-only'
import { prisma } from '@/lib/prisma'
import { canView, memberFilter, memberOfScope, tenantOfScope, type Scope } from '@/lib/scope/core'
import { totalScope } from '@/lib/scope/context'
import { ArtworkError } from '@/lib/artworks/server'
import { initials, STAGES, STAGE_LABELS, stageOfOfferStatus, whenLabel, type Stage } from './core'

export async function syncOpportunityFromOffer(offerId: number): Promise<void> {
  await totalScope('crm:sync-offer', async () => {
    const o = await prisma.offer.findUnique({ where: { id: offerId }, include: { artwork: { select: { title: true, year: true } }, rounds: { orderBy: { number: 'desc' }, take: 1 } } })
    if (!o) return
    const tenantId = o.tenantId ?? (await prisma.member.findUnique({ where: { id: o.sellerMemberId }, select: { tenantId: true } }))?.tenantId ?? null
    if (!tenantId) return
    const contact = await prisma.contact.upsert({
      where: { tenantId_email: { tenantId, email: o.buyerEmail } },
      create: { memberId: o.sellerMemberId, name: o.buyerName, email: o.buyerEmail, documentHash: o.buyerDocumentHash, city: o.buyerCity, origin: 'OFFER' },
      update: { name: o.buyerName, city: o.buyerCity ?? undefined },
    })
    const { stage, outcome } = stageOfOfferStatus(o.status)
    const valueCents = o.acceptedCents ?? o.rounds[0]?.amountCents ?? o.offeredCents
    const interest = `Proposta em “${o.artwork.title}${o.artwork.year ? `, ${o.artwork.year}` : ''}”`
    const existing = await prisma.opportunity.findFirst({ where: { offerId: o.id } })
    if (existing) await prisma.opportunity.update({ where: { id: existing.id }, data: { stage, outcome, valueCents, interest, lastActivityAt: new Date() } })
    else await prisma.opportunity.create({ data: { contactId: contact.id, memberId: o.sellerMemberId, artworkId: o.artworkId, offerId: o.id, stage, outcome, valueCents, interest } })
  })
}

export interface KanbanCard { id: number; initials: string; name: string; interest: string; value: string; when: string; stage: Stage }

export async function kanban(scope: Scope, now = new Date()): Promise<{ columns: { stage: Stage; label: string; cards: KanbanCard[] }[] }> {
  const rows = await prisma.opportunity.findMany({ where: { ...memberFilter(scope), OR: [{ stage: { not: 'CLOSED' } }, { updatedAt: { gte: new Date(now.getTime() - 90 * 86_400_000) } }] }, include: { contact: { select: { name: true } } }, orderBy: { lastActivityAt: 'desc' }, take: 500 })
  const cards: KanbanCard[] = rows.map((r) => ({
    id: r.id, initials: initials(r.contact.name), name: r.contact.name, interest: r.interest ?? '—',
    value: r.valueCents === null ? 'sob consulta' : Number(r.valueCents / 100n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }),
    when: whenLabel(r.lastActivityAt, now), stage: r.stage as Stage,
  }))
  return { columns: STAGES.map((stage) => ({ stage, label: STAGE_LABELS[stage], cards: cards.filter((c) => c.stage === stage) })) }
}

export async function moveOpportunity(scope: Scope, id: number, stage: Stage, outcome: 'WON' | 'LOST' | null = null) {
  const o = await prisma.opportunity.findUnique({ where: { id }, select: { memberId: true, tenantId: true, stage: true } })
  if (!o || !canView(scope, o)) throw new ArtworkError('NOT_FOUND', 'Oportunidade não encontrada.', 404)
  const r = await prisma.opportunity.updateMany({ where: { id, stage: o.stage }, data: { stage, outcome: stage === 'CLOSED' ? outcome : null, lastActivityAt: new Date() } })
  if (r.count === 0) throw new ArtworkError('CHANGED', 'A oportunidade acabou de mudar.', 409)
}

export async function createContact(scope: Scope, c: { name: string; email?: string | null; phone?: string | null; city?: string | null; interest?: string | null; valueCents?: bigint | null }) {
  const memberId = memberOfScope(scope)
  const tenantId = tenantOfScope(scope)
  if (!memberId || !tenantId) throw new ArtworkError('NO_MEMBER', 'Só membros têm CRM.', 403)
  const email = c.email?.trim().toLowerCase() || null
  const contact = email
    ? await prisma.contact.upsert({ where: { tenantId_email: { tenantId, email } }, create: { memberId, name: c.name, email, phone: c.phone ?? null, city: c.city ?? null }, update: { name: c.name, phone: c.phone ?? undefined, city: c.city ?? undefined } })
    : await prisma.contact.create({ data: { memberId, name: c.name, phone: c.phone ?? null, city: c.city ?? null } })
  const opp = await prisma.opportunity.create({ data: { contactId: contact.id, memberId, stage: 'INTERESTED', interest: c.interest ?? null, valueCents: c.valueCents ?? null } })
  return { contact, opportunity: opp }
}
