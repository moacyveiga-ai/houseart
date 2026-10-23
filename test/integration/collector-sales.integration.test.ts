// GET /api/collector/sales — "Vendas · Em andamento" of the App Colecionador:
// the deals where the collector's own member sells. 401 without a session, an
// empty list for a collector who owns nothing, never another collector's deal,
// never the gallery's deals, never the mandate.
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { listArtworkForSale, startPublicOffer } from '@/lib/offers/server'
import { ensureCollectorMember } from '@/lib/tenant/member-server'
import { withScope } from '@/lib/scope/context'
import { GET as salesGet } from '@/app/api/collector/sales/route'
import { createScenario } from './fixtures'
import { signIn, signOut } from './session'
import { truncateTables } from './db'

const NEVER = /reservePriceCents|riskAdjustedCents|closeProbability|documentHash|buyerDocument/
const collector = (email: string, name: string) => prisma.user.create({ data: { email, name, profile: 'collector', active: true, emailVerifiedAt: new Date() } })

let galleryAdmin: number
beforeEach(async () => {
  process.env.FLAG_TENANT_SCOPE = '1'
  process.env.FLAG_DEALS = '1'
  galleryAdmin = (await createScenario()).a1.userId
  await truncateTables(['Mandate', 'Offer', 'Deal', 'Contact', 'Notification', 'Conversation', 'rate_limit_bucket'])
  signOut()
})

async function deals(userId: number): Promise<{ id: number; code: string; split: unknown[] }[]> {
  await signIn(userId, 'COLLECTOR')
  const res = await salesGet()
  expect(res.status).toBe(200)
  const text = await res.text()
  expect(text).not.toMatch(NEVER)
  return (JSON.parse(text) as { deals: { id: number; code: string; split: unknown[] }[] }).deals
}

describe('GET /api/collector/sales', () => {
  it('401 without a session', async () => {
    expect((await salesGet()).status).toBe(401)
  }, 60_000)

  it('the seller sees their deal; an empty-handed collector, another collector, the buyer and the gallery do not', async () => {
    const seller = await collector('venda@col.test', 'Marina Lopes')
    const buyer = await collector('compra@col.test', 'Lia Souza')
    const empty = await collector('vazio@col.test', 'Sem Obras')
    const other = await collector('outro@col.test', 'Outro Dono')
    await ensureCollectorMember(other.id)
    const { memberId, tenantId } = await ensureCollectorMember(seller.id)
    const art = await prisma.artwork.create({ data: { memberId, artistId: (await prisma.artist.findFirstOrThrow()).id, title: 'Voo baixo', status: 'AUTHENTICATED', seal: 'GREEN', publicId: 'HA-2026-TEST-0051', market: 'SECONDARY' } })
    await withScope({ kind: 'member', memberId, tenantId }, 'test', () => listArtworkForSale({ kind: 'member', memberId, tenantId }, art.id, { listPriceCents: 500_000n, reservePriceCents: 400_000n, autoNegotiatorOn: true, autoAcceptMinBps: 9000, fixedPrice: false }, { userId: seller.id }))
    const r = await startPublicOffer({ publicId: 'HA-2026-TEST-0051', buyerName: 'Lia Souza', buyerEmail: 'compra@col.test', buyerDocument: '52998224725', offeredCents: 500_000n, buyerUserId: buyer.id, validityHours: 48, guaranteeMethod: 'TRANSFER_ON_ACCEPT' })
    expect(r.ok).toBe(true)
    const deal = await prisma.deal.findFirstOrThrow({ where: { buyerUserId: buyer.id } })

    const mine = await deals(seller.id)
    expect(mine.map((d) => d.id)).toEqual([deal.id])
    expect(mine[0].split.length).toBeGreaterThan(0)
    expect(await deals(empty.id)).toEqual([])
    expect(await deals(other.id)).toEqual([])
    expect(await deals(buyer.id)).toEqual([])
    expect(await deals(galleryAdmin)).toEqual([])
    signOut()
  }, 60_000)
})
