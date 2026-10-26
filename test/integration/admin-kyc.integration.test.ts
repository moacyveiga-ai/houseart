// Admin › KYC: the queue the desk reads, and the decisions through the route — admin and manager
// only; approve unblocks the transfers waiting on the buyer and is reused by the next
// verifyIdentity; reject needs a note and refuses the waiting transfers; revalidate expires now.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { POST } from '@/app/api/admin/kyc/[id]/route'
import { adminKyc } from '@/lib/admin-kyc/server'
import { verifyIdentity } from '@/lib/kyc/server'
import { createScenario, type Scenario } from './fixtures'
import { signIn, signOut } from './session'
import { truncateTables } from './db'

let s: Scenario
let buyerId: number
let certId: number
const saved: Record<string, string | undefined> = {}
beforeEach(async () => {
  saved.KYC_PROVIDER = process.env.KYC_PROVIDER
  s = await createScenario()
  await truncateTables(['KycVerification', 'OwnershipTransfer', 'Certificate'])
  buyerId = (await prisma.user.create({ data: { email: 'lia@col.test', name: 'Lia Prado', profile: 'collector', active: true, emailVerifiedAt: new Date() } })).id
  certId = (await prisma.certificate.create({ data: { artworkId: s.b.artworkId, publicId: 'HA-2026-K-1', status: 'ACTIVE', stage: 5 } })).id
})
afterEach(() => { signOut(); if (saved.KYC_PROVIDER === undefined) delete process.env.KYC_PROVIDER; else process.env.KYC_PROVIDER = saved.KYC_PROVIDER })

const call = (id: number, body: unknown) => POST(new Request(`http://test/api/admin/kyc/${id}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }), { params: Promise.resolve({ id: String(id) }) })

describe('admin kyc', () => {
  it('a real provider leaves the verification PENDING; the desk approves, the waiting transfer is unblocked and the next verifyIdentity reuses it', async () => {
    process.env.KYC_PROVIDER = 'didit'
    expect(await verifyIdentity(buyerId, 'h1')).toBe('PENDING')
    const pending = await prisma.kycVerification.findFirstOrThrow({ where: { userId: buyerId } })
    const t = await prisma.ownershipTransfer.create({ data: { certificateId: certId, artworkId: s.b.artworkId, fromUserId: s.b.userId, toUserId: buyerId, toName: 'Lia Prado', toEmail: 'lia@col.test', toDocumentHash: 'h1', status: 'KYC_PENDING', kycStatus: 'PENDING', inviteTokenHash: 'tok1' } })
    await signIn(s.b.userId)
    expect((await call(pending.id, { action: 'approve' })).status).toBe(403) // not staff
    signOut(); await signIn(s.staff.userId)
    const view = await adminKyc({ profile: 'admin' })
    expect(view.kpis).toMatchObject({ pending: 1, waiting: 1 })
    expect(view.rows[0]).toMatchObject({ userId: buyerId, name: 'Lia Prado', state: 'PENDING', provider: 'didit', hasDocument: true, waitingTransfers: 1, latest: true, can: { approve: true, reject: true, revalidate: false } })
    expect((await call(pending.id, { action: 'revalidate' })).status).toBe(403)
    const res = await call(pending.id, { action: 'approve', note: 'conferido' })
    expect(res.status).toBe(200); expect(await res.json()).toMatchObject({ ok: true, state: 'APPROVED', unblocked: 1 })
    expect((await prisma.ownershipTransfer.findUniqueOrThrow({ where: { id: t.id } })).kycStatus).toBe('APPROVED')
    expect(await verifyIdentity(buyerId, 'h1')).toBe('APPROVED')
    expect(await prisma.kycVerification.count({ where: { userId: buyerId } })).toBe(1) // reused, no second row
    expect((await call(pending.id, { action: 'approve' })).status).toBe(403) // already approved
    // revalidate: expires now; the next verifyIdentity opens a new PENDING row and the old one is history
    expect((await call(pending.id, { action: 'revalidate' })).status).toBe(200)
    expect((await adminKyc({ profile: 'admin' })).rows[0].state).toBe('EXPIRED')
    expect(await verifyIdentity(buyerId, 'h1')).toBe('PENDING')
    const rows = (await adminKyc({ profile: 'admin' })).rows
    expect(rows.map((r) => [r.state, r.latest])).toEqual([['PENDING', true], ['EXPIRED', false]])
    expect((await call(pending.id, { action: 'approve' })).status).toBe(403) // history row
    await expect.poll(() => prisma.auditLog.count({ where: { entity: 'kyc_verification', entityId: String(pending.id) } })).toBe(2)
  })

  it('reject needs a note and refuses the waiting transfers; a manager decides, an operator only reads', async () => {
    const pending = await prisma.kycVerification.create({ data: { userId: buyerId, provider: 'didit', status: 'PENDING', pepHit: true } })
    await prisma.ownershipTransfer.create({ data: { certificateId: certId, artworkId: s.b.artworkId, fromUserId: s.b.userId, toUserId: buyerId, toName: 'Lia Prado', toEmail: 'lia@col.test', toDocumentHash: 'h1', status: 'KYC_PENDING', kycStatus: 'PENDING', inviteTokenHash: 'tok2' } })
    const pw = await hashPassword('senha-forte-1')
    const operator = await prisma.user.create({ data: { email: 'op@houseart.test', name: 'Operador', passwordHash: pw, profile: 'operator', active: true } })
    const manager = await prisma.user.create({ data: { email: 'gestor@houseart.test', name: 'Gestora', passwordHash: pw, profile: 'manager', active: true } })
    await signIn(operator.id)
    expect((await adminKyc({ profile: 'operator' })).rows[0].can).toEqual({ approve: false, reject: false, revalidate: false })
    expect((await call(pending.id, { action: 'reject', note: 'x' })).status).toBe(403)
    signOut(); await signIn(manager.id)
    expect((await call(pending.id, { action: 'reject' })).status).toBe(422)
    expect((await call(pending.id, { action: 'nope' })).status).toBe(400)
    expect((await call(999_999, { action: 'reject', note: 'x' })).status).toBe(404)
    const res = await call(pending.id, { action: 'reject', note: 'documento ilegível' })
    expect(res.status).toBe(200); expect(await res.json()).toMatchObject({ ok: true, state: 'REJECTED', refused: 1 })
    expect((await prisma.ownershipTransfer.findFirstOrThrow({ where: { toUserId: buyerId } })).kycStatus).toBe('REJECTED')
    expect((await adminKyc({ profile: 'manager' })).kpis).toMatchObject({ rejected: 1, pending: 0, pep: 0 })
    expect((await call(pending.id, { action: 'reject', note: 'de novo' })).status).toBe(403)
    expect((await call(pending.id, { action: 'approve' })).status).toBe(200) // the desk reconsiders
  })
})
