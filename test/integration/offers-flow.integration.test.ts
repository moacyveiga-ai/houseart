// Offers end to end: list with a mandate → public proposal with OTP → the
// negotiator (auto-accept / counter below the floor) → seller actions with
// CAS and the artwork lock → buyer reply and retraction → CRM Kanban sync.
// The floor never appears in the seller's rows nor in the buyer's view.
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { acceptOffer, buyerOffer, buyerReply, confirmPublicOffer, counterOffer, listArtworkForSale, refuseOffer, retractOffer, sellerOffers, startPublicOffer } from '@/lib/offers/server'
import { listPublicArtworks, publicArtwork } from '@/lib/marketplace/public-server'
import { kanban } from '@/lib/crm/server'
import { createScenario, type Scenario } from './fixtures'
import { asPanel } from './session'
import { truncateTables } from './db'

let s: Scenario
beforeEach(async () => { s = await createScenario(); await truncateTables(['Mandate', 'Offer', 'Contact', 'Notification']) })

async function otpOf(code: string): Promise<string> {
  const { createHash } = await import('node:crypto')
  const o = await prisma.offer.findUniqueOrThrow({ where: { code } })
  for (let i = 0; i < 1_000_000; i++) { const c = String(i).padStart(6, '0'); if (createHash('sha256').update(c).digest('hex') === o.otpHash) return c }
  throw new Error('otp')
}

async function authenticate(artworkId: number, publicId: string) {
  await prisma.artwork.update({ where: { id: artworkId }, data: { status: 'AUTHENTICATED', seal: 'GREEN', publicId } })
}

describe('offers flow', () => {
  it('list → proposal → OTP → negotiator → seller table → CRM', async () => {
    await authenticate(s.b.artworkId, 'HA-2026-TEST-0001')
    await asPanel(s.b.userId, async ({ scope, user }) => {
      await expect(listArtworkForSale(scope, s.b.artworkId, { listPriceCents: 4_400_000n, reservePriceCents: 4_500_000n, autoNegotiatorOn: true, autoAcceptMinBps: 9200, fixedPrice: false }, { userId: user.id })).rejects.toMatchObject({ code: 'BAD_MANDATE' })
      await listArtworkForSale(scope, s.b.artworkId, { listPriceCents: 4_400_000n, reservePriceCents: 3_800_000n, autoNegotiatorOn: true, autoAcceptMinBps: 9200, fixedPrice: false }, { userId: user.id })
    }, 'ARTIST')
    expect((await listPublicArtworks()).map((a) => a.publicId)).toEqual(['HA-2026-TEST-0001'])
    const page = await publicArtwork('HA-2026-TEST-0001')
    expect(JSON.stringify(page, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toMatch(/reserve/i)

    // below the floor → BELOW_RESERVE + negotiator counter at 92 %
    const low = await startPublicOffer({ publicId: 'HA-2026-TEST-0001', buyerName: 'Marcelo Bastos', buyerEmail: 'marcelo@col.test', buyerDocument: '52998224725', buyerCity: 'Recife/PE', offeredCents: 3_500_000n })
    expect(low.ok).toBe(true); if (!low.ok) return
    const lowConfirm = await confirmPublicOffer(low.code, await otpOf(low.code))
    expect(lowConfirm.ok).toBe(true); if (!lowConfirm.ok) return
    const lowRow = await prisma.offer.findUniqueOrThrow({ where: { code: low.code }, include: { rounds: true } })
    expect(lowRow.status).toBe('NEGOTIATING')
    expect(lowRow.rounds.map((r) => [r.author, r.amountCents])).toEqual([['BUYER', 3_500_000n], ['NEGOTIATOR', 4_048_000n]])
    // buyer view: status, rounds, never the floor
    const bv = await buyerOffer(low.code, lowConfirm.retractionToken)
    expect(bv).toMatchObject({ status: 'NEGOTIATING', canReply: true, canRetract: true })
    expect(JSON.stringify(bv, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain('3800000')
    expect(await buyerOffer(low.code, 'wrong-token')).toBeNull()

    // at or above 92 % → auto-accepted (but a second live offer on the same artwork is a different story)
    const high = await startPublicOffer({ publicId: 'HA-2026-TEST-0001', buyerName: 'Ana Paes', buyerEmail: 'ana@col.test', buyerDocument: '11222333000181', offeredCents: 4_100_000n })
    if (!high.ok) throw new Error(high.error)
    expect(await confirmPublicOffer(high.code, '000000')).toMatchObject({ ok: false })
    const highConfirm = await confirmPublicOffer(high.code, await otpOf(high.code))
    expect(highConfirm.ok).toBe(true)
    expect((await prisma.offer.findUniqueOrThrow({ where: { code: high.code } })).status).toBe('ACCEPTED')

    // the buyer of the low offer accepts the counter → artwork already locked by the accepted one
    await expect(buyerReply(low.code, lowConfirm.retractionToken, { accept: true })).rejects.toMatchObject({ code: 'ARTWORK_LOCKED' })

    await asPanel(s.b.userId, async ({ scope, user }) => {
      const rows = await sellerOffers(scope)
      expect(rows.map((r) => [r.code, r.status])).toEqual([[high.code, 'ACCEPTED'], [low.code, 'NEGOTIATING']])
      expect(rows[1].buyer).toBe('Colecionador, Recife/PE')
      expect(rows[0].differenceLabel).toBe('−7%')
      expect(JSON.stringify(rows, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toContain('3800000')
      // seller counter below the floor is refused; the message never carries the number
      await expect(counterOffer(scope, rows[1].id, 3_700_000n, { userId: user.id })).rejects.toMatchObject({ code: 'BELOW_MANDATE' })
      await refuseOffer(scope, rows[1].id, { userId: user.id })
      await expect(acceptOffer(scope, rows[1].id, { userId: user.id })).rejects.toThrow('Transição inválida')
      const k = await kanban(scope)
      const closed = k.columns.find((c) => c.stage === 'CLOSED')!
      expect(closed.cards.map((c) => c.name).sort()).toEqual(['Ana Paes', 'Marcelo Bastos'])
    }, 'ARTIST')
    // the gallery never sees the artist's offers
    await asPanel(s.a1.userId, async ({ scope }) => { expect(await sellerOffers(scope)).toEqual([]) })
    // notifications reached the seller
    expect(await prisma.notification.count({ where: { userId: s.b.userId } })).toBeGreaterThanOrEqual(2)
  }, 60_000)

  it('retraction within 24 h, fixed price refuses other amounts', async () => {
    await authenticate(s.a1.artworkId, 'HA-2026-TEST-0002')
    await asPanel(s.a1.userId, async ({ scope, user }) => {
      await listArtworkForSale(scope, s.a1.artworkId, { listPriceCents: 3_800_000n, reservePriceCents: 3_800_000n, autoNegotiatorOn: false, autoAcceptMinBps: 10000, fixedPrice: true }, { userId: user.id })
    })
    expect(await startPublicOffer({ publicId: 'HA-2026-TEST-0002', buyerName: 'Carla Vieira', buyerEmail: 'carla@col.test', buyerDocument: '52998224725', offeredCents: 3_000_000n })).toMatchObject({ ok: false })
    const o = await startPublicOffer({ publicId: 'HA-2026-TEST-0002', buyerName: 'Carla Vieira', buyerEmail: 'carla@col.test', buyerDocument: '52998224725', offeredCents: 3_800_000n })
    if (!o.ok) throw new Error(o.error)
    const c = await confirmPublicOffer(o.code, await otpOf(o.code))
    if (!c.ok) throw new Error(c.error)
    expect((await prisma.offer.findUniqueOrThrow({ where: { code: o.code } })).status).toBe('RECEIVED')
    expect(await retractOffer(o.code, 'bad')).toBe(false)
    expect(await retractOffer(o.code, c.retractionToken)).toBe(true)
    expect((await prisma.offer.findUniqueOrThrow({ where: { code: o.code } })).status).toBe('RETRACTED')
  }, 60_000)
})
