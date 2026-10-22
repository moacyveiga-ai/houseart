// The JSON routes the mobile app reads for the screens that left the WebView in
// "Apps — telas restantes nativas": Compras (the buyer's deals), the estimate of
// "Vender esta obra" and Verificar (search + tag reading). Each one: 401 without
// session where a session is required, someone else's data never shows (404 or
// empty) and the DTO carries no document, no hash of a document and no mandate.
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { listArtworkForSale, startPublicOffer } from '@/lib/offers/server'
import { GET as purchasesGet } from '@/app/api/collector/purchases/route'
import { GET as estimateGet } from '@/app/api/collector/artworks/[id]/sell-estimate/route'
import { GET as searchGet } from '@/app/api/public/certificates/route'
import { POST as readPost } from '@/app/api/public/certificates/[publicId]/read/route'
import { POST as confirmPost } from '@/app/api/deals/[id]/confirm-delivery/route'
import { createScenario, type Scenario } from './fixtures'
import { asPanel, signIn, signOut } from './session'
import { truncateTables } from './db'

const PUBLIC_ID = 'HA-2026-TEST-0009'
const estimateReq = (id: number | string, q: string) => estimateGet(new Request(`http://test/api/collector/artworks/${id}/sell-estimate?${q}`), { params: Promise.resolve({ id: String(id) }) })
const readReq = (publicId: string, body: unknown) => readPost(new Request(`http://test/api/public/certificates/${publicId}/read`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '10.0.0.9' }, body: JSON.stringify(body) }), { params: Promise.resolve({ publicId }) })

let s: Scenario
let buyerId: number
let otherId: number
beforeEach(async () => {
  process.env.FLAG_TENANT_SCOPE = '1'
  process.env.FLAG_DEALS = '1'
  process.env.MARKER_VENDOR = 'mock'
  s = await createScenario()
  await truncateTables(['Mandate', 'Offer', 'Deal', 'Contact', 'Notification', 'Conversation', 'rate_limit_bucket'])
  await prisma.artwork.update({ where: { id: s.a1.artworkId }, data: { status: 'AUTHENTICATED', seal: 'GREEN', publicId: PUBLIC_ID, technique: 'Óleo sobre tela', year: 2024, heightMm: 1000, widthMm: 800 } })
  buyerId = (await prisma.user.create({ data: { email: 'lia@col.test', name: 'Lia Souza', profile: 'collector', active: true, emailVerifiedAt: new Date() } })).id
  otherId = (await prisma.user.create({ data: { email: 'outro@col.test', name: 'Outro', profile: 'collector', active: true, emailVerifiedAt: new Date() } })).id
  signOut()
})

describe('mobile JSON routes, fase 3', () => {
  it('Compras: the buyer reads only their own deals, without the split; someone else cannot confirm the delivery', async () => {
    expect((await purchasesGet()).status).toBe(401)
    await asPanel(s.a1.userId, async ({ scope, user }) => {
      await listArtworkForSale(scope, s.a1.artworkId, { listPriceCents: 1_000_000n, reservePriceCents: 600_000n, autoNegotiatorOn: true, autoAcceptMinBps: 9000, fixedPrice: false }, { userId: user.id })
    })
    signOut()
    const r = await startPublicOffer({ publicId: PUBLIC_ID, buyerName: 'Lia Souza', buyerEmail: 'lia@col.test', buyerDocument: '52998224725', offeredCents: 1_000_000n, buyerUserId: buyerId, validityHours: 48, guaranteeMethod: 'TRANSFER_ON_ACCEPT' })
    expect(r.ok).toBe(true)
    const deal = await prisma.deal.findFirstOrThrow({ where: { buyerUserId: buyerId } })

    await signIn(buyerId, 'COLLECTOR')
    const res = await purchasesGet()
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).not.toMatch(/reservePriceCents|600000|buyerDocument|DocumentHash|"split"/)
    const body = JSON.parse(text) as { ok: boolean; simulateAllowed: boolean; deals: { id: number; code: string; phase: string; amountCents: string; buyerName: string; steps: unknown[] }[] }
    expect(body.simulateAllowed).toBe(true)
    expect(body.deals).toHaveLength(1)
    expect(body.deals[0]).toMatchObject({ id: deal.id, code: deal.code, phase: 'OFFER_ACCEPTED', amountCents: '1000000', buyerName: 'Lia Souza' })
    expect(body.deals[0]!.steps.length).toBeGreaterThan(0)

    await signIn(otherId, 'COLLECTOR')
    expect(((await (await purchasesGet()).json()) as { deals: unknown[] }).deals).toEqual([])
    const confirm = await confirmPost(new Request(`http://test/api/deals/${deal.id}/confirm-delivery`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }), { params: Promise.resolve({ id: String(deal.id) }) })
    expect(confirm.status).toBe(404)

    delete process.env.FLAG_DEALS
    expect((await purchasesGet()).status).toBe(404)
  }, 60_000)

  it('Vender esta obra: the estimate is the server\'s, only for an artwork the person holds', async () => {
    expect((await estimateReq(s.a1.artworkId, 'listPriceCents=1200000')).status).toBe(401)
    await prisma.artwork.update({ where: { id: s.a1.artworkId }, data: { listPriceCents: 1_000_000n, market: 'SECONDARY' } })
    const cert = await prisma.certificate.create({ data: { artworkId: s.a1.artworkId, publicId: PUBLIC_ID, status: 'ACTIVE', issuedAt: new Date() } })
    await prisma.certificateVersion.create({ data: { certificateId: cert.id, version: 1, holderName: 'Lia Souza', holderUserId: buyerId, contentJson: '{}', contentHash: 'x'.repeat(64), status: 'ACTIVE' } })

    await signIn(buyerId, 'COLLECTOR')
    expect((await estimateReq(s.a1.artworkId, 'listPriceCents=abc')).status).toBe(400)
    const res = await estimateReq(s.a1.artworkId, 'listPriceCents=1200000')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { estimate: Record<string, string>; registeredCents: string }
    // 4 % from the seller (48.000), 5 % of the appreciation of R$ 2.000 (10.000), the buyer pays 8 % on top
    expect(body.estimate).toEqual({ listCents: '1200000', buyerFeeCents: '96000', buyerPaysCents: '1296000', sellerFeeCents: '48000', royaltyCents: '10000', appreciationCents: '200000', netCents: '1142000' })
    expect(body.registeredCents).toBe('1000000')

    await signIn(otherId, 'COLLECTOR')
    expect((await estimateReq(s.a1.artworkId, 'listPriceCents=1200000')).status).toBe(404)
    expect((await estimateReq('nope', 'listPriceCents=1200000')).status).toBe(404)
  }, 60_000)

  it('Verificar: public search by number and by name, and the tag reading answers only the two flags', async () => {
    await prisma.certificate.create({ data: { artworkId: s.a1.artworkId, publicId: PUBLIC_ID, status: 'ACTIVE', issuedAt: new Date() } })
    const search = async (q: string) => (await (await searchGet(new Request(`http://test/api/public/certificates?${q}`))).json()) as { ok: boolean; results: { publicId: string; title: string; artist: string; verdict: string }[] }

    expect((await search('id=')).results).toEqual([])
    const byId = await search('id=ha-2026-test-0009')
    expect(byId.results).toMatchObject([{ publicId: PUBLIC_ID, artist: 'Tomás Rezende', verdict: 'authenticated' }])
    expect(JSON.stringify(byId)).not.toMatch(/holder|Hash|Cents/)
    expect((await search('artist=tomás&year=2024')).results).toHaveLength(1)
    expect((await search('artist=ninguem')).results).toEqual([])

    expect((await readReq('nope', { uid: '04aabbccddeeff', ctr: 1, cmac: '0011223344556677' })).status).toBe(404)
    expect((await readReq(PUBLIC_ID, { uid: 'zz' })).status).toBe(400)
    const read = await readReq(PUBLIC_ID, { uid: '04aabbccddeeff', ctr: 1, cmac: '0011223344556677' })
    expect(read.status).toBe(200)
    expect(await read.json()).toEqual({ ok: true, read: { authenticated: false, tamper: false } })
  }, 60_000)
})
