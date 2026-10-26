// Perfil › minha conta (audit 2026-10-25, item 11): delivery addresses with one default, and "Excluir minha
// conta" blocked by an open negotiation, then closing the account and every session.
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { addressesOf, defaultAddress, deleteAddress, saveAddress } from '@/lib/addresses/server'
import { openNegotiations, requestAccountDeletion } from '@/lib/accounts/deletion-server'
import { receiptsOf } from '@/lib/accounts/receipts-server'
import { createScenario, type Scenario } from './fixtures'
import { truncateTables } from './db'

let s: Scenario
let buyerId: number
const addr = { recipient: 'Lia', cep: '41950000', street: 'Rua A', number: '1', district: 'Rio Vermelho', city: 'Salvador', uf: 'BA' }

beforeEach(async () => {
  process.env.FLAG_TENANT_SCOPE = '1'
  s = await createScenario()
  await truncateTables(['ShippingAddress', 'Offer', 'Deal', 'Order', 'Session'])
  buyerId = (await prisma.user.create({ data: { email: 'lia@col.test', name: 'Lia', profile: 'collector', active: true } })).id
})

describe('addresses', () => {
  it('keeps exactly one default and only the owner touches them', async () => {
    const a = await saveAddress(buyerId, { ...addr, label: 'Casa' })
    expect(a.isDefault).toBe(true) // the first is the default
    const b = await saveAddress(buyerId, { ...addr, label: 'Escritório', cep: '40000000', isDefault: true })
    let list = await addressesOf(buyerId)
    expect(list.filter((x) => x.isDefault).map((x) => x.id)).toEqual([b.id])
    expect((await defaultAddress(buyerId))?.cep).toBe('40000000')
    // someone else cannot edit or delete it
    await expect(saveAddress(s.b.userId, addr, a.id)).rejects.toMatchObject({ status: 404 })
    await expect(deleteAddress(s.b.userId, a.id)).rejects.toMatchObject({ status: 404 })
    // deleting the default hands it to the oldest
    await deleteAddress(buyerId, b.id)
    list = await addressesOf(buyerId)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id: a.id, isDefault: true })
  }, 60_000)
})

describe('excluir minha conta', () => {
  it('is blocked by an open offer; then closes the account and ends the sessions', async () => {
    const offer = await prisma.offer.create({ data: { code: 'OFR-2026-000001', artworkId: s.a1.artworkId, sellerMemberId: s.a1.memberId, memberId: s.a1.memberId, buyerUserId: buyerId, buyerName: 'Lia', buyerEmail: 'lia@col.test', offeredCents: 100_000n, status: 'RECEIVED', expiresAt: new Date(Date.now() + 86_400_000) } })
    expect(await openNegotiations(buyerId)).toMatchObject({ offers: 1 })
    await expect(requestAccountDeletion(buyerId, 'EXCLUIR')).rejects.toMatchObject({ status: 409 })
    await prisma.offer.update({ where: { id: offer.id }, data: { status: 'RETRACTED' } })
    await expect(requestAccountDeletion(buyerId, 'sim')).rejects.toMatchObject({ status: 422 })
    await prisma.session.create({ data: { token: 'h1:test', userId: buyerId, expiresAt: new Date(Date.now() + 86_400_000) } })
    await requestAccountDeletion(buyerId, 'EXCLUIR')
    const u = await prisma.user.findUniqueOrThrow({ where: { id: buyerId } })
    expect(u.active).toBe(false)
    expect(u.deletionRequestedAt).not.toBeNull()
    expect(await prisma.session.count({ where: { userId: buyerId } })).toBe(0)
  }, 60_000)

  it('the receipts list paid service orders of the person only', async () => {
    await prisma.order.create({ data: { code: 'ORD-T-1', userId: buyerId, payerKind: 'BUYER', serviceCode: 'APPRAISAL', description: 'Laudo de opinião de valor', amountCents: 50_000n, status: 'PAID', paidAt: new Date() } })
    await prisma.order.create({ data: { code: 'ORD-T-2', userId: buyerId, payerKind: 'BUYER', serviceCode: 'APPRAISAL', description: 'Aberto', amountCents: 50_000n, status: 'OPEN' } })
    const rows = await receiptsOf(buyerId)
    expect(rows.map((r) => r.title)).toEqual(['Laudo de opinião de valor'])
    expect(rows[0]).toMatchObject({ kind: 'ORDER', amount: expect.stringContaining('500') })
    expect(await receiptsOf(s.b.userId)).toEqual([])
  }, 60_000)

  it('only a collector closes the account here; an offer made by e-mail before login also blocks', async () => {
    await expect(requestAccountDeletion(s.b.userId, 'EXCLUIR')).rejects.toMatchObject({ status: 403 })
    await prisma.offer.create({ data: { code: 'OFR-2026-000002', artworkId: s.a1.artworkId, sellerMemberId: s.a1.memberId, memberId: s.a1.memberId, buyerUserId: null, buyerName: 'Lia', buyerEmail: 'lia@col.test', offeredCents: 100_000n, status: 'NEGOTIATING', expiresAt: new Date(Date.now() + 86_400_000) } })
    expect(await openNegotiations(buyerId)).toMatchObject({ offers: 1 })
    await expect(requestAccountDeletion(buyerId, 'EXCLUIR')).rejects.toMatchObject({ status: 409 })
  }, 60_000)

  it('a transfer fee paid as an order is not listed again as a service', async () => {
    await prisma.order.create({ data: { code: 'ORD-T-9', userId: buyerId, payerKind: 'BUYER', serviceCode: 'TRANSFER_FEE', description: 'Taxa de transferência', amountCents: 19_900n, status: 'PAID', paidAt: new Date(), transferId: 999 } })
    expect((await receiptsOf(buyerId)).filter((r) => r.kind === 'ORDER')).toEqual([])
  }, 60_000)
})

