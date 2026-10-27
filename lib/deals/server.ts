// Deals — I/O. Born from an ACCEPTED offer; walk the 6 phases; end with the
// transfer of the certificate and the release of the split. `phase` = the
// last phase DONE (OFFER_ACCEPTED at birth).
import 'server-only'
import { prisma } from '@/lib/prisma'
import { canView, memberFilter, type Scope } from '@/lib/scope/core'
import { totalScope } from '@/lib/scope/context'
import { audit } from '@/lib/audit'
import { flagOn } from '@/lib/flags'
import { ArtworkError } from '@/lib/artworks/server'
import { notify } from '@/lib/notifications/server'
import { assertChargeAllowed, cancelAsyncPayment, chargeNow, refundAsyncPayment, startAsyncPayment, stripeMode } from '@/lib/stripe/door'
import { syncOpportunityFromOffer } from '@/lib/crm/server'
import QRCode from 'qrcode'
import { BOLETO_DAYS, BOLETO_GRACE_DAYS, boletoBillingProblem, expiresAtFor, instructionsFromStripe, mockBoletoNumber, mockPixCode, parseInstructions, PIX_TTL_SECONDS, type AsyncMethod, type BoletoBilling, type EscrowMethod, type PaymentInstructions } from '@/lib/payments/async-core'
import { payDealSplits } from '@/lib/stripe/connect-server'
import { SPLIT_PAYOUT_LABELS, splitPayoutState, type ConnectAccountStatus, type SplitPayoutState } from '@/lib/stripe/connect-core'
import { afterResponseOrNow } from '@/lib/after'
import { moveArtworkToHolder } from '@/lib/tenant/member-server'
import { ensureCollectorUser } from '@/lib/accounts/collector-server'
import { computeSplit, SPLIT_PARTY_LABELS, type SplitLine } from '@/lib/commission/split-core'
import { royaltyFor } from '@/lib/resale-royalty/core'
import { recordEvent } from '@/lib/certificate-events/server'
import { verifyBuyerTap } from '@/lib/physical-markers/tap-server'
import { counterpartOfMember, openConversationWith } from '@/lib/messaging/server'
import { dealCode, nextPhase, PHASE_STEPS, phaseIndex, type DealPhase } from './domain'

/** Default gallery share of the seller's part until the Consignment agreement exists (HOUSEART_BUILD.md §J). */
export const DEFAULT_GALLERY_BPS = 4614

async function advance(dealId: number, from: DealPhase, title: string, description: string | null, actorKind: string) {
  const to = nextPhase(from)
  if (!to) throw new ArtworkError('DEAL_DONE', 'O negócio já foi concluído.', 409)
  const r = await prisma.deal.updateMany({ where: { id: dealId, phase: from }, data: { phase: to } })
  if (r.count === 0) throw new ArtworkError('CHANGED', 'O negócio acabou de mudar.', 409)
  await prisma.dealPhaseEvent.create({ data: { dealId, phase: to, title, description, actorKind } })
  return to
}

/** Called after ANY accept (seller, buyer reply, negotiator) when FLAG_DEALS is on. Idempotent per offer. */
export async function createDealFromOffer(offerId: number, opts: { quiet?: boolean } = {}): Promise<{ id: number; code: string } | null> {
  if (!flagOn('FLAG_DEALS')) return null
  return totalScope('deals:create', async () => {
    const o = await prisma.offer.findUnique({ where: { id: offerId }, include: { artwork: { include: { member: true, artist: true } }, deal: true } })
    if (!o || o.status !== 'ACCEPTED' || o.deal) return o?.deal ? { id: o.deal.id, code: o.deal.code } : null
    const amount = o.acceptedCents ?? o.offeredCents
    const market = (o.artwork.market === 'SECONDARY' ? 'SECONDARY' : 'PRIMARY') as 'PRIMARY' | 'SECONDARY'
    const buyer = await ensureCollectorUser(o.buyerEmail, o.buyerName)
    let royaltyCents = 0n, previous = 0n
    if (market === 'SECONDARY' && flagOn('FLAG_RESALE_ROYALTY')) {
      previous = await lastSalePrice(o.artworkId)
      royaltyCents = royaltyFor(amount, previous).royaltyCents
    }
    const seller = o.artwork.member.kind === 'ARTIST' ? 'ARTIST' : 'GALLERY'
    // The consignment share to the artist exists only when a GALLERY sells for an artist; a collector
    // reselling a work of theirs keeps the seller share (the artist gets the resale royalty).
    const galleryBps = o.artwork.member.kind === 'COLLECTOR' ? 0 : DEFAULT_GALLERY_BPS
    const lines: SplitLine[] = computeSplit({ amountCents: amount, market, seller, galleryBps, royaltyCents })
    const year = new Date().getUTCFullYear()
    const seq = await prisma.deal.count({ where: { code: { startsWith: `DL-${year}-` } } })
    const deal = await prisma.$transaction(async (tx) => {
      const d = await tx.deal.create({ data: {
        code: dealCode(year, seq + 1), artworkId: o.artworkId, offerId: o.id, sellerMemberId: o.sellerMemberId, memberId: o.sellerMemberId, buyerUserId: buyer.id, market, amountCents: amount,
        phaseEvents: { create: { phase: 'OFFER_ACCEPTED', title: 'Oferta aceita', description: `Proposta aceita · ${Number(amount / 100n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}`, actorKind: 'SYSTEM' } },
        splits: { create: lines.map((l) => ({ party: l.party, bps: l.bps, amountCents: l.amountCents })) },
      } })
      await tx.offer.updateMany({ where: { id: o.id, status: 'ACCEPTED' }, data: { status: 'IN_DEAL' } })
      await tx.artwork.updateMany({ where: { id: o.artworkId }, data: { status: 'IN_DEAL' } })
      const buyerFee = lines.find((l) => l.party === 'PLATFORM')
      if (buyerFee) await tx.invoice.create({ data: { userId: buyer.id, kind: 'COMMISSION', description: `Compra ${d.code} · ${o.artwork.title}`, amountCents: amount, status: 'HELD_IN_SPLIT', dealId: d.id } })
      if (royaltyCents > 0n) await tx.royaltyPayment.create({ data: { artworkId: o.artworkId, artistId: o.artwork.artistId, dealId: d.id, saleCents: amount, previousSaleCents: previous, appreciationCents: amount - previous, royaltyCents, status: 'HELD' } })
      return d
    })
    // Phase 4: a guarantee reserved at the offer (card hold / Pix reserve) is captured now — the binding offer.
    // test/live: only a hold Stripe really captured counts (null status = the mock reference of before).
    const guaranteed = (o.guaranteeMethod === 'CARD_HOLD' || o.guaranteeMethod === 'PIX_RESERVE') && !!o.guaranteeRef && (o.guaranteeStatus === null || o.guaranteeStatus === 'CAPTURED')
    if (guaranteed) {
      await prisma.deal.update({ where: { id: deal.id }, data: { shippingCents: o.shippingCents, insuranceCents: o.insuranceCents } })
      await payEscrow(buyer.id, deal.id, `${o.guaranteeRef}:captured`)
    }
    if (!opts.quiet) await notify({ userId: buyer.id, email: buyer.email, kind: 'deal.created', title: `Compra em andamento · ${o.artwork.title}`, body: guaranteed ? 'O valor reservado foi para a garantia. O vendedor já prepara o envio.' : 'Você tem 24 h para pagar em garantia.', href: '/purchases', emailSubject: 'Sua compra na HouseArt começou' })
    void audit.event({ entity: 'deal', entityId: deal.id, action: 'create', after: { code: deal.code, amountCents: amount.toString(), guaranteed } })
    return { id: deal.id, code: deal.code }
  })
}

async function lastSalePrice(artworkId: number): Promise<bigint> {
  const t = await prisma.ownershipTransfer.findFirst({ where: { artworkId, status: 'COMPLETED', priceCents: { not: null } }, orderBy: { completedAt: 'desc' } })
  if (t?.priceCents) return t.priceCents
  const d = await prisma.deal.findFirst({ where: { artworkId, phase: 'COMPLETED' }, orderBy: { completedAt: 'desc' } })
  if (d?.amountCents) return d.amountCents
  // A collector-registered artwork: what they declared paying (nothing declared = the whole price appreciated).
  const a = await prisma.artwork.findUnique({ where: { id: artworkId }, select: { acquisitionPriceCents: true } })
  return a?.acquisitionPriceCents ?? 0n
}

// ── reads ────────────────────────────────────────────────────────────────
export interface DealView {
  id: number; code: string; phase: DealPhase; progressPct: number; artworkTitle: string; artist: string; sellerName: string; cover: string | null
  amountCents: bigint; shippingCents: bigint; insuranceCents: bigint; market: string; buyerName: string
  steps: { phase: DealPhase; title: string; icon: string; description: string; date: string | null; state: 'done' | 'on' | 'todo' }[]
  split: { party: string; label: string; amountCents: bigint; status: string; payoutState: SplitPayoutState; payoutLabel: string }[]
  shipping: { carrier: string | null; tracking: string | null; insurer: string | null } | null
  sellerSigned: boolean; buyerSigned: boolean; escrowPaid: boolean; completedAt: string | null
  /** Seller view (Vendas até o repasse): the offer behind the deal, who sells, the buyer's city, the day of the sale. */
  offerId: number; sellerKind: string; buyerCity: string | null; createdAt: string; exception: string | null; artworkId: number
  /** The buyer's Pix/boleto waiting to be paid — only in the BUYER's view (buyerDeals); null for the seller. */
  escrowPending: PaymentInstructions | null
}

function toView(d: Awaited<ReturnType<typeof loadDeal>>, forBuyer = false): DealView {
  const idx = phaseIndex(d.phase as DealPhase)
  // the Connect account behind each payable line (seller member; the artist's own member for ARTIST of a gallery sale and the royalty)
  const sellerIsArtist = d.artwork.member.kind === 'ARTIST'
  const accountOf = (party: string): ConnectAccountStatus | null => {
    const memberId = party === 'GALLERY' || (party === 'ARTIST' && sellerIsArtist) ? d.sellerMemberId : party === 'ARTIST' || party === 'ARTIST_ROYALTY' ? d.artwork.artist.memberId : null
    const a = memberId === null ? null : d.connectAccounts.find((x) => x.memberId === memberId)
    return a ? (a.status as ConnectAccountStatus) : null
  }
  const events = new Map(d.phaseEvents.map((e) => [e.phase, e]))
  const steps = PHASE_STEPS.map((s, i) => {
    const e = events.get(s.phase) ?? (s.phase === 'TRANSFER' ? events.get('COMPLETED') : undefined)
    const state: 'done' | 'on' | 'todo' = i <= idx ? 'done' : i === idx + 1 ? 'on' : 'todo'
    return { phase: s.phase, title: s.title, icon: s.icon, description: e?.description ?? s.pending, date: e ? e.occurredAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : null, state }
  })
  return {
    id: d.id, code: d.code, phase: d.phase as DealPhase, progressPct: Math.round(((idx + 1) / 7) * 100), artworkTitle: `${d.artwork.title}${d.artwork.year ? `, ${d.artwork.year}` : ''}`, artist: d.artwork.artist.name,
    sellerName: d.artwork.member.displayName, cover: d.artwork.media[0]?.publicUrl ?? null, amountCents: d.amountCents, shippingCents: d.shippingCents, insuranceCents: d.insuranceCents, market: d.market, buyerName: d.offer.buyerName,
    steps, split: d.splits.map((s) => { const payoutState = splitPayoutState(s, accountOf(s.party)); return { party: s.party, label: SPLIT_PARTY_LABELS[s.party as keyof typeof SPLIT_PARTY_LABELS] ?? s.party, amountCents: s.amountCents, status: s.status, payoutState, payoutLabel: SPLIT_PAYOUT_LABELS[payoutState] } }),
    shipping: d.carrierName ? { carrier: d.carrierName, tracking: d.trackingCode, insurer: d.insurerName } : null,
    sellerSigned: !!d.sellerSignedAt, buyerSigned: !!d.buyerSignedAt, escrowPaid: !!d.escrowPaidAt, completedAt: d.completedAt?.toISOString() ?? null,
    escrowPending: forBuyer && d.phase === 'OFFER_ACCEPTED' && !d.escrowPaidAt && d.escrowPendingRef ? parseInstructions(d.escrowInstructionsJson) : null,
    offerId: d.offerId, sellerKind: d.sellerKind, buyerCity: d.offer.buyerCity ?? null, createdAt: d.createdAt.toISOString(), exception: d.exceptionStatus ?? null, artworkId: d.artworkId,
  }
}

async function loadDeal(id: number) {
  const d = await prisma.deal.findUniqueOrThrow({ where: { id }, include: { artwork: { include: { artist: true, member: true, media: { where: { kind: 'FRONT_COLOR_CARD' }, take: 1 } } }, offer: true, phaseEvents: { orderBy: { occurredAt: 'asc' } }, splits: { orderBy: { id: 'asc' } } } })
  const members = [d.sellerMemberId, d.artwork.artist.memberId].filter((m): m is number => m !== null)
  const connectAccounts = stripeMode() === 'mock' ? [] : await prisma.stripeConnectAccount.findMany({ where: { memberId: { in: members }, mode: stripeMode() }, select: { memberId: true, status: true } })
  // who SOLD (the artwork's member changes to the buyer once the transfer completes)
  const seller = await prisma.member.findUnique({ where: { id: d.sellerMemberId }, select: { kind: true } })
  return { ...d, connectAccounts, sellerKind: seller?.kind ?? d.artwork.member.kind }
}

/** The Acervo row of a reserved/sold work: who bought it and the step the sale is at (one query per batch). */
export interface ArtworkDealLine { artworkId: number; buyerName: string; phase: DealPhase; sellerSigned: boolean; exception: string | null }
export async function dealLinesByArtwork(scope: Scope, artworkIds: readonly number[]): Promise<Map<number, ArtworkDealLine>> {
  const ids = [...new Set(artworkIds)].filter((id) => Number.isInteger(id) && id > 0)
  const out = new Map<number, ArtworkDealLine>()
  if (!ids.length) return out
  const rows = await prisma.deal.findMany({
    where: { ...memberFilter(scope), artworkId: { in: ids } },
    orderBy: { createdAt: 'desc' },
    select: { artworkId: true, phase: true, sellerSignedAt: true, exceptionStatus: true, offer: { select: { buyerName: true } } },
  })
  for (const d of rows) if (!out.has(d.artworkId)) out.set(d.artworkId, { artworkId: d.artworkId, buyerName: d.offer.buyerName, phase: d.phase as DealPhase, sellerSigned: !!d.sellerSignedAt, exception: d.exceptionStatus ?? null })
  return out
}

export async function sellerDeals(scope: Scope): Promise<DealView[]> {
  const ids = await prisma.deal.findMany({ where: { ...memberFilter(scope) }, select: { id: true }, orderBy: { createdAt: 'desc' }, take: 50 })
  return Promise.all(ids.map((d) => loadDeal(d.id).then(toView)))
}

export async function buyerDeals(userId: number): Promise<DealView[]> {
  const ids = await prisma.deal.findMany({ where: { buyerUserId: userId }, select: { id: true }, orderBy: { createdAt: 'desc' }, take: 50 })
  return Promise.all(ids.map((d) => loadDeal(d.id).then((x) => toView(x, true))))
}

async function sellerDeal(scope: Scope, id: number) {
  const d = await prisma.deal.findUnique({ where: { id }, select: { id: true, phase: true, memberId: true, tenantId: true, buyerUserId: true, sellerSignedAt: true, buyerSignedAt: true } })
  if (!d || !canView(scope, d)) throw new ArtworkError('NOT_FOUND', 'Negócio não encontrado.', 404)
  return d
}

/**
 * Which side of THIS deal the person is on: the buyer by the user, the seller by
 * the scope over the seller member. Decided by the deal, never by the profile — a
 * collector also sells (secondary market) and an artist or a gallery also buys.
 */
export async function sideOfDeal(dealId: number, userId: number, scope: Scope | null): Promise<'BUYER' | 'SELLER' | null> {
  const d = await prisma.deal.findUnique({ where: { id: dealId }, select: { buyerUserId: true, memberId: true, tenantId: true } })
  if (!d) return null
  if (d.buyerUserId === userId) return 'BUYER'
  if (scope && canView(scope, d)) return 'SELLER'
  return null
}

/**
 * "Falar com o vendedor" in the buyer's purchase: the conversation about the artwork with who SOLD it
 * (the deal's seller member), never the artwork's current holder — after the deed the holder is the buyer.
 */
export async function openDealConversation(userId: number, id: number): Promise<number> {
  const d = await prisma.deal.findFirst({ where: { id, buyerUserId: userId }, select: { sellerMemberId: true, artworkId: true, exceptionStatus: true } })
  if (!d) throw new ArtworkError('NOT_FOUND', 'Negócio não encontrado.', 404)
  // the button is not offered on a cancelled deal; the route says the same
  if (d.exceptionStatus === 'CANCELLED') throw new ArtworkError('DEAL_CANCELLED', 'Este negócio foi cancelado.', 409)
  const seller = await counterpartOfMember(d.sellerMemberId)
  if (!seller) throw new ArtworkError('NO_COUNTERPART', 'O vendedor não tem quem responda agora. Fale com a HouseArt.', 404)
  return openConversationWith(userId, seller.userId, d.artworkId)
}

async function buyerDeal(userId: number, id: number) {
  const d = await prisma.deal.findFirst({ where: { id, buyerUserId: userId } })
  if (!d) throw new ArtworkError('NOT_FOUND', 'Negócio não encontrado.', 404)
  return d
}

/** Escrow payment. Mock (dev/tests) marks it paid; test/live charge the buyer's default card (PaymentIntent, one per deal by the idempotency key). */
const PAID_TEXT: Record<EscrowMethod, string> = {
  CARD: 'Cartão aprovado · valor retido na HouseArt',
  PIX: 'Pix confirmado · valor retido na HouseArt',
  BOLETO: 'Boleto compensado · valor retido na HouseArt',
}

/**
 * The escrow is paid — ONE transaction (the CAS on the unpaid state, the phase and its event: a webhook retry
 * never finds it half applied), then the seller is told. A Pix/boleto still pending that is NOT the one
 * paying (the card won a race against it) is released: cancelled, or refunded if the bank already paid it.
 */
async function markEscrowPaid(dealId: number, ref: string, method: EscrowMethod, actorKind: 'BUYER' | 'SYSTEM'): Promise<boolean> {
  const replaced = await prisma.$transaction(async (tx) => {
    const cur = await tx.deal.findUnique({ where: { id: dealId }, select: { escrowPendingRef: true } })
    if (!cur) return false
    const r = await tx.deal.updateMany({ where: { id: dealId, phase: 'OFFER_ACCEPTED', escrowPaidAt: null, exceptionStatus: null, escrowPendingRef: cur.escrowPendingRef }, data: { phase: nextPhase('OFFER_ACCEPTED')!, escrowPaidAt: new Date(), escrowPaymentRef: ref, escrowMethod: method, escrowPendingRef: null, escrowExpiresAt: null } })
    if (r.count === 0) return false
    await tx.dealPhaseEvent.create({ data: { dealId, phase: nextPhase('OFFER_ACCEPTED')!, title: 'Pagamento em garantia', description: PAID_TEXT[method], actorKind } })
    return { other: cur.escrowPendingRef && cur.escrowPendingRef !== ref ? cur.escrowPendingRef : null }
  })
  if (!replaced) return false
  if (replaced.other) await releaseAsync(replaced.other, dealId)
  const d = await prisma.deal.findUniqueOrThrow({ where: { id: dealId }, select: { code: true, sellerMemberId: true, buyerUserId: true } })
  const seller = await prisma.member.findUnique({ where: { id: d.sellerMemberId }, select: { userId: true, user: { select: { email: true } } } })
  await notify({ userId: seller?.userId ?? null, email: seller?.user?.email, kind: 'deal.escrow_paid', title: `Pagamento em garantia recebido · ${d.code}`, href: '/sales?tab=deals', emailSubject: 'O comprador pagou em garantia' })
  if (actorKind === 'SYSTEM') await notify({ userId: d.buyerUserId, kind: 'deal.escrow_paid', title: `Pagamento confirmado · ${d.code}`, body: 'O valor está retido na HouseArt até você confirmar a entrega.', href: '/purchases' })
  void audit.event({ entity: 'deal', entityId: dealId, action: 'escrow_paid', after: { method } })
  return true
}

const isProviderRef = (ref: string) => !ref.startsWith('mock_') && stripeMode() !== 'mock'

/**
 * A Pix/boleto this deal no longer waits for: cancelled at the provider; already paid → refunded (one refund per
 * PaymentIntent); still clearing → left for the webhook, which refunds it when it lands (settleEscrowByIntent).
 * Best effort: never breaks the payment that won; a failure is audited for the team.
 */
async function releaseAsync(ref: string, dealId: number): Promise<void> {
  if (!isProviderRef(ref)) return
  try {
    const r = await cancelAsyncPayment(ref)
    if (r === 'PAID') await refundStray(ref, dealId)
  } catch (e) {
    void audit.event({ entity: 'deal', entityId: dealId, action: 'escrow_release_failed', after: { code: (e as { code?: string })?.code ?? (e as Error)?.name } })
  }
}

async function refundStray(ref: string, dealId: number | null): Promise<void> {
  try {
    await refundAsyncPayment(ref)
    void audit.event({ entity: 'deal', entityId: dealId ?? 0, action: 'escrow_stray_refunded' })
  } catch (e) {
    // boleto has no refund at the provider: the team gives it back by hand
    void audit.event({ entity: 'deal', entityId: dealId ?? 0, action: 'escrow_stray_refund_failed', after: { code: (e as { code?: string })?.code ?? (e as Error)?.name } })
    console.error('[deals] pagamento avulso sem estorno', dealId, (e as { code?: string })?.code ?? (e as Error)?.name)
  }
}

/**
 * A Pix/boleto still waiting for this deal is dropped before another way of paying starts. If the bank
 * already paid it, the escrow is settled with it instead and 'PAID' comes back (nothing else is charged);
 * one still clearing refuses the switch. The reservation deadline (escrowExpiresAt) stays: a replacement
 * that fails never leaves the artwork reserved without one.
 */
async function dropPendingAsync(d: { id: number; escrowPendingRef: string | null; escrowMethod: string | null }): Promise<'NONE' | 'DROPPED' | 'PAID'> {
  if (!d.escrowPendingRef) return 'NONE'
  if (isProviderRef(d.escrowPendingRef)) {
    const r = await cancelAsyncPayment(d.escrowPendingRef)
    if (r === 'PROCESSING') throw new ArtworkError('PAYMENT_PROCESSING', 'O banco está processando o seu pagamento. Aguarde a confirmação.', 409)
    if (r === 'PAID') { await markEscrowPaid(d.id, d.escrowPendingRef, (d.escrowMethod as EscrowMethod) ?? 'PIX', 'SYSTEM'); return 'PAID' }
  }
  await prisma.deal.updateMany({ where: { id: d.id, escrowPendingRef: d.escrowPendingRef }, data: { escrowPendingRef: null, escrowInstructionsJson: null } })
  return 'DROPPED'
}

// ── phases ───────────────────────────────────────────────────────────────
/** Escrow payment by CARD. Mock (dev/tests) marks it paid; test/live charge the buyer's default card (PaymentIntent, one per deal by the idempotency key). */
export async function payEscrow(userId: number, dealId: number, paymentRef: string | null = null) {
  const d = await buyerDeal(userId, dealId)
  if (d.phase !== 'OFFER_ACCEPTED' || d.escrowPaidAt) throw new ArtworkError('WRONG_PHASE', 'O pagamento em garantia já foi feito.', 409)
  if (d.exceptionStatus) throw new ArtworkError('DEAL_CANCELLED', 'Este negócio foi cancelado.', 409)
  if ((await dropPendingAsync(d)) === 'PAID') return
  let ref = paymentRef
  if (!ref && stripeMode() !== 'mock') {
    ref = (await chargeNow({ amountCents: d.amountCents + d.shippingCents + d.insuranceCents, description: `Garantia do negócio ${d.code}`, payerUserId: userId, idempotencyKey: `deal-escrow:${dealId}`, metadata: { kind: 'deal_escrow', dealId: String(dealId) } })).ref
  }
  if (!ref) assertChargeAllowed() // mock in the real production pays nothing
  ref ??= process.env.STRIPE_ENV === 'live' ? null : `mock_pi_${dealId}_${Date.now()}`
  if (!ref) throw new ArtworkError('PAYMENT_REQUIRED', 'Pagamento real ainda não disponível.', 503)
  if (!(await markEscrowPaid(dealId, ref, 'CARD', 'BUYER'))) throw new ArtworkError('CHANGED', 'O negócio acabou de mudar.', 409)
}

/**
 * Pix or boleto for the escrow: the instructions the buyer pays outside (QR + copia e cola / boleto line + PDF).
 * Asking again for the same method returns the same instructions; another method drops the previous one.
 * Paid only when the provider confirms (webhook) — or by "Simular pagamento" in mock.
 */
export async function startEscrowPayment(userId: number, dealId: number, method: AsyncMethod, billing: BoletoBilling | null = null, now = new Date()): Promise<{ instructions: PaymentInstructions | null; paid: boolean }> {
  const d = await buyerDeal(userId, dealId)
  if (d.phase !== 'OFFER_ACCEPTED' || d.escrowPaidAt) throw new ArtworkError('WRONG_PHASE', 'O pagamento em garantia já foi feito.', 409)
  if (d.exceptionStatus) throw new ArtworkError('DEAL_CANCELLED', 'Este negócio foi cancelado.', 409)
  const current = parseInstructions(d.escrowInstructionsJson)
  if (d.escrowPendingRef && d.escrowMethod === method && current && d.escrowExpiresAt && d.escrowExpiresAt > now) return { instructions: current, paid: false }
  if (method === 'BOLETO') { const problem = boletoBillingProblem(billing ?? {}); if (problem) throw new ArtworkError('BILLING', problem, 400) }
  assertChargeAllowed() // mock in the real production pays nothing
  if ((await dropPendingAsync(d)) === 'PAID') return { instructions: null, paid: true }
  const amount = d.amountCents + d.shippingCents + d.insuranceCents
  const expiresAt = expiresAtFor(method, now)
  let ref: string
  let instructions: PaymentInstructions | null
  if (stripeMode() === 'mock') {
    ref = `mock_${method.toLowerCase()}_${dealId}_${now.getTime()}`
    if (method === 'PIX') {
      const code = mockPixCode(d.code, amount)
      instructions = { method, amountCents: amount.toString(), expiresAt: expiresAt.toISOString(), pixCode: code, pixQrUrl: await QRCode.toDataURL(code, { margin: 1, width: 280 }), mock: true }
    } else {
      instructions = { method, amountCents: amount.toString(), expiresAt: expiresAt.toISOString(), boletoNumber: mockBoletoNumber(dealId, amount), mock: true }
    }
  } else {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, email: true } })
    const pi = await startAsyncPayment({
      method, amountCents: amount, payerUserId: userId, description: `Garantia do negócio ${d.code}`,
      // a fresh key per request: a Pix asked again after a switch must never replay one already cancelled;
      // two requests at once both create, and the loser of the CAS below cancels its own
      idempotencyKey: `deal-escrow-async:${dealId}:${method}:${now.getTime()}:${Math.random().toString(36).slice(2, 10)}`,
      metadata: { kind: 'deal_escrow', dealId: String(dealId), method },
      billing: billing ? { ...billing, name: billing.name || user.name, email: billing.email || user.email } : undefined,
      pixExpiresAfterSeconds: PIX_TTL_SECONDS, boletoExpiresAfterDays: BOLETO_DAYS,
    })
    ref = pi.ref
    instructions = instructionsFromStripe(method, amount, pi.nextAction, expiresAt)
    if (!instructions) { await releaseAsync(ref, dealId); throw new ArtworkError('PAYMENT_FAILED', 'Não foi possível gerar o pagamento. Tente de novo.', 502) }
  }
  const deadline = new Date(instructions.expiresAt)
  const r = await prisma.deal.updateMany({ where: { id: dealId, phase: 'OFFER_ACCEPTED', escrowPaidAt: null, escrowPendingRef: null }, data: { escrowMethod: method, escrowPendingRef: ref, escrowExpiresAt: Number.isNaN(deadline.getTime()) ? expiresAt : deadline, escrowInstructionsJson: JSON.stringify(instructions) } })
  if (r.count === 0) { await releaseAsync(ref, dealId); throw new ArtworkError('CHANGED', 'O negócio acabou de mudar. Atualize a página.', 409) }
  void audit.event({ entity: 'deal', entityId: dealId, action: 'escrow_async_started', userId, after: { method } })
  return { instructions, paid: false }
}

/** The buyer's pending Pix/boleto of a deal (Compras), or null. */
export async function pendingEscrowOf(userId: number, dealId: number): Promise<PaymentInstructions | null> {
  const d = await prisma.deal.findFirst({ where: { id: dealId, buyerUserId: userId, phase: 'OFFER_ACCEPTED', escrowPaidAt: null, escrowPendingRef: { not: null } }, select: { escrowInstructionsJson: true } })
  return parseInstructions(d?.escrowInstructionsJson)
}

/**
 * Webhook: a Pix/boleto PaymentIntent was paid → the escrow of its deal. Idempotent (CAS). A deal-escrow
 * PaymentIntent that no deal waits for any more (paid another way, cancelled, replaced) is refunded — the
 * money never stays silently on the platform.
 */
export async function settleEscrowByIntent(piId: string, metadata: Record<string, string> = {}): Promise<boolean> {
  return totalScope('deals:settle-async', async () => {
    const d = await prisma.deal.findFirst({ where: { escrowPendingRef: piId }, select: { id: true, escrowMethod: true } })
    if (d && (await markEscrowPaid(d.id, piId, (d.escrowMethod as EscrowMethod) ?? 'PIX', 'SYSTEM'))) return true
    if (metadata.kind !== 'deal_escrow') return false
    if (await prisma.deal.count({ where: { escrowPaymentRef: piId } })) return false // the one that paid it
    const dealId = Number(metadata.dealId) || null
    await refundStray(piId, dealId)
    const buyer = dealId ? await prisma.deal.findUnique({ where: { id: dealId }, select: { buyerUserId: true, code: true } }) : null
    if (buyer) await notify({ userId: buyer.buyerUserId, kind: 'deal.refund', title: `Pagamento devolvido · ${buyer.code}`, body: 'Recebemos um pagamento que este negócio já não esperava; ele será devolvido.', href: '/purchases' })
    return false
  })
}

/** Mock only: what the bank's confirmation does in test/live (the prototype's demo button). */
export async function simulateEscrowPayment(userId: number, dealId: number): Promise<void> {
  if (stripeMode() !== 'mock') throw new ArtworkError('NOT_MOCK', 'A confirmação vem do banco.', 409)
  assertChargeAllowed()
  const d = await buyerDeal(userId, dealId)
  if (!d.escrowPendingRef) throw new ArtworkError('NO_PENDING', 'Gere o Pix ou o boleto antes.', 409)
  if (!(await markEscrowPaid(dealId, d.escrowPendingRef, (d.escrowMethod as EscrowMethod) ?? 'PIX', 'SYSTEM'))) throw new ArtworkError('CHANGED', 'O negócio acabou de mudar.', 409)
}

/**
 * Undoes a deal never paid: deal CANCELLED, offer CANCELLED, artwork back on sale, invoice and resale royalty
 * cancelled, CRM updated, both told (unless `silent`: the buy-now that could not even generate its Pix). CAS on the unpaid state.
 */
export async function cancelUnpaidDeal(dealId: number, reason: string, pendingRef: string | null = null, opts: { silent?: boolean } = {}): Promise<boolean> {
  const d = await prisma.deal.findUnique({ where: { id: dealId }, select: { id: true, code: true, offerId: true, artworkId: true, buyerUserId: true, sellerMemberId: true, escrowPendingRef: true } })
  if (!d) return false
  const cancelled = await prisma.$transaction(async (tx) => {
    const u = await tx.deal.updateMany({ where: { id: d.id, phase: 'OFFER_ACCEPTED', escrowPaidAt: null, exceptionStatus: null, ...(pendingRef ? { escrowPendingRef: pendingRef } : {}) }, data: { exceptionStatus: 'CANCELLED', escrowPendingRef: null } })
    if (!u.count) return false
    await tx.dealPhaseEvent.create({ data: { dealId: d.id, phase: 'OFFER_ACCEPTED', title: 'Negócio cancelado', description: reason, actorKind: 'SYSTEM' } })
    await tx.offer.updateMany({ where: { id: d.offerId, status: { in: ['ACCEPTED', 'IN_DEAL'] } }, data: { status: 'CANCELLED' } })
    await tx.offerEvent.create({ data: { offerId: d.offerId, kind: 'CANCELLED', actorKind: 'SYSTEM', payloadJson: JSON.stringify({ reason }) } })
    await tx.artwork.updateMany({ where: { id: d.artworkId, status: 'IN_DEAL' }, data: { status: 'LISTED' } })
    await tx.invoice.updateMany({ where: { dealId: d.id, status: 'HELD_IN_SPLIT' }, data: { status: 'CANCELLED' } })
    await tx.royaltyPayment.updateMany({ where: { dealId: d.id, status: { in: ['PENDING', 'HELD'] } }, data: { status: 'CANCELLED' } })
    return true
  })
  if (!cancelled) return false
  await syncOpportunityFromOffer(d.offerId)
  void audit.event({ entity: 'deal', entityId: d.id, action: 'cancel_unpaid', after: { reason } })
  if (opts.silent) return true
  await notify({ userId: d.buyerUserId, kind: 'deal.cancelled', title: `Pagamento não identificado · ${d.code}`, body: 'O prazo do pagamento acabou e a reserva da obra foi desfeita.', href: '/purchases' })
  const seller = await prisma.member.findUnique({ where: { id: d.sellerMemberId }, select: { userId: true } })
  await notify({ userId: seller?.userId ?? null, kind: 'deal.cancelled', title: `Venda cancelada · ${d.code}`, body: 'O comprador não pagou; a obra voltou a ficar à venda.', href: '/sales?tab=deals' })
  return true
}

/**
 * Cron: a reservation not paid by its deadline lets the artwork go — the deal is cancelled, the offer too,
 * the artwork is listed again and both sides are told. A payment the bank confirmed meanwhile settles instead;
 * one still clearing waits; a boleto gets BOLETO_GRACE_DAYS after its due date (paid on the due day, it clears later).
 * The deadline stays after a switch of method, so a deal whose replacement failed is still collected here.
 */
export async function expireUnpaidEscrows(now = new Date()): Promise<number> {
  return totalScope('deals:expire-async', async () => {
    const rows = await prisma.deal.findMany({ where: { phase: 'OFFER_ACCEPTED', escrowPaidAt: null, exceptionStatus: null, escrowExpiresAt: { lt: now } }, select: { id: true, escrowPendingRef: true, escrowMethod: true, escrowExpiresAt: true } })
    let n = 0
    for (const d of rows) {
      if (d.escrowMethod === 'BOLETO' && d.escrowExpiresAt!.getTime() + BOLETO_GRACE_DAYS * 86_400_000 > now.getTime()) continue
      const ref = d.escrowPendingRef
      if (ref && isProviderRef(ref)) {
        const r = await cancelAsyncPayment(ref).catch(() => null)
        if (r === 'PAID') { await markEscrowPaid(d.id, ref, (d.escrowMethod as EscrowMethod) ?? 'PIX', 'SYSTEM'); continue }
        if (r === null || r === 'PROCESSING') continue // the provider did not answer, or the money is clearing: next run
      }
      const reason = d.escrowMethod === 'BOLETO' ? 'Boleto vencido sem pagamento' : d.escrowMethod === 'PIX' ? 'Pix expirado sem pagamento' : 'Prazo do pagamento encerrado'
      if (await cancelUnpaidDeal(d.id, reason, ref)) n++
    }
    return n
  })
}

/** The assignment term: seller signs from the panel, buyer from Compras; both → DOCUMENTS. */
export async function signAgreement(party: 'SELLER' | 'BUYER', dealId: number, actor: { userId: number; scope?: Scope }) {
  const d = party === 'SELLER' ? await sellerDeal(actor.scope!, dealId) : await buyerDeal(actor.userId, dealId)
  if (d.phase !== 'ESCROW') throw new ArtworkError('WRONG_PHASE', 'Assine depois do pagamento em garantia.', 409)
  const data = party === 'SELLER' ? { sellerSignedAt: new Date() } : { buyerSignedAt: new Date() }
  const r = await prisma.deal.updateMany({ where: { id: dealId, phase: 'ESCROW', ...(party === 'SELLER' ? { sellerSignedAt: null } : { buyerSignedAt: null }) }, data })
  if (r.count === 0) throw new ArtworkError('ALREADY_SIGNED', 'Já assinado.', 409)
  const now = await prisma.deal.findUniqueOrThrow({ where: { id: dealId }, select: { sellerSignedAt: true, buyerSignedAt: true } })
  if (now.sellerSignedAt && now.buyerSignedAt) await advance(dealId, 'ESCROW', 'Documentação e assinatura', 'Termo de transferência assinado pelas partes', party)
}

export async function bookShipping(scope: Scope, dealId: number, s: { carrier: string; tracking: string; insurer?: string | null; policyRef?: string | null; shippingCents?: bigint; insuranceCents?: bigint }) {
  const d = await sellerDeal(scope, dealId)
  if (d.phase !== 'DOCUMENTS') throw new ArtworkError('WRONG_PHASE', 'O transporte entra depois da assinatura.', 409)
  await prisma.deal.update({ where: { id: dealId }, data: { carrierName: s.carrier.slice(0, 80), trackingCode: s.tracking.slice(0, 80), insurerName: s.insurer?.slice(0, 80) ?? null, policyRef: s.policyRef?.slice(0, 80) ?? null, shippingCents: s.shippingCents ?? 0n, insuranceCents: s.insuranceCents ?? 0n, shippedAt: new Date() } })
  if (s.insurer) await prisma.insurancePolicy.create({ data: { artworkId: (await prisma.deal.findUniqueOrThrow({ where: { id: dealId } })).artworkId, kind: 'TRANSIT', insurer: s.insurer, policyNumber: s.policyRef ?? '—', validFrom: new Date(), validUntil: new Date(Date.now() + 30 * 86_400_000), coverageCents: 0n } })
  await advance(dealId, 'DOCUMENTS', 'Retirada e transporte', `${s.carrier} retirou · rastreio ${s.tracking}${s.insurer ? ` · seguro de trânsito ${s.insurer}` : ''}`, 'SELLER')
  const deal = await prisma.deal.findUniqueOrThrow({ where: { id: dealId }, select: { buyerUserId: true, code: true } })
  const buyer = await prisma.user.findUnique({ where: { id: deal.buyerUserId }, select: { email: true } })
  await notify({ userId: deal.buyerUserId, email: buyer?.email, kind: 'deal.shipped', title: `Obra a caminho · ${deal.code}`, body: `${s.carrier} · rastreio ${s.tracking}`, href: '/purchases', emailSubject: 'Sua obra está a caminho' })
}

/** "A obra chegou?" — the buyer's tap. With the mock vendor a tap without a SUN message is a simulated read. */
export async function confirmDelivery(userId: number, dealId: number, sun: { uid: string; ctr: number; cmac: string } | null) {
  const d = await buyerDeal(userId, dealId)
  if (d.phase !== 'SHIPPING') throw new ArtworkError('WRONG_PHASE', 'A entrega só é confirmada depois do envio.', 409)
  const marker = await prisma.physicalMarker.findFirst({ where: { artworkId: d.artworkId, status: 'LINKED' } })
  if (!marker) throw new ArtworkError('NO_MARKER', 'A obra não tem etiqueta vinculada.', 409)
  if (sun && sun.uid.toLowerCase() !== marker.uid) throw new ArtworkError('BAD_READ', 'Esta etiqueta não é desta obra.', 422)
  const valid = await verifyBuyerTap(marker, sun)
  const read = await prisma.markerRead.create({ data: { markerId: marker.id, counter: sun?.ctr ?? marker.readCounter, cmacValid: valid, purpose: 'DELIVERY_CONFIRM', userId } })
  if (!valid) throw new ArtworkError('BAD_READ', 'Leitura inválida.', 422)
  await prisma.deal.update({ where: { id: dealId }, data: { deliveredAt: new Date(), deliveryMarkerReadId: read.id } })
  await advance(dealId, 'SHIPPING', 'Entrega e leitura da etiqueta', 'Leitura válida · posse confirmada', 'BUYER')
  await completeTransfer(dealId)
}

/** TRANSFER → COMPLETED: new certificate version to the buyer, OwnershipTransfer, split released, artwork SOLD. */
async function completeTransfer(dealId: number) {
  await totalScope('deals:complete', async () => {
    const d = await prisma.deal.findUniqueOrThrow({ where: { id: dealId }, include: { offer: true, artwork: { include: { certificate: { include: { versions: { where: { status: 'ACTIVE' }, take: 1 } } } } }, royalty: true } })
    const cert = d.artwork.certificate
    if (!cert || !cert.versions[0]) throw new ArtworkError('NO_CERTIFICATE', 'A obra não tem certificado ativo.', 409)
    const prev = cert.versions[0]
    const buyer = await prisma.user.findUniqueOrThrow({ where: { id: d.buyerUserId } })
    const content = { ...JSON.parse(prev.contentJson), holder: { name: d.offer.buyerName, documentMask: d.offer.buyerDocumentMask }, version: prev.version + 1, transfer: { dealCode: d.code, at: new Date().toISOString() } }
    const { contentHashOf } = await import('@/lib/certificates/core')
    const contentHash = contentHashOf(content)
    await prisma.$transaction(async (tx) => {
      await tx.certificateVersion.update({ where: { id: prev.id }, data: { status: 'SUPERSEDED' } })
      const v = await tx.certificateVersion.create({ data: { certificateId: cert.id, version: prev.version + 1, holderName: d.offer.buyerName, holderDocumentHash: d.offer.buyerDocumentHash, holderDocumentMask: d.offer.buyerDocumentMask, holderUserId: buyer.id, contentJson: JSON.stringify(content), contentHash, prevHash: prev.contentHash, status: 'ACTIVE' } })
      await tx.certificate.update({ where: { id: cert.id }, data: { currentVersionId: v.id } })
      await tx.ownershipTransfer.create({ data: { certificateId: cert.id, artworkId: d.artworkId, dealId: d.id, fromUserId: prev.holderUserId ?? 0, toUserId: buyer.id, toName: d.offer.buyerName, toEmail: d.offer.buyerEmail, toDocumentHash: d.offer.buyerDocumentHash, toDocumentMask: d.offer.buyerDocumentMask, priceCents: d.amountCents, royaltyCents: d.royalty?.royaltyCents ?? 0n, status: 'COMPLETED', completedAt: new Date(), newVersionId: v.id } })
      await tx.dealSplit.updateMany({ where: { dealId: d.id }, data: { status: 'RELEASED' } })
      await tx.invoice.updateMany({ where: { dealId: d.id, status: 'HELD_IN_SPLIT' }, data: { status: 'PAID' } })
      await tx.deal.update({ where: { id: d.id }, data: { phase: 'COMPLETED', completedAt: new Date() } })
      await tx.dealPhaseEvent.create({ data: { dealId: d.id, phase: 'COMPLETED', title: 'Escritura emitida', description: 'Novo titular registrado e valores liberados', actorKind: 'SYSTEM' } })
      await tx.offer.updateMany({ where: { id: d.offerId }, data: { status: 'CONVERTED' } })
      // The artwork now belongs to the buyer (collector member born here when needed): held, not for sale, secondary from now on.
      await moveArtworkToHolder(tx, d.artworkId, buyer.id)
    })
    await recordEvent(d.artworkId, 'TRANSFERRED', { dealCode: d.code, version: prev.version + 1 }, buyer.id)
    await notify({ userId: buyer.id, email: buyer.email, kind: 'certificate.transferred', title: 'Escritura emitida em seu nome', body: 'A obra entrou na sua carteira.', href: '/wallet', emailSubject: 'Escritura emitida em seu nome' })
    // The seller's money: Transfers from the platform balance to the ENABLED Connect accounts, after the commit and
    // after the response. A line without an account stays RELEASED (manual Pix); a Stripe refusal is written on the
    // line and the hourly cron tries again — the completion itself never fails because of the payout.
    await afterResponseOrNow('connect:payout', () => payDealSplits(d.id))
  })
}

/** "Tentar de novo" (team or the seller): pays the RELEASED lines of a completed deal now. */
export async function retryDealPayout(dealId: number) {
  const d = await prisma.deal.findUnique({ where: { id: dealId }, select: { phase: true } })
  if (!d) throw new ArtworkError('NOT_FOUND', 'Negócio não encontrado.', 404)
  if (d.phase !== 'COMPLETED') throw new ArtworkError('WRONG_PHASE', 'O repasse sai depois que o negócio é concluído.', 409)
  return payDealSplits(dealId)
}
