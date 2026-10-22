// Handoff Fase 6: gallery offer rules (low offer refused at once), team invites, represented artists, listing management, views.
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { confirmPublicOffer, listArtworkForSale, startPublicOffer } from '@/lib/offers/server'
import { rulesOf, saveRules } from '@/lib/gallery/rules-server'
import { acceptInvite, invite, inviteByToken, removeFromTeam, setRole, teamOf } from '@/lib/gallery/team-server'
import { addArtist, endRepresentation, representedArtists, updateContract } from '@/lib/gallery/artists-server'
import { changeListPrice, listingOf, recordView, setAcceptsOffers, setPaused } from '@/lib/gallery/listing-server'
import { dayPanel } from '@/lib/gallery/panel-server'
import { listPublicArtworks } from '@/lib/marketplace/public-server'
import { hashPassword } from '@/lib/auth'
import { createScenario, type Scenario } from './fixtures'
import { asPanel } from './session'
import { truncateTables } from './db'

let s: Scenario
beforeEach(async () => {
  process.env.FLAG_TENANT_SCOPE = '1'; process.env.FLAG_DEALS = '1'
  s = await createScenario()
  await truncateTables(['Mandate', 'Offer', 'Deal', 'Contact', 'Notification', 'OfferRules', 'TeamInvite', 'ArtistContract', 'ArtworkViewDay', 'rate_limit_bucket'])
  await prisma.artwork.update({ where: { id: s.a1.artworkId }, data: { status: 'AUTHENTICATED', seal: 'GREEN', publicId: 'HA-2026-TEST-0006' } })
  await asPanel(s.a1.userId, async ({ scope, user }) => {
    await listArtworkForSale(scope, s.a1.artworkId, { listPriceCents: 1_000_000n, reservePriceCents: 600_000n, autoNegotiatorOn: false, autoAcceptMinBps: 10000, fixedPrice: false }, { userId: user.id })
  })
})

async function otpOf(code: string): Promise<string> {
  const { createHash } = await import('node:crypto')
  const o = await prisma.offer.findUniqueOrThrow({ where: { code } })
  for (let i = 0; i < 1_000_000; i++) { const c = String(i).padStart(6, '0'); if (createHash('sha256').update(c).digest('hex') === o.otpHash) return c }
  throw new Error('otp')
}

describe('offer rules', () => {
  it('refuses below the gallery minimum with a gentle message; above it goes on', async () => {
    await asPanel(s.a1.userId, async ({ scope, user }) => {
      expect(await rulesOf(scope)).toMatchObject({ refuseLow: true, refuseBelowBps: 7000 })
      await expect(saveRules(scope, { refuseBelowBps: 6500 }, { userId: user.id })).rejects.toMatchObject({ code: 'BAD_RULES' })
      await saveRules(scope, { refuseBelowBps: 8000, responseHours: 24 }, { userId: user.id })
    })
    const low = await startPublicOffer({ publicId: 'HA-2026-TEST-0006', buyerName: 'Lia', buyerEmail: 'lia@col.test', buyerDocument: '52998224725', offeredCents: 790_000n })
    if (!low.ok) throw new Error(low.error)
    expect(await confirmPublicOffer(low.code, await otpOf(low.code))).toMatchObject({ ok: true })
    const row = await prisma.offer.findUniqueOrThrow({ where: { code: low.code }, include: { events: true } })
    expect(row.status).toBe('REFUSED'); expect(row.events.some((e) => e.kind === 'REFUSED' && e.payloadJson.includes('BELOW_GALLERY_RULE'))).toBe(true)
    const ok = await startPublicOffer({ publicId: 'HA-2026-TEST-0006', buyerName: 'Lia', buyerEmail: 'lia@col.test', buyerDocument: '52998224725', offeredCents: 810_000n })
    if (!ok.ok) throw new Error(ok.error)
    await confirmPublicOffer(ok.code, await otpOf(ok.code))
    expect((await prisma.offer.findUniqueOrThrow({ where: { code: ok.code } })).status).toBe('RECEIVED')
  }, 60_000)
})

describe('team', () => {
  it('admin invites, the invited user joins with the role, roles change, self-removal refused', async () => {
    const r = await asPanel(s.a1.userId, async ({ scope, user }) => {
      const people = await teamOf(scope, user.id)
      expect(people.filter((p) => p.kind === 'MEMBER').length).toBeGreaterThanOrEqual(1)
      expect(await invite(scope, 'leo@galeria.test', 'SALES', { userId: user.id, name: user.name })).toEqual({ ok: true })
      expect(await invite(scope, 'nope', 'SALES', { userId: user.id, name: user.name })).toMatchObject({ ok: false })
      return teamOf(scope, user.id)
    })
    const pending = r.find((p) => p.kind === 'INVITE')!
    expect(pending.email).toBe('leo@galeria.test')
    // the token only lives in the e-mail: the test plants one
    const { createHash } = await import('node:crypto')
    await prisma.teamInvite.update({ where: { id: pending.id }, data: { tokenHash: createHash('sha256').update('tok').digest('hex') } })
    expect(await inviteByToken('tok')).toMatchObject({ galleryName: 'Galeria Ladeira', role: 'SALES' })
    const leo = await prisma.user.create({ data: { email: 'leo@galeria.test', name: 'Leo', passwordHash: await hashPassword('senha-forte-1'), profile: 'member', active: true } })
    const other = await prisma.user.create({ data: { email: 'x@y.test', name: 'X', profile: 'member', active: true } })
    expect(await acceptInvite('tok', { id: other.id, email: 'x@y.test', name: 'X' })).toMatchObject({ ok: false })
    expect(await acceptInvite('tok', { id: leo.id, email: 'leo@galeria.test', name: 'Leo' })).toMatchObject({ ok: true, tenantId: s.galleryTenantId })
    const joined = await prisma.user.findUniqueOrThrow({ where: { id: leo.id }, include: { member: true } })
    expect(joined.tenantId).toBe(s.galleryTenantId); expect(joined.tenantRole).toBe('MEMBER'); expect(joined.member?.role).toBe('SALES')
    expect(await acceptInvite('tok', { id: leo.id, email: 'leo@galeria.test', name: 'Leo' })).toMatchObject({ ok: false })
    await asPanel(s.a1.userId, async ({ scope, user }) => {
      expect(await setRole(scope, joined.member!.id, 'ADMIN', { userId: user.id })).toBe(true)
      expect((await prisma.user.findUniqueOrThrow({ where: { id: leo.id } })).tenantRole).toBe('ADMIN')
      const me = (await teamOf(scope, user.id)).find((p) => p.isSelf)!
      await expect(removeFromTeam(scope, me.id, { userId: user.id })).rejects.toMatchObject({ code: 'SELF_REMOVE' })
      expect(await removeFromTeam(scope, joined.member!.id, { userId: user.id })).toBe(true)
    })
    expect((await prisma.user.findUniqueOrThrow({ where: { id: leo.id } })).tenantId).toBeNull()
  }, 60_000)
})

describe('represented artists, listing, panel', () => {
  it('adds an artist with a contract, updates it, ends it; listing price/pause/offers; views and panel', async () => {
    await asPanel(s.a1.userId, async ({ scope, user }) => {
      const before = await representedArtists(scope)
      const add = await addArtist(scope, { name: 'Nina Prado', kind: 'CONSIGNMENT', galleryBps: 4000, validUntil: '2027-03-31' }, { userId: user.id, name: user.name })
      expect(add).toMatchObject({ ok: true })
      const list = await representedArtists(scope)
      expect(list.length).toBe(before.length + 1)
      const nina = list.find((a) => a.name === 'Nina Prado')!
      expect(nina.contract).toMatchObject({ kind: 'CONSIGNMENT', galleryBps: 4000, validUntil: '2027-03-31' }); expect(nina.sub).toContain('consignação até 03/2027')
      expect(await updateContract(scope, nina.id, { kind: 'REPRESENTED', galleryBps: 5000 }, { userId: user.id })).toBe(true)
      expect(await endRepresentation(scope, nina.id, { userId: user.id })).toBe(true)
      expect((await representedArtists(scope)).some((a) => a.name === 'Nina Prado')).toBe(false)

      const l = await listingOf(scope, s.a1.artworkId)
      expect(l).toMatchObject({ listPriceCents: 1_000_000n, acceptsOffers: true, paused: false })
      await expect(changeListPrice(scope, s.a1.artworkId, 500_000n, { userId: user.id })).rejects.toMatchObject({ code: 'BELOW_FLOOR' })
      expect((await changeListPrice(scope, s.a1.artworkId, 900_000n, { userId: user.id })).listPriceCents).toBe(900_000n)
      expect(await prisma.mandate.count({ where: { artworkId: s.a1.artworkId, status: 'ACTIVE' } })).toBe(1)
      expect((await prisma.mandate.findFirstOrThrow({ where: { artworkId: s.a1.artworkId, status: 'ACTIVE' } })).version).toBe(2)
      expect((await setAcceptsOffers(scope, s.a1.artworkId, false, { userId: user.id })).acceptsOffers).toBe(false)
      expect((await setPaused(scope, s.a1.artworkId, true, { userId: user.id })).paused).toBe(true)
    })
    expect((await listPublicArtworks()).map((a) => a.publicId)).toEqual([])
    await asPanel(s.a1.userId, async ({ scope, user }) => { await setPaused(scope, s.a1.artworkId, false, { userId: user.id }) })
    expect((await listPublicArtworks()).map((a) => a.publicId)).toEqual(['HA-2026-TEST-0006'])
    expect(await recordView('HA-2026-TEST-0006')).toBe(true); expect(await recordView('HA-2026-TEST-0006')).toBe(true); expect(await recordView('HA-0000-NOPE-NOPE')).toBe(false)
    await asPanel(s.a1.userId, async ({ scope }) => {
      expect((await listingOf(scope, s.a1.artworkId))!.stats.views7d).toBe(2)
      const p = await dayPanel(scope)
      expect(p.kpis.map((k) => k.key)).toEqual(['sales', 'offers', 'escrow', 'views'])
      expect(p.kpis[3].value).toBe('2')
    })
  }, 60_000)
})
