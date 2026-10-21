// Phase 5 end to end: the artist's plan and usage bars, "Mudar de plano"
// (Stripe mock → PLAN invoice), a marker kit as a paid order, the
// collector's appraisal request (APPRAISAL_SIGNED order), the appraiser's
// queue + dossier with comparables, the issued report (signed hash, PDF in
// the vault, HA-L code) verifiable in public, and the wizard's estimate
// derived from the same comparables.
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { requestMarkers } from '@/lib/physical-markers/server'
import { billingView } from '@/lib/billing/server'
import { changePlan, registrationGate, usageOf } from '@/lib/plans/server'
import { placeOrder } from '@/lib/orders/server'
import { appraisalDossier, appraisalQueue, estimateForArtwork, issueAppraisal, publicAppraisal, requestAppraisal } from '@/lib/appraisal/server'
import { verifyJws } from '@/lib/certificates/signing'
import { readVaultFile } from '@/lib/storage/private-vault'
import { createScenario, type Scenario } from './fixtures'
import { truncateTables } from './db'
import { asPanel } from './session'

const cwd = process.cwd()
let dir = ''
let s: Scenario
beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'ha-bill-')); process.chdir(dir)
  delete process.env.VERCEL; delete process.env.BLOB_READ_WRITE_TOKEN; delete process.env.BLOB_PRIVATE_READ_WRITE_TOKEN
  process.env.STRIPE_ENV = 'mock'; process.env.FLAG_ORDERS = '1'; process.env.FLAG_PLANS = '1'; process.env.FLAG_APPRAISAL = '1'; process.env.FLAG_BILLING = '1'
})
afterAll(() => { process.chdir(cwd); rmSync(dir, { recursive: true, force: true }) })
beforeEach(async () => { s = await createScenario(); await truncateTables(['PlanSubscription', 'Order', 'Invoice', 'AppraisalRequest', 'AppraisalComparable', 'MarkerOrder', 'Notification']) })

const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x))

describe('billing and appraisal', () => {
  it('plan, usage, plan change, orders and invoices', async () => {
    await asPanel(s.b.userId, async ({ scope, user }) => {
      const u0 = await usageOf(scope)
      expect(u0?.plan.code).toBe('ARTIST_FREE')
      expect(u0?.bars.map((b) => [b.label, b.text])).toEqual([['Obras cadastradas', '1 de 10'], ['Etiquetas disponíveis', '0 de 0'], ['Laudos incluídos', '0 de 0']])
      expect(await registrationGate(scope)).toEqual({ ok: true })
      // gallery plans are refused to an artist; the same plan is a 409
      await expect(changePlan(scope, 'GALLERY_PRO', { userId: user.id })).rejects.toMatchObject({ code: 'BAD_PLAN' })
      await expect(changePlan(scope, 'ARTIST_FREE', { userId: user.id })).rejects.toMatchObject({ code: 'SAME_PLAN' })
      await changePlan(scope, 'ARTIST_STUDIO', { userId: user.id })
      const u1 = await usageOf(scope)
      expect(u1?.plan).toMatchObject({ code: 'ARTIST_STUDIO', priceCents: 4900n })
      expect(u1?.bars[0].text).toBe('1 de 60')
      // a kit of 3 tags is a paid order (R$ 15 each)
      await requestMarkers(scope, 3)
      const v = await billingView(scope, user.id)
      expect(v.plan).toMatchObject({ name: 'Ateliê', priceLabel: 'R$ 49' })
      expect(v.options.map((o) => o.code)).toEqual(['ARTIST_FREE', 'ARTIST_STUDIO'])
      expect(v.invoices.map((i) => [i.description, i.amountCents, i.statusLabel])).toEqual([['Kit de etiquetas NFC × 3', 4500n, 'Paga'], ['Plano Ateliê · mensalidade', 4900n, 'Paga']])
      expect(await prisma.planSubscription.count({ where: { tenantId: s.b.tenantId, status: 'ACTIVE' } })).toBe(1)
      await changePlan(scope, 'ARTIST_FREE', { userId: user.id })
      expect(await prisma.planSubscription.count({ where: { tenantId: s.b.tenantId, status: 'ACTIVE' } })).toBe(1)
      expect(await prisma.planSubscription.count({ where: { tenantId: s.b.tenantId, status: 'CANCELLED' } })).toBe(1)
    }, 'ARTIST')
    // the gallery admin sees the gallery plan and never the artist's invoices
    await asPanel(s.a1.userId, async ({ scope, user }) => {
      const v = await billingView(scope, user.id)
      expect(v.plan?.name).toBe('Galeria')
      expect(v.bars.map((b) => b.label)).toEqual(['Certificações no mês', 'Viewing rooms ativos', 'Assentos da equipe'])
      expect(v.bars[2].text).toBe('2 de 3')
      expect(v.invoices).toEqual([])
    })
    // a quote-only service is refused; the flag off returns null without charging
    await expect(placeOrder({ serviceCode: 'SHIPPING', payerKind: 'BUYER' })).rejects.toMatchObject({ code: 'QUOTE_REQUIRED' })
    process.env.FLAG_ORDERS = '0'
    expect(await placeOrder({ serviceCode: 'TAG_KIT', payerKind: 'ARTIST' })).toBeNull()
    process.env.FLAG_ORDERS = '1'
  })

  it('appraisal: request → queue → dossier with comparables → issue → public verification; the wizard estimate', async () => {
    // a collector holds the artist's artwork (version ACTIVE), and the artist has two registered sales
    const pw = await hashPassword('senha-forte-1')
    const collector = await prisma.user.create({ data: { email: 'col@col.test', name: 'Helena Prado', passwordHash: pw, profile: 'collector', active: true, profiles: { create: { kind: 'COLLECTOR', isDefault: true } } } })
    const appraiser = await prisma.user.create({ data: { email: 'ava@houseart.test', name: 'Rui Avaliador', passwordHash: pw, profile: 'appraiser', active: true, profiles: { create: { kind: 'APPRAISER', isDefault: true } } } })
    await prisma.artwork.update({ where: { id: s.b.artworkId }, data: { publicId: 'HA-2026-TEST-0009', technique: 'Óleo sobre linho', year: 2024, heightMm: 800, widthMm: 600, conditionGrade: 'EXCELLENT', status: 'AUTHENTICATED' } })
    const cert = await prisma.certificate.create({ data: { artworkId: s.b.artworkId, publicId: 'HA-2026-TEST-0009', status: 'ACTIVE', stage: 5, issuedAt: new Date() } })
    await prisma.certificateVersion.create({ data: { certificateId: cert.id, version: 1, holderName: 'Helena Prado', holderUserId: collector.id, contentJson: '{}', contentHash: 'x'.repeat(64), status: 'ACTIVE' } })
    const artist = await prisma.artist.findUniqueOrThrow({ where: { memberId: s.b.memberId } })
    await prisma.appraisalComparable.createMany({ data: [
      { artistId: artist.id, label: 'Maré, 2023', dimensions: '80 × 60 cm', priceCents: 1_900_000n, soldOn: new Date('2025-06-01'), source: 'GALLERY' },
      { artistId: artist.id, label: 'Lote 44 · Bolsa de Arte', dimensions: '70 × 50 cm', priceCents: 2_400_000n, soldOn: new Date('2025-11-10'), source: 'AUCTION' },
    ] })

    // the wizard's estimate for a second artwork of the same artist
    await asPanel(s.b.userId, async ({ scope }) => {
      const e = await estimateForArtwork(scope, s.b.artworkId)
      expect(e).toMatchObject({ minCents: 1_800_000n, suggestedCents: 2_200_000n, maxCents: 2_800_000n, count: 2 })
    }, 'ARTIST')
    await asPanel(s.a1.userId, async ({ scope }) => { await expect(estimateForArtwork(scope, s.b.artworkId)).rejects.toMatchObject({ status: 404 }) })

    // the collector asks for the report (paid order R$ 390); a second request is refused while open
    const req = await requestAppraisal({ userId: collector.id, name: collector.name, scope: null }, { artworkId: s.b.artworkId, purpose: 'INSURANCE', requesterLabel: 'Colecionador' })
    expect(req.orderCode).toMatch(/^ORD-\d{4}-\d{6}$/)
    await expect(requestAppraisal({ userId: collector.id, name: collector.name, scope: null }, { artworkId: s.b.artworkId, purpose: 'SALE', requesterLabel: 'Colecionador' })).rejects.toMatchObject({ code: 'OPEN_REQUEST' })
    // a stranger (gallery staff) cannot ask for an artwork out of reach
    await asPanel(s.a1.userId, async ({ scope, user }) => { await expect(requestAppraisal({ userId: user.id, name: user.name, scope }, { artworkId: s.a2.artworkId + 100, purpose: 'SALE', requesterLabel: 'Galeria' })).rejects.toMatchObject({ status: 404 }) })
    expect((await prisma.order.findFirstOrThrow({ where: { appraisalRequestId: req.id, userId: collector.id } })).amountCents).toBe(39_000n)

    // the appraiser's queue and dossier
    const queue = await appraisalQueue()
    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({ id: req.id, title: 'Obra de Joana Teixeira, 2024 · Joana Teixeira', who: 'Colecionador · Seguro', overdue: false })
    const d = await appraisalDossier(req.id)
    expect(d?.provenanceLine).toBe('Proveniência: 0 eventos · condition report excelente · etiqueta não vinculada')
    expect(d?.comparables.map((c) => c.label)).toEqual(['Lote 44 · Bolsa de Arte', 'Maré, 2023'])
    expect(d?.estimate).toMatchObject({ suggestedCents: '2200000', count: 2 })
    expect(d?.issued).toBeNull()

    // issue: bad range refused; good range → ISSUED with signed hash, PDF and code
    await expect(issueAppraisal({ userId: appraiser.id, name: appraiser.name }, req.id, { minCents: 3_000_000n, suggestedCents: 2_000_000n, maxCents: 1_000_000n, methodology: 'Comparação direta com vendas registradas.' })).rejects.toMatchObject({ code: 'BAD_RANGE' })
    const issued = await issueAppraisal({ userId: appraiser.id, name: appraiser.name }, req.id, { minCents: 1_800_000n, suggestedCents: 2_200_000n, maxCents: 2_600_000n, methodology: 'Comparação direta com vendas registradas do mesmo artista, ajustada por dimensão.' })
    expect(issued.code).toMatch(/^HA-L-\d{4}-[A-Z2-9]{4}$/)
    await expect(issueAppraisal({ userId: appraiser.id, name: appraiser.name }, req.id, { minCents: 1n, suggestedCents: 2n, maxCents: 3n, methodology: 'Comparação direta com vendas registradas.' })).rejects.toMatchObject({ code: 'ALREADY_ISSUED' })
    const row = await prisma.appraisal.findUniqueOrThrow({ where: { requestId: req.id } })
    expect(row).toMatchObject({ status: 'ISSUED', version: 1, contentHash: issued.contentHash, verificationCode: issued.code })
    const sig = JSON.parse(row.signatureJson!) as { appraiserJws: string }
    expect(verifyJws(sig.appraiserJws)).toMatchObject({ typ: 'appraisal', code: issued.code, contentHash: issued.contentHash, signedBy: appraiser.id })
    const pdf = await readVaultFile(row.pdfRef!)
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    expect((await prisma.appraisalRequest.findUniqueOrThrow({ where: { id: req.id } })).status).toBe('ISSUED')
    expect(await appraisalQueue()).toEqual([])
    expect((await appraisalDossier(req.id))?.issued).toMatchObject({ code: issued.code, suggestedCents: '2200000' })
    // the requester was told; the public page confirms the paper and never names the requester
    expect(await prisma.notification.count({ where: { userId: collector.id, kind: 'appraisal.issued' } })).toBe(1)
    const pub = await publicAppraisal(issued.code)
    expect(pub).toMatchObject({ status: 'ISSUED', purpose: 'Seguro', suggestedCents: '2200000', appraiser: 'Rui Avaliador', artwork: { publicId: 'HA-2026-TEST-0009' } })
    expect(json(pub)).not.toContain('Helena')
    expect(await publicAppraisal('HA-L-2026-ZZZZ')).toBeNull()
  })
})
