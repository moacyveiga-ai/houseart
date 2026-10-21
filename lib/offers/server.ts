// Offers — I/O. Public creation with OTP (blind), the seller's table
// (accept/refuse/counter, all CAS on the status read), the buyer's reply and
// retraction by token, the negotiator. The floor is read here and dies here.
import 'server-only'
import { createHash, randomBytes, randomInt } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { canView, memberFilter, memberOfScope, type Scope } from '@/lib/scope/core'
import { totalScope } from '@/lib/scope/context'
import { audit } from '@/lib/audit'
import { protectDocument } from '@/lib/crypto/cipher'
import { normalizeEmail } from '@/lib/auth/credential'
import { sendEmail } from '@/lib/email/send'
import { afterResponseOrNow } from '@/lib/after'
import { ArtworkError } from '@/lib/artworks/server'
import { canTransition as artworkCanTransition } from '@/lib/artworks/state-machine'
import { notify } from '@/lib/notifications/server'
import { syncOpportunityFromOffer } from '@/lib/crm/server'
import { LIVE_STATUSES, OFFER_VALIDITY_DAYS, offerCode, OTP_MAX_ATTEMPTS, OTP_TTL_MS, RETRACTION_WINDOW_MS, type OfferStatus } from './domain'
import { evaluateOffer, mandateProblems } from './mandate-core'
import { assertTransition, statusAfterOtp } from './state'
import { toBuyerView, toSellerRow, type BuyerOffer, type OfferRow } from './dto'

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')

// ── mandate + listing ────────────────────────────────────────────────────
export async function listArtworkForSale(scope: Scope, artworkId: number, m: { listPriceCents: bigint; reservePriceCents: bigint; autoNegotiatorOn: boolean; autoAcceptMinBps: number; fixedPrice: boolean }, actor: { userId: number }) {
  const memberId = memberOfScope(scope)
  const a = await prisma.artwork.findUnique({ where: { id: artworkId }, select: { id: true, memberId: true, tenantId: true, status: true, seal: true } })
  if (!a || !canView(scope, a) || !memberId) throw new ArtworkError('NOT_FOUND', 'Obra não encontrada.', 404)
  const problems = mandateProblems(m)
  if (problems.length) throw new ArtworkError('BAD_MANDATE', problems.join(' '), 400)
  const verdict = artworkCanTransition(a.status as never, 'LISTED', { seal: a.seal })
  if (!verdict.ok) throw new ArtworkError(verdict.reason, verdict.reason === 'SEAL_REQUIRED' ? 'Só obras com o selo verde vão ao marketplace.' : 'A obra não pode ser listada neste estado.', 409)
  await prisma.$transaction(async (tx) => {
    await tx.mandate.updateMany({ where: { artworkId, status: 'ACTIVE' }, data: { status: 'SUPERSEDED' } })
    await tx.mandate.create({ data: { artworkId, memberId, listPriceCents: m.listPriceCents, reservePriceCents: m.reservePriceCents, autoNegotiatorOn: m.autoNegotiatorOn, autoAcceptMinBps: m.autoAcceptMinBps, fixedPrice: m.fixedPrice } })
    const r = await tx.artwork.updateMany({ where: { id: artworkId, status: a.status }, data: { status: 'LISTED', listPriceCents: m.listPriceCents, saleMode: m.fixedPrice ? 'FIXED' : 'FIXED_WITH_OFFERS', market: 'PRIMARY' } })
    if (r.count === 0) throw new ArtworkError('CHANGED', 'A obra acabou de mudar.', 409)
  })
  void audit.event({ entity: 'artwork', entityId: artworkId, action: 'list', userId: actor.userId, after: { listPriceCents: m.listPriceCents.toString() } })
}

export async function unlistArtwork(scope: Scope, artworkId: number) {
  const a = await prisma.artwork.findUnique({ where: { id: artworkId }, select: { memberId: true, tenantId: true, status: true } })
  if (!a || !canView(scope, a)) throw new ArtworkError('NOT_FOUND', 'Obra não encontrada.', 404)
  const r = await prisma.artwork.updateMany({ where: { id: artworkId, status: 'LISTED' }, data: { status: 'AUTHENTICATED' } })
  if (r.count === 0) throw new ArtworkError('CHANGED', 'A obra não está à venda.', 409)
  await prisma.mandate.updateMany({ where: { artworkId, status: 'ACTIVE' }, data: { status: 'CLOSED' } })
}

/** The negotiator line of the seller's screen (no floor): the latest active mandate of the scope. */
export async function negotiatorOf(scope: Scope): Promise<{ autoNegotiatorOn: boolean; autoAcceptMinBps: number } | null> {
  return prisma.mandate.findFirst({ where: { ...memberFilter(scope), status: 'ACTIVE' }, orderBy: { updatedAt: 'desc' }, select: { autoNegotiatorOn: true, autoAcceptMinBps: true } })
}

/** The seller's own mandate (the floor is theirs). Never for the buyer. */
export async function mandateOf(scope: Scope, artworkId: number) {
  const a = await prisma.artwork.findUnique({ where: { id: artworkId }, select: { memberId: true, tenantId: true } })
  if (!a || !canView(scope, a)) return null
  return prisma.mandate.findFirst({ where: { artworkId, status: 'ACTIVE' } })
}

// ── public: start (OTP) ───────────────────────────────────────────────────
export interface PublicOfferInput { publicId: string; buyerName: string; buyerEmail: string; buyerDocument: string; buyerCity?: string | null; offeredCents: bigint; message?: string | null; buyerKind?: 'COLLECTOR' | 'ADVISOR_FOR_CLIENT'; buyerUserId?: number | null }

export async function startPublicOffer(i: PublicOfferInput): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  return totalScope('offers:public-start', async () => {
    const email = normalizeEmail(i.buyerEmail)
    if (!email) return { ok: false, error: 'Informe um e-mail válido.' }
    if (i.offeredCents <= 0n) return { ok: false, error: 'Informe o valor da proposta.' }
    let doc
    try { doc = protectDocument(i.buyerDocument) } catch { return { ok: false, error: 'CPF/CNPJ inválido.' } }
    const a = await prisma.artwork.findUnique({ where: { publicId: i.publicId }, select: { id: true, memberId: true, status: true, seal: true, mandates: { where: { status: 'ACTIVE' }, select: { id: true, fixedPrice: true, listPriceCents: true } } } })
    if (!a || a.status !== 'LISTED' || a.seal !== 'GREEN') return { ok: false, error: 'Esta obra não está aceitando propostas.' }
    const mandate = a.mandates[0]
    if (mandate?.fixedPrice && i.offeredCents !== mandate.listPriceCents) return { ok: false, error: 'Esta obra é vendida a preço fixo.' }
    const year = new Date().getUTCFullYear()
    const seq = await prisma.offer.count({ where: { code: { startsWith: `OFR-${year}-` } } })
    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0')
    const offer = await prisma.offer.create({
      data: {
        code: offerCode(year, seq + 1), artworkId: a.id, mandateId: mandate?.id ?? null, sellerMemberId: a.memberId, memberId: a.memberId,
        buyerUserId: i.buyerUserId ?? null, buyerName: i.buyerName.trim().slice(0, 120), buyerEmail: email, buyerDocumentHash: doc.hash, buyerDocumentEnc: doc.enc, buyerDocumentMask: doc.mask,
        buyerKind: i.buyerKind ?? 'COLLECTOR', buyerCity: i.buyerCity?.trim().slice(0, 80) || null, offeredCents: i.offeredCents, message: i.message?.trim().slice(0, 500) || null,
        status: 'AWAITING_OTP', expiresAt: new Date(Date.now() + OFFER_VALIDITY_DAYS * 86_400_000), otpHash: sha256(otp), otpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
        events: { create: { kind: 'CREATED', actorKind: 'BUYER', payloadJson: JSON.stringify({ offeredCents: i.offeredCents.toString() }) } },
      },
    })
    await afterResponseOrNow('offer:otp', () => sendEmail({ to: email, subject: 'Confirme sua proposta na HouseArt', text: `Seu código para confirmar a proposta ${offer.code} é ${otp}. Ele vale por 15 minutos.`, redactedPreview: 'OTP da proposta' }))
    return { ok: true, code: offer.code }
  })
}

/** OTP confirmation: routes RECEIVED/BELOW_RESERVE, runs the negotiator, notifies the seller, syncs the CRM. */
export async function confirmPublicOffer(code: string, otp: string): Promise<{ ok: true; retractionToken: string } | { ok: false; error: string }> {
  return totalScope('offers:public-confirm', async () => {
    const o = await prisma.offer.findUnique({ where: { code }, include: { mandate: true, artwork: { select: { title: true, year: true, listPriceCents: true, member: { select: { userId: true, user: { select: { email: true } } } } } } } })
    if (!o || o.status !== 'AWAITING_OTP' || !o.otpHash) return { ok: false, error: 'Proposta não encontrada ou já confirmada.' }
    const bumped = await prisma.offer.update({ where: { id: o.id }, data: { otpAttempts: { increment: 1 } } })
    if (bumped.otpAttempts > OTP_MAX_ATTEMPTS) { await prisma.offer.updateMany({ where: { id: o.id, status: 'AWAITING_OTP' }, data: { status: 'CANCELLED' } }); return { ok: false, error: 'Código inválido. A proposta foi cancelada; envie outra.' } }
    if (!o.otpExpiresAt || o.otpExpiresAt < new Date() || sha256(otp.replace(/\D/g, '')) !== o.otpHash) return { ok: false, error: 'Código inválido ou expirado.' }
    const engine = o.mandate ? evaluateOffer(o.mandate, o.offeredCents) : { verdict: 'ABOVE_RESERVE' as const, reachesReserve: true }
    const next: OfferStatus = engine.verdict === 'AUTO_ACCEPT' ? 'ACCEPTED' : statusAfterOtp(engine.reachesReserve)
    const retractionToken = randomBytes(24).toString('base64url')
    await prisma.$transaction(async (tx) => {
      const r = await tx.offer.updateMany({ where: { id: o.id, status: 'AWAITING_OTP' }, data: { status: next, otpHash: null, retractionTokenHash: sha256(retractionToken), retractionIssuedAt: new Date(), acceptedCents: next === 'ACCEPTED' ? o.offeredCents : null } })
      if (r.count === 0) throw new ArtworkError('CHANGED', 'A proposta acabou de mudar.', 409)
      await tx.offerRound.create({ data: { offerId: o.id, number: 1, author: 'BUYER', amountCents: o.offeredCents, message: o.message } })
      await tx.offerEvent.create({ data: { offerId: o.id, kind: 'CONFIRMED', actorKind: 'BUYER' } })
      if (next === 'ACCEPTED') {
        await tx.offerEvent.create({ data: { offerId: o.id, kind: 'NEGOTIATOR_ACCEPTED', actorKind: 'NEGOTIATOR' } })
      } else if (engine.counterCents) {
        await tx.offer.update({ where: { id: o.id }, data: { status: 'NEGOTIATING' } })
        await tx.offerRound.create({ data: { offerId: o.id, number: 2, author: 'NEGOTIATOR', amountCents: engine.counterCents } })
        await tx.offerEvent.create({ data: { offerId: o.id, kind: 'COUNTERED', actorKind: 'NEGOTIATOR', payloadJson: JSON.stringify({ amountCents: engine.counterCents.toString() }) } })
      }
    })
    const seller = o.artwork.member
    const title = `${o.artwork.title}${o.artwork.year ? `, ${o.artwork.year}` : ''}`
    await notify({ userId: seller.userId, email: seller.user?.email, kind: next === 'ACCEPTED' ? 'offer.auto_accepted' : 'offer.received', title: next === 'ACCEPTED' ? `Proposta aceita pelo negociador · ${title}` : `Nova proposta · ${title}`, body: `Proposta ${o.code}`, href: '/sales', emailSubject: next === 'ACCEPTED' ? 'O negociador aceitou uma proposta' : 'Você recebeu uma proposta na HouseArt' })
    await notify({ userId: o.buyerUserId, email: o.buyerEmail, kind: 'offer.confirmed', title: `Proposta ${o.code} enviada`, body: next === 'ACCEPTED' ? 'Sua proposta foi aceita.' : engine.counterCents ? 'O vendedor respondeu com uma contraproposta.' : 'Sua proposta foi recebida.', href: `/e/offer/${o.code}`, emailSubject: 'Sua proposta foi registrada' })
    await syncOpportunityFromOffer(o.id)
    return { ok: true, retractionToken }
  })
}

// ── seller's table ───────────────────────────────────────────────────────
export async function sellerOffers(scope: Scope, now = new Date()): Promise<OfferRow[]> {
  const rows = await prisma.offer.findMany({
    where: { ...memberFilter(scope), status: { notIn: ['DRAFT', 'AWAITING_OTP'] } },
    include: { artwork: { select: { title: true, year: true, listPriceCents: true, media: { where: { kind: 'FRONT_COLOR_CARD' }, select: { publicUrl: true }, take: 1 } } }, rounds: { orderBy: { number: 'asc' } } },
    orderBy: [{ createdAt: 'desc' }], take: 200,
  })
  return rows.map((r) => toSellerRow(r, now))
}

async function reachableOffer(scope: Scope, id: number) {
  const o = await prisma.offer.findUnique({ where: { id }, include: { rounds: { orderBy: { number: 'asc' } }, artwork: { select: { id: true, memberId: true, tenantId: true, title: true, year: true, listPriceCents: true } } } })
  if (!o || !canView(scope, o.artwork)) throw new ArtworkError('NOT_FOUND', 'Proposta não encontrada.', 404)
  return o
}

/** Accept under an advisory lock per artwork: a second live offer on the same artwork is refused. */
export async function acceptOffer(scope: Scope, id: number, actor: { userId: number }) {
  const o = await reachableOffer(scope, id)
  assertTransition(o.status as OfferStatus, 'ACCEPTED')
  const last = o.rounds[o.rounds.length - 1]
  const amount = last?.amountCents ?? o.offeredCents
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${1_000_000 + o.artworkId})`
    const live = await tx.offer.count({ where: { artworkId: o.artworkId, status: { in: [...LIVE_STATUSES] }, id: { not: id } } })
    if (live > 0) throw new ArtworkError('ARTWORK_LOCKED', 'Outra proposta desta obra já foi aceita.', 409)
    const r = await tx.offer.updateMany({ where: { id, status: o.status }, data: { status: 'ACCEPTED', acceptedCents: amount } })
    if (r.count === 0) throw new ArtworkError('CHANGED', 'A proposta acabou de mudar.', 409)
    await tx.offerEvent.create({ data: { offerId: id, kind: 'ACCEPTED', actorKind: 'SELLER', actorUserId: actor.userId, payloadJson: JSON.stringify({ amountCents: amount.toString() }) } })
  })
  await notify({ userId: o.buyerUserId, email: o.buyerEmail, kind: 'offer.accepted', title: `Proposta ${o.code} aceita`, body: 'Você tem 24 h para pagar em garantia.', href: `/e/offer/${o.code}`, emailSubject: 'Sua proposta foi aceita' })
  await syncOpportunityFromOffer(id)
  void audit.event({ entity: 'offer', entityId: id, action: 'accept', userId: actor.userId })
}

export async function refuseOffer(scope: Scope, id: number, actor: { userId: number }, reason?: string) {
  const o = await reachableOffer(scope, id)
  assertTransition(o.status as OfferStatus, 'REFUSED')
  const r = await prisma.offer.updateMany({ where: { id, status: o.status }, data: { status: 'REFUSED' } })
  if (r.count === 0) throw new ArtworkError('CHANGED', 'A proposta acabou de mudar.', 409)
  await prisma.offerEvent.create({ data: { offerId: id, kind: 'REFUSED', actorKind: 'SELLER', actorUserId: actor.userId, payloadJson: JSON.stringify({ reason: reason?.slice(0, 200) ?? null }) } })
  await notify({ userId: o.buyerUserId, email: o.buyerEmail, kind: 'offer.refused', title: `Proposta ${o.code} recusada`, href: `/e/offer/${o.code}`, emailSubject: 'Resposta à sua proposta' })
  await syncOpportunityFromOffer(id)
}

/** Seller counter-offer: must be ≥ the floor (the message never says the number of the floor). */
export async function counterOffer(scope: Scope, id: number, amountCents: bigint, actor: { userId: number }, message?: string) {
  const o = await reachableOffer(scope, id)
  // A counter while already NEGOTIATING is another round, not a transition.
  if (o.status !== 'NEGOTIATING') assertTransition(o.status as OfferStatus, 'NEGOTIATING')
  const mandate = await prisma.mandate.findFirst({ where: { artworkId: o.artworkId, status: 'ACTIVE' } })
  if (amountCents <= 0n) throw new ArtworkError('BAD_AMOUNT', 'Informe o valor.', 400)
  if (mandate && amountCents < mandate.reservePriceCents) throw new ArtworkError('BELOW_MANDATE', 'A contraproposta precisa respeitar o mandato da obra.', 409)
  const number = (o.rounds[o.rounds.length - 1]?.number ?? 0) + 1
  await prisma.$transaction(async (tx) => {
    const r = await tx.offer.updateMany({ where: { id, status: o.status }, data: { status: 'NEGOTIATING' } })
    if (r.count === 0) throw new ArtworkError('CHANGED', 'A proposta acabou de mudar.', 409)
    await tx.offerRound.create({ data: { offerId: id, number, author: 'SELLER', amountCents, message: message?.slice(0, 500) ?? null } })
    await tx.offerEvent.create({ data: { offerId: id, kind: 'COUNTERED', actorKind: 'SELLER', actorUserId: actor.userId, payloadJson: JSON.stringify({ amountCents: amountCents.toString() }) } })
  })
  await notify({ userId: o.buyerUserId, email: o.buyerEmail, kind: 'offer.countered', title: `Contraproposta em ${o.code}`, href: `/e/offer/${o.code}`, emailSubject: 'Você recebeu uma contraproposta' })
  await syncOpportunityFromOffer(id)
}

// ── buyer by token ───────────────────────────────────────────────────────
export async function buyerOffer(code: string, token: string | null, now = new Date()): Promise<BuyerOffer | null> {
  return totalScope('offers:buyer', async () => {
    const o = await prisma.offer.findUnique({ where: { code }, include: { rounds: { orderBy: { number: 'asc' } }, artwork: { select: { title: true, year: true, listPriceCents: true, media: { where: { kind: 'FRONT_COLOR_CARD' }, select: { publicUrl: true }, take: 1 } } } } })
    if (!o || o.status === 'AWAITING_OTP' || !token || !o.retractionTokenHash || sha256(token) !== o.retractionTokenHash) return null
    return toBuyerView(o, now)
  })
}

export async function retractOffer(code: string, token: string): Promise<boolean> {
  return totalScope('offers:retract', async () => {
    const o = await prisma.offer.findUnique({ where: { code } })
    if (!o || !o.retractionTokenHash || sha256(token) !== o.retractionTokenHash || !o.retractionIssuedAt) return false
    if (Date.now() - o.retractionIssuedAt.getTime() > RETRACTION_WINDOW_MS) return false
    if (!['RECEIVED', 'BELOW_RESERVE', 'NEGOTIATING'].includes(o.status)) return false
    const r = await prisma.offer.updateMany({ where: { id: o.id, status: o.status }, data: { status: 'RETRACTED' } })
    if (r.count === 0) return false
    await prisma.offerEvent.create({ data: { offerId: o.id, kind: 'RETRACTED', actorKind: 'BUYER' } })
    await syncOpportunityFromOffer(o.id)
    return true
  })
}

/** Buyer replies to a counter-offer: accepts the seller's number (→ ACCEPTED at that amount) or counters again. */
export async function buyerReply(code: string, token: string, reply: { accept: true } | { accept: false; amountCents: bigint; message?: string }): Promise<boolean> {
  return totalScope('offers:buyer-reply', async () => {
    const o = await prisma.offer.findUnique({ where: { code }, include: { rounds: { orderBy: { number: 'asc' } } } })
    if (!o || !o.retractionTokenHash || sha256(token) !== o.retractionTokenHash || o.status !== 'NEGOTIATING') return false
    const last = o.rounds[o.rounds.length - 1]
    if (!last || last.author === 'BUYER') return false
    const number = last.number + 1
    if (reply.accept) {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${1_000_000 + o.artworkId})`
        const live = await tx.offer.count({ where: { artworkId: o.artworkId, status: { in: [...LIVE_STATUSES] }, id: { not: o.id } } })
        if (live > 0) throw new ArtworkError('ARTWORK_LOCKED', 'Outra proposta desta obra já foi aceita.', 409)
        const r = await tx.offer.updateMany({ where: { id: o.id, status: 'NEGOTIATING' }, data: { status: 'ACCEPTED', acceptedCents: last.amountCents } })
        if (r.count === 0) throw new ArtworkError('CHANGED', 'A proposta acabou de mudar.', 409)
        await tx.offerRound.create({ data: { offerId: o.id, number, author: 'BUYER', amountCents: last.amountCents, message: 'Aceito a contraproposta.' } })
        await tx.offerEvent.create({ data: { offerId: o.id, kind: 'BUYER_REPLIED', actorKind: 'BUYER', payloadJson: JSON.stringify({ accepted: true }) } })
      })
    } else {
      if (reply.amountCents <= 0n) return false
      await prisma.$transaction(async (tx) => {
        await tx.offerRound.create({ data: { offerId: o.id, number, author: 'BUYER', amountCents: reply.amountCents, message: reply.message?.slice(0, 500) ?? null } })
        await tx.offerEvent.create({ data: { offerId: o.id, kind: 'BUYER_REPLIED', actorKind: 'BUYER', payloadJson: JSON.stringify({ amountCents: reply.amountCents.toString() }) } })
      })
    }
    const seller = await prisma.member.findUnique({ where: { id: o.sellerMemberId }, select: { userId: true, user: { select: { email: true } } } })
    await notify({ userId: seller?.userId ?? null, email: seller?.user?.email, kind: 'offer.buyer_replied', title: `Resposta do comprador em ${o.code}`, href: '/sales', emailSubject: 'O comprador respondeu' })
    await syncOpportunityFromOffer(o.id)
    return true
  })
}

/** Expires what passed its validity (cron). */
export async function expireOffers(now = new Date()): Promise<number> {
  const rows = await prisma.offer.findMany({ where: { status: { in: ['RECEIVED', 'BELOW_RESERVE', 'NEGOTIATING'] }, expiresAt: { lt: now } }, select: { id: true, status: true } })
  let n = 0
  for (const r of rows) {
    const u = await prisma.offer.updateMany({ where: { id: r.id, status: r.status }, data: { status: 'EXPIRED' } })
    if (u.count) { n++; await prisma.offerEvent.create({ data: { offerId: r.id, kind: 'EXPIRED', actorKind: 'SYSTEM' } }); await syncOpportunityFromOffer(r.id) }
  }
  return n
}
