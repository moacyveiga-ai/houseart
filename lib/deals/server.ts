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
import { ensureCollectorUser } from '@/lib/accounts/collector-server'
import { computeSplit, SPLIT_PARTY_LABELS, type SplitLine } from '@/lib/commission/split-core'
import { royaltyFor } from '@/lib/resale-royalty/core'
import { recordEvent } from '@/lib/certificate-events/server'
import { verifySun, mockMasterKey } from '@/lib/physical-markers/sun-core'
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
export async function createDealFromOffer(offerId: number): Promise<{ id: number; code: string } | null> {
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
    const lines: SplitLine[] = computeSplit({ amountCents: amount, market, seller, galleryBps: DEFAULT_GALLERY_BPS, royaltyCents })
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
      if (royaltyCents > 0n) await tx.royaltyPayment.create({ data: { artworkId: o.artworkId, artistId: o.artwork.artistId, dealId: d.id, saleCents: amount, previousSaleCents: previous, appreciationCents: amount - previous, royaltyCents, status: 'HELD' } })
      return d
    })
    await notify({ userId: buyer.id, email: buyer.email, kind: 'deal.created', title: `Compra em andamento · ${o.artwork.title}`, body: 'Você tem 24 h para pagar em garantia.', href: '/purchases', emailSubject: 'Sua compra na HouseArt começou' })
    void audit.event({ entity: 'deal', entityId: deal.id, action: 'create', after: { code: deal.code, amountCents: amount.toString() } })
    return { id: deal.id, code: deal.code }
  })
}

async function lastSalePrice(artworkId: number): Promise<bigint> {
  const t = await prisma.ownershipTransfer.findFirst({ where: { artworkId, status: 'COMPLETED', priceCents: { not: null } }, orderBy: { completedAt: 'desc' } })
  if (t?.priceCents) return t.priceCents
  const d = await prisma.deal.findFirst({ where: { artworkId, phase: 'COMPLETED' }, orderBy: { completedAt: 'desc' } })
  return d?.amountCents ?? 0n
}

// ── reads ────────────────────────────────────────────────────────────────
export interface DealView {
  id: number; code: string; phase: DealPhase; progressPct: number; artworkTitle: string; artist: string; sellerName: string; cover: string | null
  amountCents: bigint; shippingCents: bigint; insuranceCents: bigint; market: string; buyerName: string
  steps: { phase: DealPhase; title: string; icon: string; description: string; date: string | null; state: 'done' | 'on' | 'todo' }[]
  split: { party: string; label: string; amountCents: bigint; status: string }[]
  shipping: { carrier: string | null; tracking: string | null; insurer: string | null } | null
  sellerSigned: boolean; buyerSigned: boolean; escrowPaid: boolean; completedAt: string | null
}

function toView(d: Awaited<ReturnType<typeof loadDeal>>): DealView {
  const idx = phaseIndex(d.phase as DealPhase)
  const events = new Map(d.phaseEvents.map((e) => [e.phase, e]))
  const steps = PHASE_STEPS.map((s, i) => {
    const e = events.get(s.phase) ?? (s.phase === 'TRANSFER' ? events.get('COMPLETED') : undefined)
    const state: 'done' | 'on' | 'todo' = i <= idx ? 'done' : i === idx + 1 ? 'on' : 'todo'
    return { phase: s.phase, title: s.title, icon: s.icon, description: e?.description ?? s.pending, date: e ? e.occurredAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : null, state }
  })
  return {
    id: d.id, code: d.code, phase: d.phase as DealPhase, progressPct: Math.round(((idx + 1) / 7) * 100), artworkTitle: `${d.artwork.title}${d.artwork.year ? `, ${d.artwork.year}` : ''}`, artist: d.artwork.artist.name,
    sellerName: d.artwork.member.displayName, cover: d.artwork.media[0]?.publicUrl ?? null, amountCents: d.amountCents, shippingCents: d.shippingCents, insuranceCents: d.insuranceCents, market: d.market, buyerName: d.offer.buyerName,
    steps, split: d.splits.map((s) => ({ party: s.party, label: SPLIT_PARTY_LABELS[s.party as keyof typeof SPLIT_PARTY_LABELS] ?? s.party, amountCents: s.amountCents, status: s.status })),
    shipping: d.carrierName ? { carrier: d.carrierName, tracking: d.trackingCode, insurer: d.insurerName } : null,
    sellerSigned: !!d.sellerSignedAt, buyerSigned: !!d.buyerSignedAt, escrowPaid: !!d.escrowPaidAt, completedAt: d.completedAt?.toISOString() ?? null,
  }
}

async function loadDeal(id: number) {
  return prisma.deal.findUniqueOrThrow({ where: { id }, include: { artwork: { include: { artist: true, member: true, media: { where: { kind: 'FRONT_COLOR_CARD' }, take: 1 } } }, offer: true, phaseEvents: { orderBy: { occurredAt: 'asc' } }, splits: true } })
}

export async function sellerDeals(scope: Scope): Promise<DealView[]> {
  const ids = await prisma.deal.findMany({ where: { ...memberFilter(scope) }, select: { id: true }, orderBy: { createdAt: 'desc' }, take: 50 })
  return Promise.all(ids.map((d) => loadDeal(d.id).then(toView)))
}

export async function buyerDeals(userId: number): Promise<DealView[]> {
  const ids = await prisma.deal.findMany({ where: { buyerUserId: userId }, select: { id: true }, orderBy: { createdAt: 'desc' }, take: 50 })
  return Promise.all(ids.map((d) => loadDeal(d.id).then(toView)))
}

async function sellerDeal(scope: Scope, id: number) {
  const d = await prisma.deal.findUnique({ where: { id }, select: { id: true, phase: true, memberId: true, tenantId: true, buyerUserId: true, sellerSignedAt: true, buyerSignedAt: true } })
  if (!d || !canView(scope, d)) throw new ArtworkError('NOT_FOUND', 'Negócio não encontrado.', 404)
  return d
}

async function buyerDeal(userId: number, id: number) {
  const d = await prisma.deal.findFirst({ where: { id, buyerUserId: userId } })
  if (!d) throw new ArtworkError('NOT_FOUND', 'Negócio não encontrado.', 404)
  return d
}

// ── phases ───────────────────────────────────────────────────────────────
/** Escrow payment. STRIPE_ENV=mock (dev/tests) marks it paid; the real PaymentIntent is Phase 5 (lib/escrow). */
export async function payEscrow(userId: number, dealId: number, paymentRef: string | null = null) {
  const d = await buyerDeal(userId, dealId)
  if (d.phase !== 'OFFER_ACCEPTED') throw new ArtworkError('WRONG_PHASE', 'O pagamento em garantia já foi feito.', 409)
  const ref = paymentRef ?? (process.env.STRIPE_ENV === 'live' ? null : `mock_pi_${dealId}_${Date.now()}`)
  if (!ref) throw new ArtworkError('PAYMENT_REQUIRED', 'Pagamento real ainda não disponível.', 503)
  await prisma.deal.update({ where: { id: dealId }, data: { escrowPaidAt: new Date(), escrowPaymentRef: ref } })
  await advance(dealId, 'OFFER_ACCEPTED', 'Pagamento em garantia', 'Pix confirmado · valor retido na HouseArt', 'BUYER')
  const seller = await prisma.member.findUnique({ where: { id: d.sellerMemberId }, select: { userId: true, user: { select: { email: true } } } })
  await notify({ userId: seller?.userId ?? null, email: seller?.user?.email, kind: 'deal.escrow_paid', title: `Pagamento em garantia recebido · ${d.code}`, href: '/sales?tab=deals', emailSubject: 'O comprador pagou em garantia' })
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
  let valid = false
  if (sun) {
    if (sun.uid.toLowerCase() !== marker.uid) throw new ArtworkError('BAD_READ', 'Esta etiqueta não é desta obra.', 422)
    valid = verifySun({ master: mockMasterKey(), uid: marker.uid, counter: sun.ctr, cmac: sun.cmac, lastCounter: marker.readCounter }).ok
  } else if ((process.env.MARKER_VENDOR ?? 'mock') === 'mock') valid = true
  const read = await prisma.markerRead.create({ data: { markerId: marker.id, counter: sun?.ctr ?? marker.readCounter, cmacValid: valid, purpose: 'DELIVERY_CONFIRM', userId } })
  if (!valid) throw new ArtworkError('BAD_READ', 'Leitura inválida.', 422)
  if (sun) await prisma.physicalMarker.update({ where: { id: marker.id }, data: { readCounter: sun.ctr, lastReadAt: new Date() } })
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
      await tx.deal.update({ where: { id: d.id }, data: { phase: 'COMPLETED', completedAt: new Date() } })
      await tx.dealPhaseEvent.create({ data: { dealId: d.id, phase: 'COMPLETED', title: 'Escritura emitida', description: 'Novo titular registrado e valores liberados', actorKind: 'SYSTEM' } })
      await tx.offer.updateMany({ where: { id: d.offerId }, data: { status: 'CONVERTED' } })
      await tx.artwork.update({ where: { id: d.artworkId }, data: { status: 'SOLD', market: 'SECONDARY' } })
      await tx.mandate.updateMany({ where: { artworkId: d.artworkId, status: 'ACTIVE' }, data: { status: 'CLOSED' } })
    })
    await recordEvent(d.artworkId, 'TRANSFERRED', { dealCode: d.code, version: prev.version + 1 }, buyer.id)
    await notify({ userId: buyer.id, email: buyer.email, kind: 'certificate.transferred', title: 'Escritura emitida em seu nome', body: 'A obra entrou na sua carteira.', href: '/wallet', emailSubject: 'Escritura emitida em seu nome' })
  })
}
