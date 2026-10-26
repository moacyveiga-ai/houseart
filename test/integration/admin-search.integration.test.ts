// Admin › Busca com escopo total: artworks in any state by title/artist/owner/#id/certificate, deals by code, accounts by name/e-mail/#id.
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { adminSearch } from '@/lib/admin-search/server'
import { createScenario, type Scenario } from './fixtures'
import { truncateTables } from './db'

let s: Scenario
beforeEach(async () => { s = await createScenario(); await truncateTables(['Certificate', 'Deal', 'Offer']) })

describe('admin search', () => {
  it('finds what the public search never shows', async () => {
    await prisma.artwork.update({ where: { id: s.b.artworkId }, data: { title: 'Maré baixa', status: 'DRAFT' } })
    await prisma.certificate.create({ data: { artworkId: s.b.artworkId, publicId: 'HA-2026-AB12-CD34', status: 'ACTIVE', stage: 5 } })
    const buyer = await prisma.user.create({ data: { email: 'lia@col.test', name: 'Lia Prado', profile: 'collector', active: true } })
    const offer = await prisma.offer.create({ data: { code: 'OFR-2026-000001', artworkId: s.b.artworkId, sellerMemberId: s.b.memberId, memberId: s.b.memberId, buyerUserId: buyer.id, buyerName: 'Lia Prado', buyerEmail: 'lia@col.test', offeredCents: 100n, status: 'IN_DEAL', expiresAt: new Date(Date.now() + 86_400_000) } })
    await prisma.deal.create({ data: { code: 'DL-2026-000007', artworkId: s.b.artworkId, offerId: offer.id, sellerMemberId: s.b.memberId, memberId: s.b.memberId, buyerUserId: buyer.id, market: 'PRIMARY', amountCents: 100n, phase: 'ESCROW' } })

    expect(await adminSearch('')).toMatchObject({ total: 0 })
    const byTitle = await adminSearch('maré')
    expect(byTitle.artworks.map((a) => a.title)).toEqual(['Maré baixa'])
    expect(byTitle.artworks[0]).toMatchObject({ status: 'DRAFT', statusLabel: 'Rascunho', publicId: 'HA-2026-AB12-CD34', href: `/artworks/${s.b.artworkId}/edit`, verifyHref: '/verify/HA-2026-AB12-CD34' })
    expect(byTitle.deals.map((d) => d.code)).toEqual(['DL-2026-000007']) // the deal of that artwork
    expect((await adminSearch('joana')).artworks.length).toBeGreaterThan(0) // by artist / owner
    expect((await adminSearch('ha2026ab12cd34')).artworks.map((a) => a.id)).toEqual([s.b.artworkId])
    expect((await adminSearch('dl-2026-7')).deals[0]).toMatchObject({ code: 'DL-2026-000007', phaseLabel: expect.any(String), seller: 'Joana Teixeira', buyer: 'Lia Prado', href: expect.stringMatching(/^\/admin\/deals\?f=all&deal=\d+$/) })
    expect((await adminSearch('lia@col.test')).users[0]).toMatchObject({ name: 'Lia Prado', profileLabel: 'Colecionador', href: `/admin/users?q=%23${buyer.id}` })
    const byId = await adminSearch(`#${s.b.userId}`)
    expect(byId.users.map((u) => u.id)).toEqual([s.b.userId])
    expect((await adminSearch('Prado')).users).toHaveLength(1)
  })
})
