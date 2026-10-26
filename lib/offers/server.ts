// Offers — I/O. Public creation with OTP (blind), the seller's table
// (accept/refuse/counter, all CAS on the status read), the buyer's reply and
// retraction by token, the negotiator. The floor is read here and dies here.
import 'server-only'
import { isSecondaryOrigin } from '@/lib/artworks/domain'
import { createHash, randomBytes, randomInt } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { canView, memberFilter, memberOfScope, type Scope } from '@/lib/scope/core'
import { totalScope } from '@/lib/scope/context'
import { audit } from '@/lib/audit'
import { protectDocument } from '@/lib/crypto/cipher'
import { normalizeEmail } from '@/lib/auth/credential'
import { sendEmail } from '@/lib/email/send'
import { afterResponseOrNow } from '@/lib/after'
import { flagOn } from '@/lib/flags'
import { ArtworkError } from '@/lib/artworks/server'
import { canTransition as artworkCanTransition } from '@/lib/artworks/state-machine'
import { notify } from '@/lib/notifications/server'
import { systemLine, openConversationWith } from '@/lib/messaging/server'
import { formatBRL as formatReais } from '@/lib/format'
const formatBRL = (c: bigint) => formatReais(Number(c) / 100, { casas: 0 })
import { syncOpportunityFromOffer } from '@/lib/crm/server'
import { cancelUnpaidDeal, createDealFromOffer, startEscrowPayment } from '@/lib/deals/server'
import { boletoBillingProblem, type BoletoBilling, type EscrowMethod, type PaymentInstructions } from '@/lib/payments/async-core'
import { LIVE_STATUSES, OFFER_VALIDITY_DAYS, offerCode, OTP_MAX_ATTEMPTS, OTP_TTL_MS, RETRACTION_WINDOW_MS, type OfferStatus } from './domain'
import { evaluateOffer, mandateProblems } from './mandate-core'
import { cheapest, insuranceCents, normalizeCep, quoteShipping, ufFromCep } from '@/lib/shipping/quote-core'
import { usableCard } from '@/lib/payment-methods/server'
import { GUARANTEE_METHODS, VALIDITY_HOURS, type GuaranteeMethod } from '@/lib/payment-methods/domain'
import { authorizeHold, cancelHold, captureHold, stripeMode } from '@/lib/stripe/door'
import { holdSettlement, isStripeRef } from '@/lib/stripe/mode-core'
import { rulesOfMember } from './rules-server'
import { OFFER_ROLES, requireSellerRole } from './seller-role-server'
import { belowRule, LOW_OFFER_MESSAGE } from './rules-core'
import { assertTransition, statusAfterOtp } from './state'
import { toBuyerView, toSellerRow, type BuyerOffer, type OfferRow } from './dto'

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')

// ── mandate + listing ────────────────────────────────────────────────────
export async function listArtworkForSale(scope: Scope, artworkId: number, m: { listPriceCents: bigint; reservePriceCents: bigint; autoNegotiatorOn: boolean; autoAcceptMinBps: number; fixedPrice: boolean }, actor: { userId: number }) {
  const memberId = memberOfScope(scope)
  const a = await prisma.artwork.findUnique({ where: { id: artworkId }, select: { id: true, memberId: true, tenantId: true, status: true, seal: true, market: true, acquisitionKind: true, member: { select: { kind: true, tenantId: true } } } })
  if (!a || !canView(scope, a) || !memberId) throw new ArtworkError('NOT_FOUND', 'Obra não encontrada.', 404)
  // Secondary market: an artwork that already changed hands, one a collector registered as theirs, or a
  // gallery's resale for a collector. A consignment, the gallery's own stock or "outro" is a first sale.
  const market = a.market === 'SECONDARY' || a.member.kind === 'COLLECTOR' || isSecondaryOrigin(a.acquisitionKind) ? 'SECONDARY' : 'PRIMARY'
  const problems = mandateProblems(m)
  if (problems.length) throw new ArtworkError('BAD_MANDATE', problems.join(' '), 400)
  const verdict = artworkCanTransition(a.status as never, 'LISTED', { seal: a.seal })
  if (!verdict.ok) throw new ArtworkError(verdict.reason, verdict.reason === 'SEAL_REQUIRED' ? 'Só obras com o selo verde vão ao marketplace.' : 'A obra não pode ser listada neste estado.', 409)
  await prisma.$transaction(async (tx) => {
    await tx.mandate.updateMany({ where: { artworkId, status: 'ACTIVE' }, data: { status: 'SUPERSEDED' } })
    await tx.mandate.create({ data: { artworkId, memberId, listPriceCents: m.listPriceCents, reservePriceCents: m.reservePriceCents, autoNegotiatorOn: m.autoNegotiatorOn, autoAcceptMinBps: m.autoAcceptMinBps, fixedPrice: m.fixedPrice } })
    const r = await tx.artwork.updateMany({ where: { id: artworkId, status: a.status }, data: { status: 'LISTED', listPriceCents: m.listPriceCents, saleMode: m.fixedPrice ? 'FIXED' : 'FIXED_WITH_OFFERS', market } })
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
export interface PublicOfferInput {
  publicId: string; buyerName: string; buyerEmail: string; buyerDocument: string; buyerCity?: string | null; offeredCents: bigint; message?: string | null; buyerKind?: 'COLLECTOR' | 'ADVISOR_FOR_CLIENT'; buyerUserId?: number | null
  /** Phase 4: validity in hours (24/48/72; absent = 7 days), the guarantee and the saved card it uses, the delivery CEP for the frozen quote. */
  validityHours?: number | null
  guaranteeMethod?: string | null
  paymentMethodId?: number | null
  deliveryCep?: string | null
}

/** The quote frozen at the offer/purchase: cheapest carrier for the CEP + transit insurance. */
export async function quoteForArtwork(artworkId: number | { publicId: string }, cep: string | null, priceCents: bigint): Promise<{ shippingCents: bigint; insuranceCents: bigint; cep: string | null }> {
  const norm = cep ? normalizeCep(cep) : null
  if (!norm) return { shippingCents: 0n, insuranceCents: 0n, cep: null }
  const a = await prisma.artwork.findUnique({ where: typeof artworkId === 'number' ? { id: artworkId } : { publicId: artworkId.publicId }, select: { heightMm: true, widthMm: true, depthMm: true, member: { select: { uf: true } } } })
  if (!a) return { shippingCents: 0n, insuranceCents: 0n, cep: norm }
  const quotes = quoteShipping({ fromUf: a.member.uf, toUf: ufFromCep(norm), size: { heightMm: a.heightMm, widthMm: a.widthMm, depthMm: a.depthMm } })
  const shipping = quotes && quotes.length ? BigInt(cheapest(quotes).priceCents) : 0n
  return { shippingCents: shipping, insuranceCents: BigInt(insuranceCents(Number(priceCents))), cep: norm }
}

type Reserved = { ok: true; method: GuaranteeMethod; ref: string | null; paymentMethodId: number | null; status: 'AUTHORIZED' | null }

/**
 * Reserves the guarantee. Mock: a mock_hold_ reference (as before). Test/live:
 * a PaymentIntent with capture_method=manual AUTHORIZED on the saved card —
 * captured on accept, cancelled on refuse/expire/retract (`settleHold`). The
 * Pix reserve has no real provider yet (refused in test/live).
 */
async function reserveGuarantee(method: string | null | undefined, buyerUserId: number | null, paymentMethodId: number | null | undefined, amountCents: bigint, artworkId: number): Promise<Reserved | { ok: false; error: string }> {
  const m = (method && (GUARANTEE_METHODS as readonly string[]).includes(method) ? method : 'NONE') as GuaranteeMethod
  if (m === 'NONE' || m === 'TRANSFER_ON_ACCEPT') return { ok: true, method: m, ref: null, paymentMethodId: null, status: null }
  if (!buyerUserId) return { ok: false, error: 'Entre na sua conta para reservar a garantia.' }
  if (stripeMode() !== 'mock') {
    if (m !== 'CARD_HOLD') return { ok: false, error: 'A reserva por Pix ainda não está disponível. Escolha o cartão ou a transferência na aceitação.' }
    const card = await usableCard(buyerUserId, paymentMethodId ?? null)
    if (!card) return { ok: false, error: 'Cadastre um cartão na carteira para reservar o valor.' }
    try {
      const h = await authorizeHold({ amountCents, description: 'Garantia de proposta · HouseArt', payerUserId: buyerUserId, paymentMethodId: card.id, idempotencyKey: `offer-hold:${artworkId}:${buyerUserId}:${randomBytes(9).toString('base64url')}`, metadata: { kind: 'offer_guarantee', artworkId: String(artworkId) } })
      return { ok: true, method: m, ref: h.ref, paymentMethodId: h.paymentMethodId, status: 'AUTHORIZED' }
    } catch (e) {
      if (e instanceof ArtworkError) return { ok: false, error: e.message }
      throw e
    }
  }
  if (m === 'CARD_HOLD') {
    const card = await usableCard(buyerUserId, paymentMethodId ?? null)
    if (!card) return { ok: false, error: 'Cadastre um cartão na carteira para reservar o valor.' }
    return { ok: true, method: m, ref: `mock_hold_${card.id}_${amountCents}_${Date.now()}`, paymentMethodId: card.id, status: null }
  }
  return { ok: true, method: m, ref: `mock_pixres_${buyerUserId}_${amountCents}_${Date.now()}`, paymentMethodId: null, status: null }
}

/**
 * Settles the Stripe card hold of an offer (test/live): `accepted` captures the
 * accepted amount (a hold smaller than it is released — `holdSettlement`),
 * `released` cancels it. Mock references and offers without a hold are a no-op.
 * Never throws: the decision on the offer stands; a Stripe failure is written
 * on the offer (guaranteeStatus FAILED + event) and the deal asks the escrow
 * payment as usual. Runs BEFORE createDealFromOffer (it reads the status).
 */
async function settleHold(offerId: number, outcome: 'accepted' | 'released'): Promise<void> {
  const o = await prisma.offer.findUnique({ where: { id: offerId }, select: { guaranteeRef: true, guaranteeStatus: true, offeredCents: true, acceptedCents: true } })
  if (!o || !isStripeRef(o.guaranteeRef) || o.guaranteeStatus !== 'AUTHORIZED') return
  const plan = outcome === 'accepted' ? holdSettlement(o.offeredCents, o.acceptedCents ?? o.offeredCents) : { action: 'release' as const }
  let to: 'CAPTURED' | 'CANCELLED' | 'FAILED'
  try {
    if (plan.action === 'capture') { await captureHold(o.guaranteeRef, plan.amountCents); to = 'CAPTURED' }
    else { to = await cancelHold(o.guaranteeRef) }
  } catch (e) {
    to = 'FAILED'
    console.warn('[stripe] garantia da proposta', offerId, (e as { code?: string })?.code ?? (e as Error)?.name)
  }
  const r = await prisma.offer.updateMany({ where: { id: offerId, guaranteeStatus: 'AUTHORIZED' }, data: { guaranteeStatus: to } })
  if (r.count) await prisma.offerEvent.create({ data: { offerId, kind: to === 'CAPTURED' ? 'GUARANTEE_CAPTURED' : to === 'CANCELLED' ? 'GUARANTEE_RELEASED' : 'GUARANTEE_FAILED', actorKind: 'SYSTEM' } })
}

export async function startPublicOffer(i: PublicOfferInput): Promise<{ ok: true; code: string; confirmed: boolean; retractionToken?: string } | { ok: false; error: string }> {
  return totalScope('offers:public-start', async () => {
    const email = normalizeEmail(i.buyerEmail)
    if (!email) return { ok: false, error: 'Informe um e-mail válido.' }
    if (i.offeredCents <= 0n) return { ok: false, error: 'Informe o valor da proposta.' }
    let doc
    try { doc = protectDocument(i.buyerDocument) } catch { return { ok: false, error: 'CPF/CNPJ inválido.' } }
    const a = await prisma.artwork.findUnique({ where: { publicId: i.publicId }, select: { id: true, memberId: true, status: true, seal: true, member: { select: { tenant: { select: { status: true } } } }, mandates: { where: { status: 'ACTIVE' }, select: { id: true, fixedPrice: true, listPriceCents: true } } } })
    if (!a || a.status !== 'LISTED' || a.seal !== 'GREEN' || a.member.tenant.status !== 'ACTIVE') return { ok: false, error: 'Esta obra não está aceitando propostas.' }
    const mandate = a.mandates[0]
    if (mandate?.fixedPrice && i.offeredCents !== mandate.listPriceCents) return { ok: false, error: 'Esta obra é vendida a preço fixo.' }
    const validityHours = i.validityHours && (VALIDITY_HOURS as readonly number[]).includes(i.validityHours) ? i.validityHours : OFFER_VALIDITY_DAYS * 24
    const quote = await quoteForArtwork(a.id, i.deliveryCep ?? null, i.offeredCents)
    const guarantee = await reserveGuarantee(i.guaranteeMethod, i.buyerUserId ?? null, i.paymentMethodId, i.offeredCents, a.id)
    if (!guarantee.ok) return guarantee
    // An authorized hold never outlives an offer that failed to be written.
    const releaseOnFailure = async (e: unknown): Promise<never> => { if (isStripeRef(guarantee.ref)) await cancelHold(guarantee.ref).catch(() => null); throw e }
    const year = new Date().getUTCFullYear()
    const seq = await prisma.offer.count({ where: { code: { startsWith: `OFR-${year}-` } } })
    const otp = String(randomInt(0, 1_000_000)).padStart(6, '0')
    // A logged buyer who already proved this e-mail (signup code, social login) skips the second code.
    const verifiedUser = i.buyerUserId ? await prisma.user.findUnique({ where: { id: i.buyerUserId }, select: { email: true, emailVerifiedAt: true } }) : null
    const skipOtp = !!verifiedUser && !!verifiedUser.emailVerifiedAt && verifiedUser.email === email
    const offer = await prisma.offer.create({
      data: {
        code: offerCode(year, seq + 1), artworkId: a.id, mandateId: mandate?.id ?? null, sellerMemberId: a.memberId, memberId: a.memberId,
        buyerUserId: i.buyerUserId ?? null, buyerName: i.buyerName.trim().slice(0, 120), buyerEmail: email, buyerDocumentHash: doc.hash, buyerDocumentEnc: doc.enc, buyerDocumentMask: doc.mask,
        buyerKind: i.buyerKind ?? 'COLLECTOR', buyerCity: i.buyerCity?.trim().slice(0, 80) || null, offeredCents: i.offeredCents, message: i.message?.trim().slice(0, 500) || null,
        status: 'AWAITING_OTP', expiresAt: new Date(Date.now() + validityHours * 3_600_000), otpHash: skipOtp ? null : sha256(otp), otpExpiresAt: skipOtp ? null : new Date(Date.now() + OTP_TTL_MS),
        validityHours, guaranteeMethod: guarantee.method, guaranteeRef: guarantee.ref, guaranteeStatus: guarantee.status, paymentMethodId: guarantee.paymentMethodId, deliveryCep: quote.cep, shippingCents: quote.shippingCents, insuranceCents: quote.insuranceCents,
        events: { create: { kind: 'CREATED', actorKind: 'BUYER', payloadJson: JSON.stringify({ offeredCents: i.offeredCents.toString(), guaranteeMethod: guarantee.method, validityHours }) } },
      },
    }).catch(releaseOnFailure)
    if (skipOtp) {
      // The logged buyer already proved the e-mail at signup: no second code.
      const r = await finalizeOffer(offer.id)
      if (!r.ok) return r
      return { ok: true, code: offer.code, confirmed: true, retractionToken: r.retractionToken }
    }
    await afterResponseOrNow('offer:otp', () => sendEmail({ to: email, subject: 'Confirme sua proposta na HouseArt', text: `Seu código para confirmar a proposta ${offer.code} é ${otp}. Ele vale por 15 minutos.`, redactedPreview: 'OTP da proposta' }))
    return { ok: true, code: offer.code, confirmed: false }
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
    return finalizeOffer(o.id)
  })
}

/** After the e-mail is proven (OTP, or verified account): routes the status, runs the negotiator, notifies, syncs the CRM, opens the deal. */
async function finalizeOffer(offerId: number): Promise<{ ok: true; retractionToken: string } | { ok: false; error: string }> {
  return totalScope('offers:finalize', async () => {
    const o = await prisma.offer.findUnique({ where: { id: offerId }, include: { mandate: true, artwork: { select: { title: true, year: true, listPriceCents: true, member: { select: { userId: true, user: { select: { email: true } } } } } } } })
    if (!o || o.status !== 'AWAITING_OTP') return { ok: false, error: 'Proposta não encontrada ou já confirmada.' }
    // Phase 6: the gallery's rule refuses low offers at once, with a gentle message (never the floor).
    const rules = await rulesOfMember(o.sellerMemberId)
    const listPrice = o.mandate?.listPriceCents ?? o.artwork.listPriceCents ?? 0n
    if (rules.refuseLow && belowRule(o.offeredCents, listPrice, rules.refuseBelowBps)) {
      const retractionToken = randomBytes(24).toString('base64url')
      await prisma.$transaction(async (tx) => {
        const r = await tx.offer.updateMany({ where: { id: o.id, status: 'AWAITING_OTP' }, data: { status: 'REFUSED', otpHash: null, retractionTokenHash: sha256(retractionToken), retractionIssuedAt: new Date() } })
        if (r.count === 0) throw new ArtworkError('CHANGED', 'A proposta acabou de mudar.', 409)
        await tx.offerRound.create({ data: { offerId: o.id, number: 1, author: 'BUYER', amountCents: o.offeredCents, message: o.message } })
        await tx.offerEvent.create({ data: { offerId: o.id, kind: 'CONFIRMED', actorKind: 'BUYER' } })
        await tx.offerEvent.create({ data: { offerId: o.id, kind: 'REFUSED', actorKind: 'SYSTEM', payloadJson: JSON.stringify({ reason: 'BELOW_GALLERY_RULE' }) } })
      })
      await settleHold(o.id, 'released')
      await notify({ userId: o.buyerUserId, email: o.buyerEmail, kind: 'offer.refused', title: `Proposta ${o.code} não aceita`, body: LOW_OFFER_MESSAGE, href: `/e/offer/${o.code}`, emailSubject: 'Resposta à sua proposta' })
      return { ok: true, retractionToken }
    }
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
    if (rules.notifyTeam && seller.userId) {
      const team = await prisma.member.findMany({ where: { tenantId: o.tenantId ?? -1, kind: 'GALLERY_STAFF', status: 'ACTIVE', role: { in: ['ADMIN', 'SALES'] }, user: { id: { not: seller.userId } } }, select: { user: { select: { id: true, email: true } } } })
      for (const m of team) if (m.user) await notify({ userId: m.user.id, email: m.user.email, kind: 'offer.received', title: `Nova proposta · ${title}`, body: `Proposta ${o.code}`, href: '/sales', emailSubject: 'Nova proposta na galeria' })
    }
    await systemLine({ buyerUserId: o.buyerUserId, artworkId: o.artworkId, kind: 'OFFER', offerId: o.id, body: next === 'ACCEPTED' ? `Proposta de ${formatBRL(o.offeredCents)} aceita pelo negociador.` : `Proposta enviada: ${formatBRL(o.offeredCents)}.` })
    if (next !== 'ACCEPTED' && engine.counterCents) await systemLine({ buyerUserId: o.buyerUserId, artworkId: o.artworkId, kind: 'COUNTER', offerId: o.id, body: `Contraproposta do vendedor: ${formatBRL(engine.counterCents)}.` })
    await notify({ userId: o.buyerUserId, email: o.buyerEmail, kind: 'offer.confirmed', title: `Proposta ${o.code} enviada`, body: next === 'ACCEPTED' ? 'Sua proposta foi aceita.' : engine.counterCents ? 'O vendedor respondeu com uma contraproposta.' : 'Sua proposta foi recebida.', href: `/e/offer/${o.code}`, emailSubject: 'Sua proposta foi registrada' })
    await syncOpportunityFromOffer(o.id)
    if (next === 'ACCEPTED') { await settleHold(o.id, 'accepted'); await createDealFromOffer(o.id) }
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

/** The seller's side of an answer: reachable AND, in a gallery team, a role that answers offers (Admin, Vendas). */
async function answerableOffer(scope: Scope, id: number) {
  const o = await reachableOffer(scope, id)
  await requireSellerRole(scope, OFFER_ROLES, 'Seu papel na galeria não responde propostas.')
  return o
}

/** "Conversar com {proponente}" on the seller's offer card: the conversation about the artwork between
 *  the person answering and the proponent's account. A proponent without an account answers by e-mail. */
export async function openOfferConversation(scope: Scope, id: number, me: number): Promise<number> {
  const o = await answerableOffer(scope, id)
  if (!o.buyerUserId) throw new ArtworkError('NO_COUNTERPART', 'O proponente ainda não tem conta. Responda pela proposta; ele recebe por e-mail.', 404)
  return openConversationWith(me, o.buyerUserId, o.artworkId)
}

/** Accept under an advisory lock per artwork: a second live offer on the same artwork is refused. */
export async function acceptOffer(scope: Scope, id: number, actor: { userId: number }) {
  const o = await answerableOffer(scope, id)
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
  await systemLine({ buyerUserId: o.buyerUserId, artworkId: o.artworkId, kind: 'SYSTEM', offerId: id, body: `Proposta de ${formatBRL(amount)} aceita. Você tem 24 h para pagar em garantia.` })
  await notify({ userId: o.buyerUserId, email: o.buyerEmail, kind: 'offer.accepted', title: `Proposta ${o.code} aceita`, body: 'Você tem 24 h para pagar em garantia.', href: `/e/offer/${o.code}`, emailSubject: 'Sua proposta foi aceita' })
  await syncOpportunityFromOffer(id)
  await settleHold(id, 'accepted')
  await createDealFromOffer(id)
  void audit.event({ entity: 'offer', entityId: id, action: 'accept', userId: actor.userId })
}

export async function refuseOffer(scope: Scope, id: number, actor: { userId: number }, reason?: string) {
  const o = await answerableOffer(scope, id)
  assertTransition(o.status as OfferStatus, 'REFUSED')
  const r = await prisma.offer.updateMany({ where: { id, status: o.status }, data: { status: 'REFUSED' } })
  if (r.count === 0) throw new ArtworkError('CHANGED', 'A proposta acabou de mudar.', 409)
  await prisma.offerEvent.create({ data: { offerId: id, kind: 'REFUSED', actorKind: 'SELLER', actorUserId: actor.userId, payloadJson: JSON.stringify({ reason: reason?.slice(0, 200) ?? null }) } })
  await settleHold(id, 'released')
  await systemLine({ buyerUserId: o.buyerUserId, artworkId: o.artworkId, kind: 'SYSTEM', offerId: id, body: 'O vendedor não aceitou a proposta.' })
  await notify({ userId: o.buyerUserId, email: o.buyerEmail, kind: 'offer.refused', title: `Proposta ${o.code} recusada`, href: `/e/offer/${o.code}`, emailSubject: 'Resposta à sua proposta' })
  await syncOpportunityFromOffer(id)
}

/** Seller counter-offer: must be ≥ the floor (the message never says the number of the floor). */
export async function counterOffer(scope: Scope, id: number, amountCents: bigint, actor: { userId: number }, message?: string) {
  const o = await answerableOffer(scope, id)
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
  await systemLine({ buyerUserId: o.buyerUserId, artworkId: o.artworkId, kind: 'COUNTER', offerId: id, body: `Contraproposta do vendedor: ${formatBRL(amountCents)}.${message ? ` "${message.slice(0, 200)}"` : ''}` })
  await notify({ userId: o.buyerUserId, email: o.buyerEmail, kind: 'offer.countered', title: `Contraproposta em ${o.code}`, href: `/e/offer/${o.code}`, emailSubject: 'Você recebeu uma contraproposta' })
  await syncOpportunityFromOffer(id)
}

// ── buyer by token or by session ─────────────────────────────────────────
/** The buyer's key: the one-time retraction token (e-mail flow) or the logged owner (Phase 4). */
export type BuyerAuth = string | null | { userId: number }
function ownsOffer(o: { retractionTokenHash: string | null; buyerUserId: number | null }, auth: BuyerAuth): boolean {
  if (auth && typeof auth === 'object') return o.buyerUserId !== null && o.buyerUserId === auth.userId
  return !!auth && !!o.retractionTokenHash && sha256(auth) === o.retractionTokenHash
}

export async function buyerOffer(code: string, token: BuyerAuth, now = new Date()): Promise<BuyerOffer | null> {
  return totalScope('offers:buyer', async () => {
    const o = await prisma.offer.findUnique({ where: { code }, include: { rounds: { orderBy: { number: 'asc' } }, artwork: { select: { title: true, year: true, publicId: true, listPriceCents: true, artist: { select: { name: true } }, media: { where: { kind: 'FRONT_COLOR_CARD' }, select: { publicUrl: true }, take: 1 } } } } })
    if (!o || o.status === 'AWAITING_OTP' || !ownsOffer(o, token)) return null
    return toBuyerView(o, now)
  })
}

export async function retractOffer(code: string, token: BuyerAuth): Promise<boolean> {
  return totalScope('offers:retract', async () => {
    const o = await prisma.offer.findUnique({ where: { code } })
    if (!o || !ownsOffer(o, token) || !o.retractionIssuedAt) return false
    if (Date.now() - o.retractionIssuedAt.getTime() > RETRACTION_WINDOW_MS) return false
    if (!['RECEIVED', 'BELOW_RESERVE', 'NEGOTIATING'].includes(o.status)) return false
    const r = await prisma.offer.updateMany({ where: { id: o.id, status: o.status }, data: { status: 'RETRACTED' } })
    if (r.count === 0) return false
    await prisma.offerEvent.create({ data: { offerId: o.id, kind: 'RETRACTED', actorKind: 'BUYER' } })
    await settleHold(o.id, 'released')
    await syncOpportunityFromOffer(o.id)
    return true
  })
}

/** Buyer replies to a counter-offer: accepts the seller's number (→ ACCEPTED at that amount) or counters again. */
export async function buyerReply(code: string, token: BuyerAuth, reply: { accept: true } | { accept: false; amountCents: bigint; message?: string }): Promise<boolean> {
  return totalScope('offers:buyer-reply', async () => {
    const o = await prisma.offer.findUnique({ where: { code }, include: { rounds: { orderBy: { number: 'asc' } } } })
    if (!o || !ownsOffer(o, token) || o.status !== 'NEGOTIATING') return false
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
    if (reply.accept) { await settleHold(o.id, 'accepted'); await createDealFromOffer(o.id) }
    return true
  })
}


// ── direct purchase ("Comprar direto") ────────────────────────────────────
export interface BuyNowInput { publicId: string; buyerUserId: number; buyerName: string; buyerEmail: string; buyerDocument: string | null; buyerCity?: string | null; paymentMethodId: number | null; deliveryCep: string | null; insurance: boolean
  /** How the escrow is paid: CARD (default — captured now), PIX or BOLETO (instructions; paid when the bank confirms). */
  method?: EscrowMethod; billing?: BoletoBilling | null }

/**
 * Buys at the list price: the offer is born ACCEPTED (the list price always
 * reaches the floor), the deal opens and, with a usable card, the escrow is
 * captured on the spot (mock; in test/live the total is authorized, then captured after the offer is written). The artwork is locked under the same advisory
 * lock as the seller's accept.
 */
export async function buyNow(i: BuyNowInput): Promise<{ ok: true; code: string; dealId: number | null; instructions?: PaymentInstructions | null } | { ok: false; error: string }> {
  return totalScope('offers:buy-now', async () => {
    const email = normalizeEmail(i.buyerEmail)
    if (!email) return { ok: false, error: 'Informe um e-mail válido.' }
    let doc: { hash: string; enc: string; mask: string } | null = null
    if (i.buyerDocument) { try { doc = protectDocument(i.buyerDocument) } catch { return { ok: false, error: 'CPF/CNPJ inválido.' } } }
    const a = await prisma.artwork.findUnique({ where: { publicId: i.publicId }, select: { id: true, memberId: true, status: true, seal: true, listPriceCents: true, member: { select: { tenant: { select: { status: true } } } }, mandates: { where: { status: 'ACTIVE' }, select: { id: true, listPriceCents: true } } } })
    if (!a || a.status !== 'LISTED' || a.seal !== 'GREEN' || a.member.tenant.status !== 'ACTIVE') return { ok: false, error: 'Esta obra não está à venda.' }
    const mandate = a.mandates[0]
    const price = mandate?.listPriceCents ?? a.listPriceCents
    if (!price || price <= 0n) return { ok: false, error: 'Esta obra é vendida sob consulta.' }
    const method: EscrowMethod = i.method ?? 'CARD'
    if (method === 'BOLETO') { const problem = boletoBillingProblem(i.billing ?? {}); if (problem) return { ok: false, error: problem } }
    if (method !== 'CARD') return buyNowAsync(i, method, a, mandate?.id ?? null, price, email, doc)
    const card = await usableCard(i.buyerUserId, i.paymentMethodId)
    if (!card) return { ok: false, error: 'Cadastre um cartão na carteira para comprar.' }
    const quote = await quoteForArtwork(a.id, i.deliveryCep, price)
    const insurance = i.insurance ? quote.insuranceCents : 0n
    const year = new Date().getUTCFullYear()
    const seq = await prisma.offer.count({ where: { code: { startsWith: `OFR-${year}-` } } })
    // test/live: the total the checkout shows (work + shipping + insurance) is AUTHORIZED first and captured
    // only after the offer is written under the artwork lock — a lost race releases it, nobody is charged twice.
    let ref = `mock_capture_${card.id}_${price}_${Date.now()}`
    let status: 'AUTHORIZED' | null = null
    const total = price + quote.shippingCents + insurance
    if (stripeMode() !== 'mock') {
      try {
        const h = await authorizeHold({ amountCents: total, description: 'Compra direta · HouseArt', payerUserId: i.buyerUserId, paymentMethodId: card.id, idempotencyKey: `buy-now:${a.id}:${i.buyerUserId}:${randomBytes(9).toString('base64url')}`, metadata: { kind: 'buy_now', artworkId: String(a.id) } })
        ref = h.ref; status = 'AUTHORIZED'
      } catch (e) {
        if (e instanceof ArtworkError) return { ok: false, error: e.message }
        throw e
      }
    }
    const offer = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${1_000_000 + a.id})`
      const live = await tx.offer.count({ where: { artworkId: a.id, status: { in: [...LIVE_STATUSES] } } })
      if (live > 0) throw new ArtworkError('ARTWORK_LOCKED', 'Esta obra acabou de ser reservada por outra pessoa.', 409)
      return tx.offer.create({
        data: {
          code: offerCode(year, seq + 1), artworkId: a.id, mandateId: mandate?.id ?? null, sellerMemberId: a.memberId, memberId: a.memberId,
          buyerUserId: i.buyerUserId, buyerName: i.buyerName.trim().slice(0, 120), buyerEmail: email, buyerDocumentHash: doc?.hash ?? null, buyerDocumentEnc: doc?.enc ?? null, buyerDocumentMask: doc?.mask ?? null,
          buyerKind: 'COLLECTOR', buyerCity: i.buyerCity?.trim().slice(0, 80) || null, offeredCents: price, acceptedCents: price, status: 'ACCEPTED', expiresAt: new Date(Date.now() + 86_400_000),
          validityHours: 24, guaranteeMethod: 'CARD_HOLD', guaranteeRef: ref, guaranteeStatus: status, paymentMethodId: card.id, deliveryCep: quote.cep, shippingCents: quote.shippingCents, insuranceCents: insurance,
          retractionTokenHash: null, retractionIssuedAt: new Date(),
          rounds: { create: { number: 1, author: 'BUYER', amountCents: price, message: 'Compra direta ao preço pedido.' } },
          events: { create: [{ kind: 'CREATED', actorKind: 'BUYER', payloadJson: JSON.stringify({ offeredCents: price.toString(), direct: true }) }, { kind: 'CONFIRMED', actorKind: 'BUYER' }, { kind: 'ACCEPTED', actorKind: 'SYSTEM', payloadJson: JSON.stringify({ amountCents: price.toString(), reason: 'list_price' }) }] },
        },
      })
    }).catch(async (e: unknown) => { if (isStripeRef(status ? ref : null)) await cancelHold(ref).catch(() => null); throw e })
    if (status) {
      // capture the whole authorized total (not `holdSettlement`, which is about the offer amount)
      let to: 'CAPTURED' | 'FAILED' = 'CAPTURED'
      try { await captureHold(ref, total) } catch (e) { to = 'FAILED'; console.warn('[stripe] compra direta', offer.id, (e as { code?: string })?.code ?? (e as Error)?.name) }
      await prisma.offer.updateMany({ where: { id: offer.id, guaranteeStatus: 'AUTHORIZED' }, data: { guaranteeStatus: to } })
      await prisma.offerEvent.create({ data: { offerId: offer.id, kind: to === 'CAPTURED' ? 'GUARANTEE_CAPTURED' : 'GUARANTEE_FAILED', actorKind: 'SYSTEM' } })
    }
    const seller = await prisma.member.findUnique({ where: { id: a.memberId }, select: { userId: true, user: { select: { email: true } } } })
    await notify({ userId: seller?.userId ?? null, email: seller?.user?.email, kind: 'offer.auto_accepted', title: `Compra direta · ${offer.code}`, body: 'A obra foi comprada ao preço pedido e o valor está em garantia.', href: '/sales?tab=deals', emailSubject: 'Sua obra foi comprada' })
    await syncOpportunityFromOffer(offer.id)
    const deal = await createDealFromOffer(offer.id)
    void audit.event({ entity: 'offer', entityId: offer.id, action: 'buy_now', userId: i.buyerUserId, after: { code: offer.code } })
    return { ok: true, code: offer.code, dealId: deal?.id ?? null }
  })
}

/**
 * Buy now with Pix or boleto: the offer is born ACCEPTED and the deal opens (the artwork reserved, as
 * with the card), then the Pix / boleto is generated. If that fails, the reservation is undone at once.
 * The escrow is paid only when the bank confirms (webhook); unpaid by the deadline, the cron cancels.
 */
async function buyNowAsync(i: BuyNowInput, method: 'PIX' | 'BOLETO', a: { id: number; memberId: number }, mandateId: number | null, price: bigint, email: string, doc: { hash: string; enc: string; mask: string } | null): Promise<{ ok: true; code: string; dealId: number | null; instructions: PaymentInstructions | null } | { ok: false; error: string }> {
  if (!flagOn('FLAG_DEALS')) return { ok: false, error: 'Pix e boleto ainda não estão disponíveis.' }
  const quote = await quoteForArtwork(a.id, i.deliveryCep, price)
  const insurance = i.insurance ? quote.insuranceCents : 0n
  const year = new Date().getUTCFullYear()
  const seq = await prisma.offer.count({ where: { code: { startsWith: `OFR-${year}-` } } })
  const offer = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${1_000_000 + a.id})`
    const live = await tx.offer.count({ where: { artworkId: a.id, status: { in: [...LIVE_STATUSES] } } })
    if (live > 0) throw new ArtworkError('ARTWORK_LOCKED', 'Esta obra acabou de ser reservada por outra pessoa.', 409)
    return tx.offer.create({
      data: {
        code: offerCode(year, seq + 1), artworkId: a.id, mandateId, sellerMemberId: a.memberId, memberId: a.memberId,
        buyerUserId: i.buyerUserId, buyerName: i.buyerName.trim().slice(0, 120), buyerEmail: email, buyerDocumentHash: doc?.hash ?? null, buyerDocumentEnc: doc?.enc ?? null, buyerDocumentMask: doc?.mask ?? null,
        buyerKind: 'COLLECTOR', buyerCity: i.buyerCity?.trim().slice(0, 80) || null, offeredCents: price, acceptedCents: price, status: 'ACCEPTED', expiresAt: new Date(Date.now() + 86_400_000),
        validityHours: 24, guaranteeMethod: 'NONE', deliveryCep: quote.cep, shippingCents: quote.shippingCents, insuranceCents: insurance,
        retractionTokenHash: null, retractionIssuedAt: new Date(),
        rounds: { create: { number: 1, author: 'BUYER', amountCents: price, message: `Compra direta ao preço pedido · ${method === 'PIX' ? 'Pix' : 'boleto'}.` } },
        events: { create: [{ kind: 'CREATED', actorKind: 'BUYER', payloadJson: JSON.stringify({ offeredCents: price.toString(), direct: true, method }) }, { kind: 'CONFIRMED', actorKind: 'BUYER' }, { kind: 'ACCEPTED', actorKind: 'SYSTEM', payloadJson: JSON.stringify({ amountCents: price.toString(), reason: 'list_price' }) }] },
      },
    })
  })
  await syncOpportunityFromOffer(offer.id)
  // quiet: the buyer is told only once the Pix/boleto exists — a failure below undoes the deal without any message
  const deal = await createDealFromOffer(offer.id, { quiet: true })
  if (!deal) return { ok: false, error: 'Não foi possível abrir o negócio.' }
  await prisma.deal.update({ where: { id: deal.id }, data: { shippingCents: quote.shippingCents, insuranceCents: insurance } })
  let started: Awaited<ReturnType<typeof startEscrowPayment>>
  try { started = await startEscrowPayment(i.buyerUserId, deal.id, method, i.billing ?? null) }
  catch (e) { await cancelUnpaidDeal(deal.id, `Não foi possível gerar o ${method === 'PIX' ? 'Pix' : 'boleto'}`, null, { silent: true }); throw e }
  const buyer = await prisma.user.findUnique({ where: { id: i.buyerUserId }, select: { email: true } })
  await notify({ userId: i.buyerUserId, email: buyer?.email, kind: 'deal.created', title: `Compra em andamento · ${deal.code}`, body: method === 'PIX' ? 'Pague o Pix em até 24 h para garantir a obra.' : 'Pague o boleto até o vencimento para garantir a obra.', href: '/purchases', emailSubject: 'Sua compra na HouseArt começou' })
  const seller = await prisma.member.findUnique({ where: { id: a.memberId }, select: { userId: true, user: { select: { email: true } } } })
  await notify({ userId: seller?.userId ?? null, email: seller?.user?.email, kind: 'offer.auto_accepted', title: `Compra direta · ${offer.code}`, body: `A obra foi reservada ao preço pedido; o comprador paga por ${method === 'PIX' ? 'Pix' : 'boleto'}.`, href: '/sales?tab=deals', emailSubject: 'Sua obra foi comprada' })
  void audit.event({ entity: 'offer', entityId: offer.id, action: 'buy_now', userId: i.buyerUserId, after: { code: offer.code, method } })
  return { ok: true, code: offer.code, dealId: deal.id, instructions: started.instructions }
}

/** The logged buyer's offers (Compras › Ofertas): never the floor, never the document. */
export async function offersOfUser(userId: number, now = new Date()): Promise<BuyerOffer[]> {
  const rows = await prisma.offer.findMany({ where: { buyerUserId: userId, status: { not: 'AWAITING_OTP' } }, include: { rounds: { orderBy: { number: 'asc' } }, artwork: { select: { title: true, year: true, publicId: true, listPriceCents: true, artist: { select: { name: true } }, media: { where: { kind: 'FRONT_COLOR_CARD' }, select: { publicUrl: true }, take: 1 } } } }, orderBy: { createdAt: 'desc' }, take: 50 })
  return rows.map((o) => toBuyerView(o, now))
}

/** Expires what passed its validity (cron). */
export async function expireOffers(now = new Date()): Promise<number> {
  const rows = await prisma.offer.findMany({ where: { status: { in: ['RECEIVED', 'BELOW_RESERVE', 'NEGOTIATING'] }, expiresAt: { lt: now } }, select: { id: true, status: true } })
  let n = 0
  for (const r of rows) {
    const u = await prisma.offer.updateMany({ where: { id: r.id, status: r.status }, data: { status: 'EXPIRED' } })
    if (u.count) { n++; await prisma.offerEvent.create({ data: { offerId: r.id, kind: 'EXPIRED', actorKind: 'SYSTEM' } }); await settleHold(r.id, 'released'); await syncOpportunityFromOffer(r.id) }
  }
  // A Stripe hold of an offer whose e-mail code was never confirmed is released once the code expired (the offer itself stays as it is).
  const unconfirmed = await prisma.offer.findMany({ where: { status: 'AWAITING_OTP', guaranteeStatus: 'AUTHORIZED', otpExpiresAt: { lt: now } }, select: { id: true } })
  for (const r of unconfirmed) await settleHold(r.id, 'released')
  return n
}
