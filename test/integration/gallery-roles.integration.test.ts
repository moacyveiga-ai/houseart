// Review of 2026-10-22: the gallery team roles restrict the seller's actions
// (Acervo does not change the listing nor the rules; only Admin saves the
// rules), the rules the admin saves hold for works registered by any member of
// the gallery, and a favourite never shows the price of a work not for sale.
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { listArtworkForSale } from '@/lib/offers/server'
import { rulesOfMember } from '@/lib/offers/rules-server'
import { changeListPrice, setPaused } from '@/lib/gallery/listing-server'
import { saveRules } from '@/lib/gallery/rules-server'
import { favoritesOf } from '@/lib/community/server'
import { createScenario, type Scenario } from './fixtures'
import { asPanel, signOut } from './session'
import { truncateTables } from './db'

let s: Scenario
let inventory: { userId: number; memberId: number }
let sales: { userId: number; memberId: number }

async function staff(email: string, role: 'SALES' | 'INVENTORY') {
  const u = await prisma.user.create({ data: { email, name: role, passwordHash: 'x', profile: 'member', active: true, profiles: { create: { kind: 'GALLERY', isDefault: true } } } })
  const m = await prisma.member.create({ data: { userId: u.id, tenantId: s.galleryTenantId, kind: 'GALLERY_STAFF', role, displayName: role, slug: `staff-${role.toLowerCase()}` } })
  await prisma.user.update({ where: { id: u.id }, data: { memberId: m.id, tenantId: s.galleryTenantId, tenantRole: 'MEMBER' } })
  return { userId: u.id, memberId: m.id }
}

beforeEach(async () => {
  process.env.FLAG_TENANT_SCOPE = '1'
  s = await createScenario()
  await truncateTables(['Mandate', 'Offer', 'Deal', 'OfferRules', 'Reaction'])
  inventory = await staff('acervo@galeria.test', 'INVENTORY')
  sales = await staff('vendas@galeria.test', 'SALES')
  await prisma.artwork.update({ where: { id: s.a1.artworkId }, data: { status: 'AUTHENTICATED', seal: 'GREEN', publicId: 'HA-2026-TEST-0031' } })
  await asPanel(s.a1.userId, async ({ scope, user }) => {
    await listArtworkForSale(scope, s.a1.artworkId, { listPriceCents: 1_000_000n, reservePriceCents: 600_000n, autoNegotiatorOn: false, autoAcceptMinBps: 10000, fixedPrice: false }, { userId: user.id })
  })
  signOut()
})

describe('gallery team roles', () => {
  it('Acervo cannot change the listing nor the rules; Vendas manages the listing but not the rules; Admin saves the rules', async () => {
    await asPanel(inventory.userId, async ({ scope, user }) => {
      await expect(changeListPrice(scope, s.a1.artworkId, 1_200_000n, { userId: user.id })).rejects.toMatchObject({ status: 403 })
      await expect(setPaused(scope, s.a1.artworkId, true, { userId: user.id })).rejects.toMatchObject({ status: 403 })
      await expect(saveRules(scope, { refuseBelowBps: 8000 }, { userId: user.id })).rejects.toMatchObject({ status: 403 })
    })
    await asPanel(sales.userId, async ({ scope, user }) => {
      await expect(setPaused(scope, s.a1.artworkId, true, { userId: user.id })).resolves.toMatchObject({ paused: true })
      await expect(saveRules(scope, { refuseBelowBps: 8000 }, { userId: user.id })).rejects.toMatchObject({ status: 403 })
    })
    await asPanel(s.a1.userId, async ({ scope, user }) => {
      await expect(saveRules(scope, { refuseBelowBps: 8000 }, { userId: user.id })).resolves.toMatchObject({ refuseBelowBps: 8000 })
    })
    signOut()
  }, 60_000)

  it('the rules saved by the admin apply to a work registered by Acervo', async () => {
    await asPanel(s.a1.userId, async ({ scope, user }) => { await saveRules(scope, { refuseBelowBps: 8000 }, { userId: user.id }) })
    signOut()
    expect((await rulesOfMember(inventory.memberId)).refuseBelowBps).toBe(8000)
    // an artist outside the gallery keeps their own (default) rules
    expect((await rulesOfMember(s.b.memberId)).refuseBelowBps).not.toBe(8000)
  }, 60_000)

  it('a favourite of a work not for sale carries no price', async () => {
    await prisma.artwork.update({ where: { id: s.b.artworkId }, data: { status: 'SOLD', seal: 'GREEN', publicId: 'HA-2026-TEST-0032', listPriceCents: 777_000n, saleMode: null } })
    await prisma.reaction.createMany({ data: [
      { userId: s.a2.userId, targetKind: 'ARTWORK', targetId: s.b.artworkId, kind: 'LIKE' },
      { userId: s.a2.userId, targetKind: 'ARTWORK', targetId: s.a1.artworkId, kind: 'SAVE' },
    ] })
    const favs = await favoritesOf(s.a2.userId)
    expect(favs.find((f) => f.id === s.b.artworkId)?.priceCents).toBeNull()
    expect(favs.find((f) => f.id === s.a1.artworkId)?.priceCents).toBe(1_000_000n)
  }, 60_000)
})
