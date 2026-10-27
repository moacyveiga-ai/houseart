// Phase 4 end to end: a certified artwork is listed, the offer is accepted
// (negotiator) → Deal; escrow (mock) → both signatures → shipping → the
// buyer's tap (mock vendor) → COMPLETED with a new certificate version, an
// OwnershipTransfer and the split RELEASED. Then the collector sells it off
// the platform: invite → buyer accepts (KYC mock) → both sign → fee → tap →
// new version, with the resale royalty of 5 % over the appreciation.
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { awaitDetached } from '@/lib/after'
import { submitForCertification } from '@/lib/artworks/server'
import { uploadMedia } from '@/lib/artworks/media-server'
import { createBatch, linkMarker, requestMarkers, shipOrder } from '@/lib/physical-markers/server'
import { mockSunMessage } from '@/lib/physical-markers/sun-core'
import { certificationView, issueCertificate, publicCertificate, signCertificate } from '@/lib/certificates/server'
import { confirmPublicOffer, listArtworkForSale, startPublicOffer } from '@/lib/offers/server'
import { arrivingPurchases, bookShipping, buyerDeals, confirmDelivery, dealReceiptPdf, payEscrow, sellerDeals, signAgreement } from '@/lib/deals/server'
import { buyerAcceptTransfer, buyerTap, createTransfer, payTransferFee, royaltyPreview, sellerSign } from '@/lib/ownership/server'
import { walletOf, insureArtwork } from '@/lib/collector-wallet/server'
import { royaltyView } from '@/lib/resale-royalty/server'
import { royaltyFor } from '@/lib/resale-royalty/core'
import { computeSplit } from '@/lib/commission/split-core'
import { createScenario, type Scenario } from './fixtures'
import { truncateTables } from './db'
import { asPanel } from './session'

/** The invite link only travels by e-mail: the test reads it from the mail door, never from a return value. */
const sentMails: { to: string; text: string }[] = []
vi.mock('@/lib/email/send', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/email/send')>()
  return { ...mod, sendEmail: async (mail: { to: string; text: string; subject: string }) => { sentMails.push({ to: mail.to, text: mail.text }); return mod.sendEmail(mail) } }
})

const cwd = process.cwd()
let dir = ''
let s: Scenario
beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'ha-deal-')); process.chdir(dir)
  delete process.env.VERCEL; delete process.env.BLOB_READ_WRITE_TOKEN; delete process.env.BLOB_PRIVATE_READ_WRITE_TOKEN
  process.env.MARKER_VENDOR = 'mock'; process.env.STRIPE_ENV = 'mock'; process.env.KYC_PROVIDER = 'mock'
  process.env.FLAG_DEALS = '1'; process.env.FLAG_OWNERSHIP_TRANSFER = '1'; process.env.FLAG_RESALE_ROYALTY = '1'
})
afterAll(() => { process.chdir(cwd); rmSync(dir, { recursive: true, force: true }) })
beforeEach(async () => { s = await createScenario(); await truncateTables(['MarkerBatch', 'MarkerOrder', 'Mandate', 'Offer', 'Deal', 'OwnershipTransfer', 'Notification', 'Contact']) })

const png = (c: { r: number; g: number; b: number }) => sharp({ create: { width: 200, height: 160, channels: 3, background: c } }).png().toBuffer()
const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x))

async function otpOf(code: string): Promise<string> {
  const { createHash } = await import('node:crypto')
  const o = await prisma.offer.findUniqueOrThrow({ where: { code } })
  for (let i = 0; i < 1_000_000; i++) { const c = String(i).padStart(6, '0'); if (createHash('sha256').update(c).digest('hex') === o.otpHash) return c }
  throw new Error('otp')
}

/** Certifies the artist's artwork with a linked tag (the Phase 2 path). */
async function certify(): Promise<{ publicId: string; uid: string }> {
  const staff = { userId: s.staff.userId, name: 'Equipe' }
  await asPanel(s.b.userId, async ({ scope, user }) => {
    await uploadMedia(scope, s.b.artworkId, 'FRONT_COLOR_CARD', { bytes: await png({ r: 10, g: 120, b: 200 }), declaredType: 'image/png' })
    await uploadMedia(scope, s.b.artworkId, 'BACK', { bytes: await png({ r: 240, g: 240, b: 230 }), declaredType: 'image/png' })
    await prisma.artwork.update({ where: { id: s.b.artworkId }, data: { technique: 'Óleo sobre linho', year: 2024 } })
    await submitForCertification(scope, s.b.artworkId, { userId: user.id, name: user.name })
    await requestMarkers(scope, 1)
  }, 'ARTIST')
  const batch = await createBatch({ code: '2026-11', quantity: 2, destination: 'Teste' }, staff)
  const order = await prisma.markerOrder.findFirstOrThrow()
  await shipOrder(order.id, batch.id, staff)
  const marker = await prisma.physicalMarker.findFirstOrThrow({ where: { orderId: order.id } })
  return asPanel(s.b.userId, async ({ scope, user }) => {
    const { publicId } = await linkMarker(scope, { ...mockSunMessage(marker.uid, 1), artworkId: s.b.artworkId }, { userId: user.id })
    const certId = (await certificationView(scope)).items[0].certificateId!
    await signCertificate(scope, certId, { userId: user.id, name: user.name, ip: '1.2.3.4' })
    await issueCertificate(scope, certId, { userId: user.id, name: user.name })
    return { publicId, uid: marker.uid }
  }, 'ARTIST')
}

describe('deal flow', () => {
  it('pure split and royalty', () => {
    const primary = computeSplit({ amountCents: 4_400_000n, market: 'PRIMARY', seller: 'ARTIST', galleryBps: 0, royaltyCents: 0n })
    expect(primary.find((l) => l.party === 'PLATFORM')?.amountCents).toBe(528_000n)
    expect(primary.reduce((a, l) => a + l.amountCents, 0n)).toBe(4_400_000n)
    // the §H example: bought for R$ 44.000, sold for R$ 49.500 → royalty R$ 275
    expect(royaltyFor(4_950_000n, 4_400_000n).royaltyCents).toBe(27_500n)
    expect(royaltyFor(4_000_000n, 4_400_000n).royaltyCents).toBe(0n)
  })

  it('accepted offer → deal → escrow → signatures → shipping → tap → new holder; then an off-platform resale with royalty', async () => {
    const { publicId, uid } = await certify()
    await asPanel(s.b.userId, async ({ scope, user }) => {
      await listArtworkForSale(scope, s.b.artworkId, { listPriceCents: 4_400_000n, reservePriceCents: 3_800_000n, autoNegotiatorOn: true, autoAcceptMinBps: 9200, fixedPrice: false }, { userId: user.id })
    }, 'ARTIST')
    const start = await startPublicOffer({ publicId, buyerName: 'Marcelo Bastos', buyerEmail: 'marcelo@col.test', buyerDocument: '52998224725', buyerCity: 'Recife/PE', offeredCents: 4_400_000n })
    if (!start.ok) throw new Error(start.error)
    expect((await confirmPublicOffer(start.code, await otpOf(start.code))).ok).toBe(true)

    // the deal was born from the auto-accept
    const offer = await prisma.offer.findUniqueOrThrow({ where: { code: start.code }, include: { deal: { include: { splits: true } } } })
    expect(offer.status).toBe('IN_DEAL')
    const deal = offer.deal!
    expect(deal.code).toMatch(/^DL-\d{4}-\d{6}$/)
    expect(deal.phase).toBe('OFFER_ACCEPTED')
    expect(deal.splits.map((l) => [l.party, l.amountCents, l.status])).toContainEqual(['PLATFORM', 528_000n, 'HELD'])
    expect((await prisma.artwork.findUniqueOrThrow({ where: { id: s.b.artworkId } })).status).toBe('IN_DEAL')
    const buyer = await prisma.user.findUniqueOrThrow({ where: { email: 'marcelo@col.test' } })
    expect(buyer.profile).toBe('collector')

    // the seller cannot sign before the escrow; the buyer pays (mock)
    await asPanel(s.b.userId, async ({ scope, user }) => {
      await expect(signAgreement('SELLER', deal.id, { userId: user.id, scope })).rejects.toMatchObject({ code: 'WRONG_PHASE' })
      const [v] = await sellerDeals(scope)
      expect(v).toMatchObject({ code: deal.code, phase: 'OFFER_ACCEPTED', buyerName: 'Marcelo Bastos' })
      expect(v.steps.map((st) => st.state)).toEqual(['done', 'on', 'todo', 'todo', 'todo', 'todo'])
    }, 'ARTIST')
    await expect(payEscrow(s.a1.userId, deal.id)).rejects.toMatchObject({ status: 404 })
    await payEscrow(buyer.id, deal.id)
    await expect(payEscrow(buyer.id, deal.id)).rejects.toMatchObject({ code: 'WRONG_PHASE' })

    // both signatures → DOCUMENTS
    await signAgreement('BUYER', deal.id, { userId: buyer.id })
    await expect(signAgreement('BUYER', deal.id, { userId: buyer.id })).rejects.toMatchObject({ code: 'ALREADY_SIGNED' })
    expect((await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } })).phase).toBe('ESCROW')
    await asPanel(s.b.userId, async ({ scope, user }) => {
      await expect(bookShipping(scope, deal.id, { carrier: 'ArtTrans', tracking: 'AT-1' })).rejects.toMatchObject({ code: 'WRONG_PHASE' })
      await signAgreement('SELLER', deal.id, { userId: user.id, scope })
      expect((await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } })).phase).toBe('DOCUMENTS')
      await bookShipping(scope, deal.id, { carrier: 'ArtTrans', tracking: 'AT-1', insurer: 'Chubb', policyRef: 'CH-9', shippingCents: 85_000n, insuranceCents: 32_000n })
    }, 'ARTIST')
    // the gallery never sees the artist's deal
    await asPanel(s.a1.userId, async ({ scope }) => {
      expect(await sellerDeals(scope)).toEqual([])
      await expect(bookShipping(scope, deal.id, { carrier: 'x', tracking: 'y' })).rejects.toMatchObject({ status: 404 })
    })

    // Coleção › "Chegando": the purchase in transit shows before the deed is the buyer's
    expect((await arrivingPurchases(buyer.id)).map((p) => [p.dealId, p.label])).toEqual([[deal.id, 'Chegando · em trânsito']])
    // the receipt only exists once the deal is completed
    await expect(dealReceiptPdf(deal.id, 'BUYER', { userId: buyer.id, scope: null })).rejects.toMatchObject({ code: 'NOT_COMPLETED' })

    // the buyer confirms delivery: wrong tag refused, valid tap completes the transfer
    await expect(confirmDelivery(buyer.id, deal.id, { uid: '00deadbeef0000', ctr: 2, cmac: 'FFFFFFFFFFFFFFFF' })).rejects.toMatchObject({ code: 'BAD_READ' })
    await expect(confirmDelivery(buyer.id, deal.id, { ...mockSunMessage(uid, 2), cmac: 'FFFFFFFFFFFFFFFF' })).rejects.toMatchObject({ code: 'BAD_READ' })
    await confirmDelivery(buyer.id, deal.id, mockSunMessage(uid, 2))
    const done = await prisma.deal.findUniqueOrThrow({ where: { id: deal.id }, include: { splits: true, phaseEvents: true } })
    expect(done.phase).toBe('COMPLETED')
    expect(done.completedAt).not.toBeNull()
    expect(done.splits.every((l) => l.status === 'RELEASED')).toBe(true)
    expect(done.phaseEvents.map((e) => e.phase)).toEqual(['OFFER_ACCEPTED', 'ESCROW', 'DOCUMENTS', 'SHIPPING', 'DELIVERY', 'COMPLETED'])
    expect((await prisma.offer.findUniqueOrThrow({ where: { id: offer.id } })).status).toBe('CONVERTED')
    // the artwork now belongs to the buyer: a COLLECTOR member is born for them and the work is held (not for sale), secondary from now on
    const owned = await prisma.artwork.findUniqueOrThrow({ where: { id: s.b.artworkId }, include: { member: true } })
    expect(owned).toMatchObject({ status: 'AUTHENTICATED', market: 'SECONDARY' })
    expect(owned.member).toMatchObject({ kind: 'COLLECTOR', userId: buyer.id })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: buyer.id } })).memberId).toBe(owned.memberId)
    expect(await prisma.mandate.count({ where: { artworkId: s.b.artworkId, status: 'ACTIVE' } })).toBe(0)
    const versions = await prisma.certificateVersion.findMany({ where: { certificate: { artworkId: s.b.artworkId } }, orderBy: { version: 'asc' } })
    expect(versions.map((v) => [v.version, v.status, v.holderUserId])).toEqual([[1, 'SUPERSEDED', s.b.userId], [2, 'ACTIVE', buyer.id]])
    expect(versions[1].prevHash).toBe(versions[0].contentHash)
    expect(versions[1].holderDocumentMask).toMatch(/\*\*\*/)
    const transfer = await prisma.ownershipTransfer.findFirstOrThrow({ where: { dealId: deal.id } })
    expect(transfer).toMatchObject({ status: 'COMPLETED', fromUserId: s.b.userId, toUserId: buyer.id, priceCents: 4_400_000n, newVersionId: versions[1].id })
    const pub = await publicCertificate(publicId)
    expect(pub).toMatchObject({ status: 'ACTIVE', version: 2, chainValid: true })
    // the holder is a private collector now: the public certificate never prints their name
    expect(pub!.holder).toMatch(/^Colecionador particular/)
    expect(json(pub)).not.toContain('52998224725')
    // the buyer's view and wallet
    const [bv] = await buyerDeals(buyer.id)
    expect(bv).toMatchObject({ phase: 'COMPLETED', progressPct: 100, escrowPaid: true, sellerSigned: true, buyerSigned: true })
    expect(json(bv)).not.toContain('3800000')
    // "Baixar comprovante": a PDF for each side; another seller and another buyer never get it
    const br = await dealReceiptPdf(deal.id, 'BUYER', { userId: buyer.id, scope: null })
    expect(Buffer.from(br.pdf).subarray(0, 5).toString()).toBe('%PDF-')
    expect(br.filename).toBe(`houseart-comprovante-${deal.code}.pdf`)
    await expect(dealReceiptPdf(deal.id, 'BUYER', { userId: s.a1.userId, scope: null })).rejects.toMatchObject({ status: 404 })
    await asPanel(s.b.userId, async ({ scope }) => {
      expect(Buffer.from((await dealReceiptPdf(deal.id, 'SELLER', { userId: s.b.userId, scope })).pdf).subarray(0, 5).toString()).toBe('%PDF-')
    }, 'ARTIST')
    await asPanel(s.a1.userId, async ({ scope }) => {
      await expect(dealReceiptPdf(deal.id, 'SELLER', { userId: s.a1.userId, scope })).rejects.toMatchObject({ status: 404 })
    })
    expect(await arrivingPurchases(buyer.id)).toEqual([])
    const wallet = await walletOf(buyer.id)
    expect(wallet.items.map((i) => [i.publicId, i.version, i.insured])).toEqual([[publicId, 2, false]])
    expect(wallet.totalCents).toBe(4_400_000n)
    // "valorização" of the collection header: one sale of the artist is no reference; six registered sales are
    const { collectionSummary } = await import('@/lib/collector-wallet/collection-server')
    expect((await collectionSummary({ id: buyer.id, memberId: null })).valuation).toBeNull()
    const artistId = (await prisma.artwork.findUniqueOrThrow({ where: { id: s.b.artworkId } })).artistId
    await prisma.appraisalComparable.createMany({ data: Array.from({ length: 6 }, (_, i) => ({ artistId, label: `Comparável ${i}`, priceCents: 5_500_000n, soldOn: new Date(), source: 'AUCTION' })) })
    expect((await collectionSummary({ id: buyer.id, memberId: null })).valuation).toMatchObject({ registeredCents: 4_400_000n, estimatedCents: 5_500_000n, changeBps: 2500, works: 1 })
    await prisma.appraisalComparable.deleteMany({ where: { artistId } })
    await insureArtwork(buyer.id, s.b.artworkId)
    expect((await walletOf(buyer.id)).items[0]).toMatchObject({ insured: true, insurer: expect.stringMatching(/^Chubb/) })
    expect((await walletOf(s.b.userId)).items).toEqual([])

    // ── off-platform resale: R$ 44.000 → R$ 49.500, royalty R$ 275 ──
    const preview = await royaltyPreview(buyer.id, s.b.artworkId, 4_950_000n)
    expect(preview).toMatchObject({ royaltyCents: 27_500n, appreciationCents: 550_000n, artistName: 'Joana Teixeira' })
    await expect(royaltyPreview(s.b.userId, s.b.artworkId, 4_950_000n)).rejects.toMatchObject({ code: 'NOT_HOLDER' })
    // the invite link only travels by e-mail (EMAIL_ECHO prints the body in dev); the seller's response has no token
    sentMails.length = 0
    const t = await createTransfer(buyer.id, { artworkId: s.b.artworkId, toDocument: '11144477735', toEmail: 'helena@col.test', toName: 'Helena Prado', priceCents: 4_950_000n, priceSealed: true })
    await awaitDetached()
    expect(t.royaltyCents).toBe(27_500n)
    expect(json(t)).not.toContain('/transfer/')
    await expect(createTransfer(buyer.id, { artworkId: s.b.artworkId, toDocument: '11144477735', toEmail: 'x@col.test', toName: 'Outro Nome', priceCents: 1n, priceSealed: false })).rejects.toMatchObject({ code: 'OPEN_TRANSFER' })
    const token = sentMails.find((m) => m.text.includes('/transfer/'))!.text.split('/transfer/')[1].trim().split(/\s/)[0]
    expect(token).toBeTruthy()
    // the buyer accepts: wrong document refused; the right one signs (KYC mock)
    expect(await buyerAcceptTransfer(token, '52998224725')).toMatchObject({ ok: false })
    expect(await buyerAcceptTransfer(token, '111.444.777-35')).toEqual({ ok: true })
    await expect(payTransferFee(buyer.id, t.id)).rejects.toMatchObject({ code: 'NOT_SIGNED' })
    await sellerSign(buyer.id, t.id)
    await expect(sellerSign(buyer.id, t.id)).rejects.toMatchObject({ code: 'ALREADY_SIGNED' })
    expect((await prisma.ownershipTransfer.findUniqueOrThrow({ where: { id: t.id } })).status).toBe('SIGNED')
    expect(await buyerTap(token, mockSunMessage(uid, 3))).toMatchObject({ ok: false })
    await payTransferFee(buyer.id, t.id)
    expect(await buyerTap(token, { ...mockSunMessage(uid, 3), cmac: 'FFFFFFFFFFFFFFFF' })).toMatchObject({ ok: false })
    // a read the delivery already consumed (ctr 2) cannot be replayed on the transfer tap
    expect(await buyerTap(token, mockSunMessage(uid, 2))).toMatchObject({ ok: false })
    expect(await buyerTap(token, mockSunMessage(uid, 3))).toEqual({ ok: true })
    expect((await prisma.physicalMarker.findUniqueOrThrow({ where: { uid } })).readCounter).toBe(3)
    const after = await prisma.ownershipTransfer.findUniqueOrThrow({ where: { id: t.id } })
    expect(after).toMatchObject({ status: 'COMPLETED', royaltyCents: 27_500n, priceSealed: true })
    const v3 = await prisma.certificateVersion.findFirstOrThrow({ where: { certificate: { artworkId: s.b.artworkId }, status: 'ACTIVE' } })
    expect(v3).toMatchObject({ version: 3, holderName: 'Helena Prado' })
    const helena = await prisma.user.findUniqueOrThrow({ where: { email: 'helena@col.test' } })
    expect((await walletOf(helena.id)).items.map((i) => i.version)).toEqual([3])
    // Helena holds it now: the artwork moved to her member too
    const helenaOwned = await prisma.artwork.findUniqueOrThrow({ where: { id: s.b.artworkId }, include: { member: true } })
    expect(helenaOwned.member).toMatchObject({ kind: 'COLLECTOR', userId: helena.id })

    // ── the collector resells on the platform (secondary mandate) and registers an own artwork ──
    const { sellOwnArtwork, registerOwnArtwork, artworkServices, orderArtworkService } = await import('@/lib/collectors/server')
    await expect(sellOwnArtwork(buyer.id, s.b.artworkId, { listPriceCents: 5_500_000n, reservePriceCents: 5_000_000n, autoNegotiatorOn: false, autoAcceptMinBps: 10000, fixedPrice: false })).rejects.toMatchObject({ status: 404 })
    await sellOwnArtwork(helena.id, s.b.artworkId, { listPriceCents: 5_500_000n, reservePriceCents: 5_000_000n, autoNegotiatorOn: false, autoAcceptMinBps: 10000, fixedPrice: false })
    expect(await prisma.artwork.findUniqueOrThrow({ where: { id: s.b.artworkId } })).toMatchObject({ status: 'LISTED', market: 'SECONDARY', listPriceCents: 5_500_000n })
    const own = await registerOwnArtwork(helena.id, { title: 'Sem título (herança)', artistName: 'Joana Teixeira', acquisitionKind: 'INHERITED', acquisitionYear: 2015, acquisitionFrom: 'Família', acquisitionPriceCents: null })
    const ownRow = await prisma.artwork.findUniqueOrThrow({ where: { id: own.id }, include: { artist: true, member: true } })
    expect(ownRow).toMatchObject({ status: 'DRAFT', acquisitionKind: 'INHERITED', acquisitionYear: 2015, member: { userId: helena.id } })
    expect(ownRow.artist.name).toBe('Joana Teixeira')
    await expect(registerOwnArtwork(helena.id, { artistName: '', acquisitionKind: 'BOUGHT_OUTSIDE' })).rejects.toMatchObject({ code: 'NO_ARTIST' })
    // services for an artwork the person holds
    const listed = (await artworkServices()).map((x) => x.code)
    expect(listed).toContain('APPRAISAL_SIGNED')
    expect(await orderArtworkService(helena.id, s.b.artworkId, 'SHIPPING')).toEqual({ quote: true })
    await expect(orderArtworkService(buyer.id, s.b.artworkId, 'APPRAISAL_SIGNED')).rejects.toMatchObject({ code: 'NOT_OWNER' })
    await expect(orderArtworkService(helena.id, s.b.artworkId, 'TAG_KIT')).rejects.toMatchObject({ code: 'BAD_SERVICE' })
    expect((await walletOf(buyer.id)).items).toEqual([])
    // the sealed price never shows in the public certificate; the royalty reached the artist's ledger
    const pub3 = await publicCertificate(publicId)
    expect(pub3).toMatchObject({ version: 3, chainValid: true })
    expect(json(pub3)).not.toContain('4950000')
    await asPanel(s.b.userId, async ({ scope }) => {
      const rv = await royaltyView(scope)
      expect(json(rv)).toContain('27500')
    }, 'ARTIST')
  })
})
