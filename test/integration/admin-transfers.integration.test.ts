// Admin › Transferências: the off-platform transfers the desk reads (what each waits for, stuck
// after a week), the resent invite (new token, the old link dies) and the cancellation with a
// note — a fee already paid is given back (mock: nothing to return) and both sides are told.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { prisma } from '@/lib/prisma'
import { POST } from '@/app/api/admin/transfers/[id]/route'
import { adminTransfers } from '@/lib/admin-transfers/server'
import { buyerAcceptTransfer, buyerTransfer, createTransfer, payTransferFee, sellerSign } from '@/lib/ownership/server'
import { createScenario, type Scenario } from './fixtures'
import { signIn, signOut } from './session'
import { truncateTables } from './db'

const cwd = process.cwd()
let dir = ''
let s: Scenario
beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'ha-atr-')); process.chdir(dir)
  delete process.env.VERCEL; delete process.env.BLOB_READ_WRITE_TOKEN; delete process.env.BLOB_PRIVATE_READ_WRITE_TOKEN
  process.env.STRIPE_ENV = 'mock'; process.env.FLAG_ORDERS = '1'; process.env.FLAG_OWNERSHIP_TRANSFER = '1'; process.env.KYC_PROVIDER = 'mock'
})
afterAll(() => { process.chdir(cwd); rmSync(dir, { recursive: true, force: true }) })
beforeEach(async () => {
  s = await createScenario()
  await truncateTables(['OwnershipTransfer', 'Certificate', 'Order', 'Notification', 'KycVerification'])
  const cert = await prisma.certificate.create({ data: { artworkId: s.b.artworkId, publicId: 'HA-2026-TR-0001', status: 'ACTIVE', stage: 5, issuedAt: new Date() } })
  await prisma.certificateVersion.create({ data: { certificateId: cert.id, version: 1, holderName: 'Joana Teixeira', holderUserId: s.b.userId, contentJson: '{}', contentHash: 'x'.repeat(64), status: 'ACTIVE' } })
})
afterEach(() => signOut())

const call = (id: number, body: unknown) => POST(new Request(`http://test/api/admin/transfers/${id}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }), { params: Promise.resolve({ id: String(id) }) })
const invite = () => createTransfer(s.b.userId, { artworkId: s.b.artworkId, toDocument: '52998224725', toEmail: 'comprador@col.test', toName: 'Lia Prado', priceCents: 500_000n, priceSealed: false })
const lastToken = async () => { const n = await prisma.notification.findFirstOrThrow({ where: { kind: 'transfer.invite' }, orderBy: { id: 'desc' } }); return n.body!.split('/transfer/')[1] }

describe('admin transfers', () => {
  it('lists what each transfer waits for; a week parked reads stuck; the invite is resent with a new token', async () => {
    const t = await invite()
    let rows = await adminTransfers({ profile: 'admin' })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: t.id, waiting: 'BUYER_ACCEPT', stuck: false, seller: { id: s.b.userId, name: 'Joana Teixeira' }, buyer: { id: null, email: 'comprador@col.test' }, priceCents: '500000', can: { resend: true, cancel: true } })
    expect(JSON.stringify(rows)).not.toContain('52998224725')
    rows = await adminTransfers({ profile: 'admin' }, new Date(Date.now() + 8 * 86_400_000))
    expect(rows[0]).toMatchObject({ stuck: true, daysInStep: 8 })
    expect((await adminTransfers({ profile: 'operator' }))[0].can).toEqual({ resend: false, cancel: false })
    // resend: operator refused; admin gets a new token and the old link dies
    const oldToken = await lastToken()
    const operator = await prisma.user.create({ data: { email: 'op@houseart.test', name: 'Op', profile: 'operator', active: true } })
    await signIn(operator.id)
    expect((await call(t.id, { action: 'resend' })).status).toBe(403)
    await signIn(s.staff.userId)
    expect((await call(t.id, { action: 'resend' })).status).toBe(200)
    const newToken = await lastToken()
    expect(newToken).not.toBe(oldToken)
    expect(await buyerTransfer(oldToken)).toBeNull()
    expect(await buyerTransfer(newToken)).not.toBeNull()
    expect(await prisma.auditLog.count({ where: { entity: 'ownership_transfer', entityId: String(t.id), action: 'invite_resent' } })).toBe(1)
    // once the buyer signed, no more resending
    expect(await buyerAcceptTransfer(newToken, '529.982.247-25')).toEqual({ ok: true })
    expect((await call(t.id, { action: 'resend' })).status).toBe(409)
    expect((await adminTransfers({ profile: 'admin' }))[0]).toMatchObject({ waiting: 'SELLER_SIGNATURE', kycStatus: 'APPROVED' })
  })

  it('cancels with a note: the fee already paid is refunded (mock), the order closes, both sides are told', async () => {
    const t = await invite()
    await sellerSign(s.b.userId, t.id)
    expect(await buyerAcceptTransfer(await lastToken(), '52998224725')).toEqual({ ok: true })
    await payTransferFee(s.b.userId, t.id)
    expect((await adminTransfers({ profile: 'admin' }))[0]).toMatchObject({ waiting: 'TAP', status: 'AWAITING_TAP' })
    await signIn(s.staff.userId)
    expect((await call(t.id, { action: 'cancel', note: '' })).status).toBe(422)
    const r = await call(t.id, { action: 'cancel', note: 'Obra nunca chegou ao comprador' })
    expect(r.status).toBe(200)
    expect(await r.json()).toMatchObject({ status: 'CANCELLED', refunded: true, refundPending: false })
    expect((await prisma.ownershipTransfer.findUniqueOrThrow({ where: { id: t.id } })).status).toBe('CANCELLED')
    expect((await prisma.order.findFirstOrThrow({ where: { transferId: t.id } })).status).toBe('CANCELLED')
    expect(await prisma.notification.count({ where: { kind: 'transfer.cancelled' } })).toBe(2)
    expect((await call(t.id, { action: 'cancel', note: 'de novo' })).status).toBe(409)
    // the certificate's holder is untouched
    expect((await prisma.certificateVersion.findFirstOrThrow({ where: { status: 'ACTIVE' } })).holderUserId).toBe(s.b.userId)
  })
})
