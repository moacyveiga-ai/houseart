// The appraisal desk (audit §5): the team assigns an appraiser, moves the deadline and cancels
// through PATCH /api/appraisals/[id]; an appraiser takes an open request; only the assigned
// appraiser (or the team) issues; cancelling closes the OPEN order and leaves a PAID one for
// finance, said in the audit row.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { PATCH } from '@/app/api/appraisals/[requestId]/route'
import { appraisalQueue, appraisersList, issueAppraisal, requestAppraisal } from '@/lib/appraisal/server'
import { setStripeGatewayForTests, type StripeGateway } from '@/lib/stripe/gateway-server'
import { createScenario, type Scenario } from './fixtures'
import { signIn, signOut } from './session'
import { truncateTables } from './db'

const cwd = process.cwd()
let dir = ''
let s: Scenario
let collectorId = 0, avaId = 0, ava2Id = 0
beforeAll(() => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'ha-desk-')); process.chdir(dir)
  delete process.env.VERCEL; delete process.env.BLOB_READ_WRITE_TOKEN; delete process.env.BLOB_PRIVATE_READ_WRITE_TOKEN
  process.env.STRIPE_ENV = 'mock'; process.env.FLAG_ORDERS = '1'; process.env.FLAG_APPRAISAL = '1'
})
afterAll(() => { process.chdir(cwd); rmSync(dir, { recursive: true, force: true }) })
beforeEach(async () => {
  s = await createScenario()
  await truncateTables(['Order', 'AppraisalRequest', 'AppraisalComparable', 'Notification', 'AuditLog'])
  const pw = await hashPassword('senha-forte-1')
  collectorId = (await prisma.user.create({ data: { email: 'col@col.test', name: 'Helena Prado', passwordHash: pw, profile: 'collector', active: true } })).id
  avaId = (await prisma.user.create({ data: { email: 'ava@houseart.test', name: 'Rui Avaliador', passwordHash: pw, profile: 'appraiser', active: true } })).id
  ava2Id = (await prisma.user.create({ data: { email: 'ava2@houseart.test', name: 'Bia Avaliadora', passwordHash: pw, profile: 'appraiser', active: true } })).id
  await prisma.artwork.update({ where: { id: s.b.artworkId }, data: { status: 'AUTHENTICATED' } })
  const cert = await prisma.certificate.create({ data: { artworkId: s.b.artworkId, publicId: 'HA-2026-DESK-001', status: 'ACTIVE', stage: 5, issuedAt: new Date() } })
  await prisma.certificateVersion.create({ data: { certificateId: cert.id, version: 1, holderName: 'Helena Prado', holderUserId: collectorId, contentJson: '{}', contentHash: 'x'.repeat(64), status: 'ACTIVE' } })
})
afterEach(() => signOut())

const call = (id: number, body: unknown) => PATCH(new Request(`http://test/api/appraisals/${id}`, { method: 'PATCH', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }), { params: Promise.resolve({ requestId: String(id) }) })
const ask = () => requestAppraisal({ userId: collectorId, name: 'Helena Prado', scope: null }, { artworkId: s.b.artworkId, purpose: 'INSURANCE', requesterLabel: 'Colecionador' })
const range = { minCents: 100_000n, suggestedCents: 120_000n, maxCents: 150_000n, methodology: 'Comparação direta com vendas registradas do mesmo artista.' }

describe('appraisal desk', () => {
  it('the team assigns, the appraiser is told, another appraiser cannot issue, the team may; the deadline moves', async () => {
    const req = await ask()
    expect(await appraisersList()).toEqual([{ id: ava2Id, name: 'Bia Avaliadora', open: 0 }, { id: avaId, name: 'Rui Avaliador', open: 0 }])
    // an appraiser does not assign
    await signIn(avaId)
    expect((await call(req.id, { action: 'assign', appraiserUserId: ava2Id })).status).toBe(403)
    // the team does; the request is IN_PROGRESS and the appraiser has an alert with the link
    await signIn(s.staff.userId)
    expect((await call(req.id, { action: 'assign', appraiserUserId: 999_999 })).status).toBe(422)
    const r = await call(req.id, { action: 'assign', appraiserUserId: avaId })
    expect(r.status).toBe(200)
    expect(await r.json()).toMatchObject({ assignedAppraiserId: avaId, assignedName: 'Rui Avaliador', status: 'IN_PROGRESS' })
    expect(await prisma.notification.findFirst({ where: { userId: avaId, kind: 'appraisal.assigned' } })).toMatchObject({ href: `/appraisals?pedido=${req.id}` })
    expect((await appraisersList()).find((a) => a.id === avaId)?.open).toBe(1)
    const q = await appraisalQueue()
    expect(q[0]).toMatchObject({ id: req.id, assignedName: 'Rui Avaliador', state: 'IN_PROGRESS', issuedCode: null })
    // the other appraiser cannot take nor issue it
    await signIn(ava2Id)
    expect((await call(req.id, { action: 'take' })).status).toBe(409)
    await expect(issueAppraisal({ userId: ava2Id, name: 'Bia Avaliadora', profile: 'appraiser' }, req.id, range)).rejects.toMatchObject({ code: 'ASSIGNED_TO_OTHER' })
    // the deadline: a bad day is refused; a good one lands at the end of the day in Bahia and the appraiser is told
    await signIn(s.staff.userId)
    expect((await call(req.id, { action: 'due', dueDay: '2020-01-01' })).status).toBe(422)
    const day = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10)
    const d = await call(req.id, { action: 'due', dueDay: day })
    expect(d.status).toBe(200)
    expect(await d.json()).toMatchObject({ dueDay: day })
    expect((await prisma.appraisalRequest.findUniqueOrThrow({ where: { id: req.id } })).dueOn.toISOString()).toBe(new Date(`${day}T23:59:59-03:00`).toISOString())
    expect(await prisma.notification.count({ where: { userId: avaId, kind: 'appraisal.due_changed' } })).toBe(1)
    // the team issues on the appraiser's behalf: the signer is the staff account; the request keeps the assigned appraiser
    const issued = await issueAppraisal({ userId: s.staff.userId, name: 'Equipe', profile: 'admin' }, req.id, range)
    expect((await prisma.appraisal.findUniqueOrThrow({ where: { requestId: req.id } })).appraiserUserId).toBe(s.staff.userId)
    expect((await prisma.appraisalRequest.findUniqueOrThrow({ where: { id: req.id } })).assignedAppraiserId).toBe(avaId)
    expect((await appraisalQueue(new Date(), { all: true }))[0]).toMatchObject({ id: req.id, state: 'ISSUED', issuedCode: issued.code })
    // a closed request takes no action
    expect((await call(req.id, { action: 'assign', appraiserUserId: null })).status).toBe(409)
  })

  it('an appraiser takes an open request (once), the assigned one issues; the team cancels with a note and the open order dies with it', async () => {
    const req = await ask()
    await signIn(s.staff.userId)
    expect((await call(req.id, { action: 'take' })).status).toBe(403)
    await signIn(avaId)
    const t = await call(req.id, { action: 'take' })
    expect(t.status).toBe(200)
    expect(await t.json()).toMatchObject({ assignedAppraiserId: avaId, status: 'IN_PROGRESS' })
    await signIn(ava2Id)
    expect((await call(req.id, { action: 'take' })).status).toBe(409)
    // the assigned appraiser issues
    await issueAppraisal({ userId: avaId, name: 'Rui Avaliador', profile: 'appraiser' }, req.id, range)

    // a second request, cancelled by the team: note required; the paid order is refunded (mock: nothing to give back) and reads CANCELLED; the requester is told
    const req2 = await ask()
    await signIn(avaId)
    expect((await call(req2.id, { action: 'cancel', note: 'x' })).status).toBe(403)
    await signIn(s.staff.userId)
    expect((await call(req2.id, { action: 'cancel', note: '' })).status).toBe(422)
    const c = await call(req2.id, { action: 'cancel', note: 'Obra retirada pelo colecionador' })
    expect(c.status).toBe(200)
    expect(await c.json()).toMatchObject({ status: 'CANCELLED', orderStatus: 'CANCELLED', refunded: true })
    expect((await prisma.appraisalRequest.findUniqueOrThrow({ where: { id: req2.id } })).status).toBe('CANCELLED')
    expect((await prisma.order.findFirstOrThrow({ where: { appraisalRequestId: req2.id } })).status).toBe('CANCELLED')
    expect(await prisma.notification.count({ where: { userId: collectorId, kind: 'appraisal.cancelled' } })).toBe(1)
    const a = await prisma.auditLog.findFirstOrThrow({ where: { entity: 'appraisal_request', entityId: String(req2.id), action: 'cancel' } })
    expect(a.after).toContain('"refundPending":false')
    expect(a.after).toContain('"refunded":true')
    expect((await call(req2.id, { action: 'cancel', note: 'de novo' })).status).toBe(409)
    // a refund the gateway refuses leaves the order PAID and flags it for finance
    const req3 = await ask()
    await prisma.order.updateMany({ where: { appraisalRequestId: req3.id }, data: { paymentRef: 'pi_test_refused' } })
    process.env.STRIPE_ENV = 'test'; process.env.STRIPE_SECRET_KEY = 'sk_test_x'
    setStripeGatewayForTests({ refundPaymentIntent: async () => { throw Object.assign(new Error('refused'), { type: 'StripeInvalidRequestError' }) } } as unknown as StripeGateway)
    const c3 = await call(req3.id, { action: 'cancel', note: 'Pedido em duplicidade' })
    setStripeGatewayForTests(null); process.env.STRIPE_ENV = 'mock'; delete process.env.STRIPE_SECRET_KEY
    expect(await c3.json()).toMatchObject({ orderStatus: 'PAID', refunded: false })
    expect((await prisma.auditLog.findFirstOrThrow({ where: { entity: 'appraisal_request', entityId: String(req3.id), action: 'cancel' } })).after).toContain('"refundPending":true')
    expect((await prisma.order.findFirstOrThrow({ where: { appraisalRequestId: req3.id } })).status).toBe('PAID')
  })
})
