// The side of a deal comes from the deal, not from the profile (review of
// 2026-10-22): a collector who sells their own work signs and ships as the
// seller, and an artist who buys signs as the buyer. Someone who is neither
// gets 404.
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { listArtworkForSale, startPublicOffer } from '@/lib/offers/server'
import { payEscrow } from '@/lib/deals/server'
import { ensureCollectorMember } from '@/lib/tenant/member-server'
import { withScope } from '@/lib/scope/context'
import { POST as signPost } from '@/app/api/deals/[id]/sign/route'
import { POST as shippingPost } from '@/app/api/deals/[id]/shipping/route'
import { createScenario, type Scenario } from './fixtures'
import { asPanel, signIn, signOut } from './session'
import { truncateTables } from './db'

const post = (h: typeof signPost, id: number, body: unknown = {}) => h(new Request(`http://test/api/deals/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ id: String(id) }) })

let s: Scenario
beforeEach(async () => {
  process.env.FLAG_TENANT_SCOPE = '1'
  process.env.FLAG_DEALS = '1'
  s = await createScenario()
  await truncateTables(['Mandate', 'Offer', 'Deal', 'Contact', 'Notification', 'Conversation', 'rate_limit_bucket'])
  signOut()
})

describe('deal side', () => {
  it('a collector who sells signs and ships as the seller; a stranger gets 404', async () => {
    const seller = await prisma.user.create({ data: { email: 'marina@col.test', name: 'Marina Lopes', profile: 'collector', active: true, emailVerifiedAt: new Date() } })
    const buyer = await prisma.user.create({ data: { email: 'lia@col.test', name: 'Lia Souza', profile: 'collector', active: true, emailVerifiedAt: new Date() } })
    const stranger = await prisma.user.create({ data: { email: 'outro@col.test', name: 'Outro', profile: 'collector', active: true, emailVerifiedAt: new Date() } })
    const { memberId, tenantId } = await ensureCollectorMember(seller.id)
    const art = await prisma.artwork.create({ data: { memberId, artistId: (await prisma.artist.findFirstOrThrow()).id, title: 'Voo baixo', status: 'AUTHENTICATED', seal: 'GREEN', publicId: 'HA-2026-TEST-0041', market: 'SECONDARY' } })
    await withScope({ kind: 'member', memberId, tenantId }, 'test', () => listArtworkForSale({ kind: 'member', memberId, tenantId }, art.id, { listPriceCents: 500_000n, reservePriceCents: 400_000n, autoNegotiatorOn: true, autoAcceptMinBps: 9000, fixedPrice: false }, { userId: seller.id }))
    const r = await startPublicOffer({ publicId: 'HA-2026-TEST-0041', buyerName: 'Lia Souza', buyerEmail: 'lia@col.test', buyerDocument: '52998224725', offeredCents: 500_000n, buyerUserId: buyer.id, validityHours: 48, guaranteeMethod: 'TRANSFER_ON_ACCEPT' })
    expect(r.ok).toBe(true)
    const deal = await prisma.deal.findFirstOrThrow({ where: { buyerUserId: buyer.id } })
    await payEscrow(buyer.id, deal.id)

    await signIn(stranger.id, 'COLLECTOR')
    expect((await post(signPost, deal.id)).status).toBe(404)

    await signIn(seller.id, 'COLLECTOR')
    expect((await post(signPost, deal.id)).status).toBe(200)
    expect((await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } })).sellerSignedAt).not.toBeNull()

    await signIn(buyer.id, 'COLLECTOR')
    expect((await post(signPost, deal.id)).status).toBe(200)
    expect((await post(shippingPost, deal.id, { carrier: 'Transportadora', tracking: 'AB123' })).status).toBe(403)

    await signIn(seller.id, 'COLLECTOR')
    expect((await post(shippingPost, deal.id, { carrier: 'Transportadora', tracking: 'AB123' })).status).toBe(200)
  }, 60_000)

  it('an artist who buys signs as the buyer', async () => {
    await prisma.artwork.update({ where: { id: s.a1.artworkId }, data: { status: 'AUTHENTICATED', seal: 'GREEN', publicId: 'HA-2026-TEST-0042' } })
    await asPanel(s.a1.userId, async ({ scope, user }) => {
      await listArtworkForSale(scope, s.a1.artworkId, { listPriceCents: 900_000n, reservePriceCents: 700_000n, autoNegotiatorOn: true, autoAcceptMinBps: 9000, fixedPrice: false }, { userId: user.id })
    })
    signOut()
    const artist = await prisma.user.update({ where: { id: s.b.userId }, data: { emailVerifiedAt: new Date() } })
    const r = await startPublicOffer({ publicId: 'HA-2026-TEST-0042', buyerName: artist.name, buyerEmail: artist.email, buyerDocument: '11144477735', offeredCents: 900_000n, buyerUserId: artist.id, validityHours: 48, guaranteeMethod: 'TRANSFER_ON_ACCEPT' })
    expect(r.ok).toBe(true)
    const deal = await prisma.deal.findFirstOrThrow({ where: { buyerUserId: artist.id } })
    await payEscrow(artist.id, deal.id)
    await signIn(artist.id, 'ARTIST')
    expect((await post(signPost, deal.id)).status).toBe(200)
    const d = await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } })
    expect(d.buyerSignedAt).not.toBeNull()
    expect(d.sellerSignedAt).toBeNull()
  }, 60_000)
})
