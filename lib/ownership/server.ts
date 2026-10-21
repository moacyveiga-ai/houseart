// Off-platform ownership transfer ("Vendeu fora da HouseArt? Registre a nova
// titularidade"): Comprador → Valor → Assinaturas → Toque do comprador.
// Fee R$ 199 (STRIPE_ENV=mock marks paid; real Stripe is Phase 5).
import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { audit } from '@/lib/audit'
import { flagOn } from '@/lib/flags'
import { protectDocument } from '@/lib/crypto/cipher'
import { normalizeEmail } from '@/lib/auth/credential'
import { ArtworkError } from '@/lib/artworks/server'
import { notify } from '@/lib/notifications/server'
import { ensureCollectorUser } from '@/lib/accounts/collector-server'
import { verifyIdentity } from '@/lib/kyc/server'
import { royaltyFor } from '@/lib/resale-royalty/core'
import { recordEvent } from '@/lib/certificate-events/server'
import { contentHashOf, sha256Hex } from '@/lib/certificates/core'
import { publicBaseUrl } from '@/lib/public-url'
import { mockMasterKey, verifySun } from '@/lib/physical-markers/sun-core'

export const TRANSFER_FEE_CENTS = 19900n
const sha = (v: string) => createHash('sha256').update(v).digest('hex')

/** The artworks the user currently holds (ACTIVE version with holderUserId = user). */
export async function heldArtworks(userId: number) {
  return prisma.certificateVersion.findMany({
    where: { holderUserId: userId, status: 'ACTIVE' },
    include: { certificate: { include: { artwork: { include: { artist: true, media: { where: { kind: 'FRONT_COLOR_CARD' }, take: 1 }, insurancePolicies: { where: { status: 'ACTIVE', kind: 'COLLECTION' }, take: 1 } } } } } },
    orderBy: { issuedAt: 'desc' },
  })
}

async function heldVersion(userId: number, artworkId: number) {
  const v = await prisma.certificateVersion.findFirst({ where: { holderUserId: userId, status: 'ACTIVE', certificate: { artworkId } }, include: { certificate: { include: { artwork: { include: { artist: true } } } } } })
  if (!v) throw new ArtworkError('NOT_HOLDER', 'Você não é o titular desta obra.', 404)
  return v
}

export async function royaltyPreview(userId: number, artworkId: number, priceCents: bigint): Promise<{ royaltyCents: bigint; appreciationCents: bigint; artistName: string }> {
  const v = await heldVersion(userId, artworkId)
  const previous = await lastPrice(artworkId)
  const r = royaltyFor(priceCents, previous)
  return { ...r, artistName: v.certificate.artwork.artist.name }
}

async function lastPrice(artworkId: number): Promise<bigint> {
  const t = await prisma.ownershipTransfer.findFirst({ where: { artworkId, status: 'COMPLETED', priceCents: { not: null } }, orderBy: { completedAt: 'desc' } })
  if (t?.priceCents) return t.priceCents
  const d = await prisma.deal.findFirst({ where: { artworkId, phase: 'COMPLETED' }, orderBy: { completedAt: 'desc' } })
  return d?.amountCents ?? 0n
}

/** Steps 1–2: the holder creates the transfer and the buyer is invited by e-mail (token link). */
export async function createTransfer(userId: number, i: { artworkId: number; toDocument: string; toEmail: string; toName: string; priceCents: bigint; priceSealed: boolean }) {
  if (!flagOn('FLAG_OWNERSHIP_TRANSFER')) throw new ArtworkError('OFF', 'Transferência fora da plataforma não está ligada.', 404)
  const v = await heldVersion(userId, i.artworkId)
  const email = normalizeEmail(i.toEmail)
  if (!email) throw new ArtworkError('BAD_EMAIL', 'Informe um e-mail válido.', 400)
  if (i.priceCents <= 0n) throw new ArtworkError('BAD_PRICE', 'Informe o valor da venda.', 400)
  const open = await prisma.ownershipTransfer.count({ where: { artworkId: i.artworkId, status: { notIn: ['COMPLETED', 'CANCELLED'] } } })
  if (open) throw new ArtworkError('OPEN_TRANSFER', 'Já existe uma transferência em curso para esta obra.', 409)
  const doc = protectDocument(i.toDocument)
  const royalty = flagOn('FLAG_RESALE_ROYALTY') ? royaltyFor(i.priceCents, await lastPrice(i.artworkId)).royaltyCents : 0n
  const token = randomBytes(24).toString('base64url')
  const t = await prisma.ownershipTransfer.create({ data: {
    certificateId: v.certificateId, artworkId: i.artworkId, fromUserId: userId, toName: i.toName.trim().slice(0, 120), toEmail: email, toDocumentHash: doc.hash, toDocumentEnc: doc.enc, toDocumentMask: doc.mask,
    priceCents: i.priceCents, priceSealed: i.priceSealed, sealedPriceHash: i.priceSealed ? sha256Hex(`${i.artworkId}:${i.priceCents}:${doc.hash}`) : null, royaltyCents: royalty, feeCents: TRANSFER_FEE_CENTS,
    status: 'INVITED', inviteTokenHash: sha(token), inviteIssuedAt: new Date(),
  } })
  await notify({ userId: null, email, kind: 'transfer.invite', title: `Transferência de “${v.certificate.artwork.title}”`, body: `${publicBaseUrl()}/transfer/${token}`, emailSubject: 'Você foi convidado a receber a titularidade de uma obra' })
  void audit.event({ entity: 'ownership_transfer', entityId: t.id, action: 'create', userId })
  return { id: t.id, royaltyCents: royalty }
}

export async function transferOf(userId: number, id: number) {
  const t = await prisma.ownershipTransfer.findFirst({ where: { id, fromUserId: userId }, include: { artwork: { include: { artist: true } } } })
  if (!t) throw new ArtworkError('NOT_FOUND', 'Transferência não encontrada.', 404)
  return t
}

export async function listTransfers(userId: number) {
  return prisma.ownershipTransfer.findMany({ where: { fromUserId: userId }, include: { artwork: { select: { title: true, year: true, publicId: true } } }, orderBy: { createdAt: 'desc' }, take: 20 })
}

/** The buyer's page by token: identity (KYC mock) + signature. */
export async function buyerTransfer(token: string) {
  return totalScope('transfer:buyer', async () => {
    const t = await prisma.ownershipTransfer.findUnique({ where: { inviteTokenHash: sha(token) }, include: { artwork: { include: { artist: true } } } })
    if (!t || t.status === 'CANCELLED') return null
    return t
  })
}

export async function buyerAcceptTransfer(token: string, documentRaw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  return totalScope('transfer:buyer-accept', async () => {
    const t = await buyerTransfer(token)
    if (!t || t.buyerSignedAt) return { ok: false, error: 'Convite inválido ou já assinado.' }
    let doc
    try { doc = protectDocument(documentRaw) } catch { return { ok: false, error: 'CPF inválido.' } }
    if (doc.hash !== t.toDocumentHash) return { ok: false, error: 'O CPF não confere com o do convite.' }
    const buyer = await ensureCollectorUser(t.toEmail, t.toName)
    const kyc = await verifyIdentity(buyer.id, doc.hash)
    if (kyc !== 'APPROVED') { await prisma.ownershipTransfer.update({ where: { id: t.id }, data: { toUserId: buyer.id, kycStatus: 'PENDING', status: 'KYC_PENDING' } }); return { ok: false, error: 'Identidade em verificação.' } }
    await prisma.ownershipTransfer.update({ where: { id: t.id }, data: { toUserId: buyer.id, kycStatus: 'APPROVED', buyerSignedAt: new Date() } })
    await afterSignature(t.id)
    return { ok: true }
  })
}

export async function sellerSign(userId: number, id: number) {
  const t = await transferOf(userId, id)
  if (t.sellerSignedAt) throw new ArtworkError('ALREADY_SIGNED', 'Você já assinou.', 409)
  await prisma.ownershipTransfer.update({ where: { id }, data: { sellerSignedAt: new Date() } })
  await afterSignature(id)
}

async function afterSignature(id: number) {
  const t = await prisma.ownershipTransfer.findUniqueOrThrow({ where: { id } })
  if (t.sellerSignedAt && t.buyerSignedAt && ['INVITED', 'KYC_PENDING', 'SELLER_SIGNED', 'BUYER_SIGNED'].includes(t.status)) {
    await prisma.ownershipTransfer.update({ where: { id }, data: { status: 'SIGNED' } })
  } else if (t.sellerSignedAt && t.status === 'INVITED') await prisma.ownershipTransfer.update({ where: { id }, data: { status: 'SELLER_SIGNED' } })
  else if (t.buyerSignedAt && t.status === 'INVITED') await prisma.ownershipTransfer.update({ where: { id }, data: { status: 'BUYER_SIGNED' } })
}

/** "Pagar R$ 199 e concluir": fee (mock) → AWAITING_TAP. */
export async function payTransferFee(userId: number, id: number, paymentRef: string | null = null) {
  const t = await transferOf(userId, id)
  if (t.status !== 'SIGNED') throw new ArtworkError('NOT_SIGNED', 'As duas assinaturas vêm antes da taxa.', 409)
  const ref = paymentRef ?? (process.env.STRIPE_ENV === 'live' ? null : `mock_fee_${id}_${Date.now()}`)
  if (!ref) throw new ArtworkError('PAYMENT_REQUIRED', 'Pagamento real ainda não disponível.', 503)
  const r = await prisma.ownershipTransfer.updateMany({ where: { id, status: 'SIGNED' }, data: { status: 'AWAITING_TAP', feePaidAt: new Date(), feePaymentRef: ref } })
  if (r.count === 0) throw new ArtworkError('CHANGED', 'A transferência acabou de mudar.', 409)
  const buyer = t.toUserId ? await prisma.user.findUnique({ where: { id: t.toUserId }, select: { email: true } }) : null
  await notify({ userId: t.toUserId, email: buyer?.email ?? t.toEmail, kind: 'transfer.awaiting_tap', title: 'Falta o seu toque na etiqueta', body: 'Com a obra em mãos, encoste o celular na etiqueta do verso.', href: '/wallet', emailSubject: 'Falta o toque na etiqueta' })
}

/** The buyer's tap (TRANSFER_CONFIRM) → COMPLETED: new version, royalty, holder. */
export async function buyerTap(token: string, sun: { uid: string; ctr: number; cmac: string } | null): Promise<{ ok: true } | { ok: false; error: string }> {
  return totalScope('transfer:tap', async () => {
    const t = await buyerTransfer(token)
    if (!t || t.status !== 'AWAITING_TAP' || !t.toUserId) return { ok: false, error: 'A transferência não está aguardando o toque.' }
    const marker = await prisma.physicalMarker.findFirst({ where: { artworkId: t.artworkId, status: 'LINKED' } })
    if (!marker) return { ok: false, error: 'A obra não tem etiqueta vinculada.' }
    let valid = false
    if (sun) valid = sun.uid.toLowerCase() === marker.uid && verifySun({ master: mockMasterKey(), uid: marker.uid, counter: sun.ctr, cmac: sun.cmac, lastCounter: marker.readCounter }).ok
    else if ((process.env.MARKER_VENDOR ?? 'mock') === 'mock') valid = true
    const read = await prisma.markerRead.create({ data: { markerId: marker.id, counter: sun?.ctr ?? marker.readCounter, cmacValid: valid, purpose: 'TRANSFER_CONFIRM', userId: t.toUserId } })
    if (!valid) return { ok: false, error: 'Leitura inválida.' }
    const prev = await prisma.certificateVersion.findFirst({ where: { certificateId: t.certificateId, status: 'ACTIVE' } })
    if (!prev) return { ok: false, error: 'Certificado sem versão ativa.' }
    const content = { ...JSON.parse(prev.contentJson), holder: { name: t.toName, documentMask: t.toDocumentMask }, version: prev.version + 1, transfer: { offPlatform: true, priceSealed: t.priceSealed, at: new Date().toISOString() } }
    const contentHash = contentHashOf(content)
    await prisma.$transaction(async (tx) => {
      const r = await tx.ownershipTransfer.updateMany({ where: { id: t.id, status: 'AWAITING_TAP' }, data: { status: 'COMPLETED', completedAt: new Date(), tapMarkerReadId: read.id } })
      if (r.count === 0) throw new ArtworkError('CHANGED', 'A transferência acabou de mudar.', 409)
      await tx.certificateVersion.update({ where: { id: prev.id }, data: { status: 'SUPERSEDED' } })
      const v = await tx.certificateVersion.create({ data: { certificateId: t.certificateId, version: prev.version + 1, holderName: t.toName, holderDocumentHash: t.toDocumentHash, holderDocumentMask: t.toDocumentMask, holderUserId: t.toUserId, contentJson: JSON.stringify(content), contentHash, prevHash: prev.contentHash, status: 'ACTIVE' } })
      await tx.certificate.update({ where: { id: t.certificateId }, data: { currentVersionId: v.id } })
      await tx.ownershipTransfer.update({ where: { id: t.id }, data: { newVersionId: v.id } })
      await tx.artwork.update({ where: { id: t.artworkId }, data: { market: 'SECONDARY' } })
      if (t.royaltyCents > 0n) {
        const a = await tx.artwork.findUniqueOrThrow({ where: { id: t.artworkId }, select: { artistId: true } })
        await tx.royaltyPayment.create({ data: { artworkId: t.artworkId, artistId: a.artistId, transferId: t.id, saleCents: t.priceCents ?? 0n, previousSaleCents: (t.priceCents ?? 0n) - (t.royaltyCents * 20n), appreciationCents: t.royaltyCents * 20n, royaltyCents: t.royaltyCents, status: 'PENDING' } })
      }
    })
    await recordEvent(t.artworkId, 'TRANSFERRED', { offPlatform: true, version: prev.version + 1, priceSealed: t.priceSealed }, t.toUserId)
    await notify({ userId: t.toUserId, email: t.toEmail, kind: 'certificate.transferred', title: 'Escritura emitida em seu nome', href: '/wallet', emailSubject: 'Escritura emitida em seu nome' })
    return { ok: true }
  })
}
