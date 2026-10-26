// Admin › Saúde operacional: every cron run leaves a JobRun row (ok, failed, skipped) through
// withJob; a Stripe webhook the handler cannot process leaves a WEBHOOK/FAILED row; adminOps reads
// the health of each cron from that trail and the finance alerts from the audit trail; the
// configuration block says only whether each setting exists.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withJob } from '@/lib/jobs/auth'
import { pruneJobRuns } from '@/lib/job-runs/server'
import { adminOps } from '@/lib/admin-ops/server'
import { handleStripeWebhook } from '@/lib/stripe/webhook-server'
import { signStripePayload } from '@/lib/stripe/mode-core'
import { audit } from '@/lib/audit'
import { createScenario, type Scenario } from './fixtures'
import { signIn, signOut } from './session'
import { truncateTables } from './db'

const ENV_KEYS = ['CRON_SECRET', 'STRIPE_ENV', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SMTP_URL'] as const
const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {}
let s: Scenario
beforeAll(() => { for (const k of ENV_KEYS) saved[k] = process.env[k]; process.env.CRON_SECRET = 'cron-secret'; delete process.env.SMTP_URL })
afterAll(() => { for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k] } })
beforeEach(async () => { s = await createScenario(); await truncateTables(['JobRun', 'JobLease', 'StripeEvent', 'AuditLog']) })
afterEach(() => signOut())

const req = (method: string, auth?: string) => new NextRequest('http://test/api/cron/offers-expire', { method, headers: auth ? { authorization: auth } : {} })
const bearer = 'Bearer cron-secret'

describe('admin ops', () => {
  it('withJob leaves the trail: ok, failed, skipped; manual runs need admin or manager', async () => {
    let r = await withJob(req('GET', bearer), 'offers-expire', async () => Response.json({ ok: true, expired: 3 }))
    expect(r.status).toBe(200)
    r = await withJob(req('GET', bearer), 'offers-expire', async () => { throw new TypeError('boom') })
    expect(r.status).toBe(500)
    // a run that finds the lease taken is SKIPPED
    await prisma.jobLease.upsert({ where: { name: 'instagram' }, create: { name: 'instagram', runId: 'other', lockedUntil: new Date(Date.now() + 60_000) }, update: { runId: 'other', lockedUntil: new Date(Date.now() + 60_000) } })
    r = await withJob(req('GET', bearer), 'instagram', async () => Response.json({ ok: true }))
    expect(await r.json()).toMatchObject({ skipped: 'running' })
    const runs = await prisma.jobRun.findMany({ orderBy: { id: 'asc' } })
    expect(runs.map((x) => [x.kind, x.name, x.status, x.httpStatus])).toEqual([['CRON', 'offers-expire', 'OK', 200], ['CRON', 'offers-expire', 'FAILED', 500], ['CRON', 'instagram', 'SKIPPED', 200]])
    expect(runs[0].summary).toContain('"expired":3')
    expect(runs[1].error).toBe('TypeError')
    expect(runs[2].runId).toBeNull()
    // without the secret: a member's POST is refused; the staff's POST runs
    await signIn(s.b.userId)
    expect((await withJob(req('POST'), 'offers-expire', async () => Response.json({ ok: true }))).status).toBe(401)
    await signIn(s.staff.userId)
    expect((await withJob(req('POST'), 'offers-expire', async () => Response.json({ ok: true }))).status).toBe(200)
    expect(await prisma.jobRun.count({ where: { name: 'offers-expire' } })).toBe(3)
    // a run the platform killed stays RUNNING: the next run of the same job closes it as a timeout, and the health reads it as a failure
    await prisma.jobRun.create({ data: { kind: 'CRON', name: 'market-indicators', status: 'RUNNING', startedAt: new Date(Date.now() - 20 * 60_000) } })
    expect((await adminOps()).crons.find((c) => c.name === 'market-indicators')).toMatchObject({ health: 'FAILING', failures7d: 1 })
    await withJob(req('GET', bearer), 'market-indicators', async () => Response.json({ ok: true }))
    const closed = await prisma.jobRun.findFirstOrThrow({ where: { name: 'market-indicators', error: 'timeout' } })
    expect(closed.status).toBe('FAILED'); expect(closed.finishedAt).not.toBeNull()
    // a SKIPPED run after a failed one never hides it
    await prisma.jobRun.create({ data: { kind: 'CRON', name: 'offers-expire', status: 'SKIPPED', startedAt: new Date(), httpStatus: 200 } })
    await prisma.jobRun.updateMany({ where: { name: 'offers-expire', status: 'OK' }, data: { startedAt: new Date(Date.now() - 2 * 60_000) } })
    await prisma.jobRun.updateMany({ where: { name: 'offers-expire', status: 'FAILED' }, data: { startedAt: new Date(Date.now() - 60_000) } })
    expect((await adminOps()).crons.find((c) => c.name === 'offers-expire')?.health).toBe('FAILING')
    // retention: the daily anchor prunes the trail
    await prisma.jobRun.create({ data: { kind: 'CRON', name: 'offers-expire', status: 'OK', startedAt: new Date(Date.now() - 100 * 86_400_000), httpStatus: 200 } })
    expect(await pruneJobRuns()).toBe(1)
  })

  it('reads the health of each cron, the webhook failures and the finance alerts; configuration is presence only', async () => {
    const now = new Date()
    await prisma.jobRun.createMany({ data: [
      { kind: 'CRON', name: 'offers-expire', status: 'OK', startedAt: new Date(now.getTime() - 20 * 60_000), ms: 50, httpStatus: 200 },
      { kind: 'CRON', name: 'market-indicators', status: 'OK', startedAt: new Date(now.getTime() - 5 * 3_600_000), ms: 50, httpStatus: 200 },
      { kind: 'CRON', name: 'connect-payouts', status: 'FAILED', startedAt: new Date(now.getTime() - 10 * 60_000), ms: 50, httpStatus: 500, error: 'TypeError' },
      { kind: 'CRON', name: 'connect-payouts', status: 'OK', startedAt: new Date(now.getTime() - 70 * 60_000), ms: 50, httpStatus: 200 },
    ] })
    // a webhook the handler cannot process (the deal hook throws) → 500 to Stripe and a FAILED row, no payload
    process.env.STRIPE_ENV = 'test'; process.env.STRIPE_SECRET_KEY = 'sk_test_x'; process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test'
    const body = JSON.stringify({ id: 'evt_ops_1', object: 'event', type: 'payment_intent.succeeded', livemode: false, data: { object: { id: 'pi_ops_1', object: 'payment_intent', status: 'succeeded', metadata: { secret: 'never-stored' } } } })
    const wh = await handleStripeWebhook(body, signStripePayload(body, 'whsec_test', Math.floor(now.getTime() / 1000)), now.getTime(), { onPaymentSucceeded: async () => { throw Object.assign(new Error('db down'), { code: 'P1001' }) } })
    expect(wh.status).toBe(500)
    process.env.STRIPE_ENV = 'mock'; delete process.env.STRIPE_SECRET_KEY; delete process.env.STRIPE_WEBHOOK_SECRET
    const fail = await prisma.jobRun.findFirstOrThrow({ where: { kind: 'WEBHOOK' } })
    expect(fail).toMatchObject({ name: 'stripe:payment_intent.succeeded', status: 'FAILED', error: 'P1001' })
    expect(JSON.stringify(fail)).not.toContain('never-stored')
    // finance alerts come from the audit trail
    // the shape lib/appraisal/server.ts cancelRequest writes when the Stripe refund is refused
    await audit.event({ entity: 'appraisal_request', entityId: 7, action: 'cancel', userId: s.staff.userId, after: { status: 'CANCELLED', orderStatus: 'PAID', refunded: false, refundPending: true, refundError: 'StripeError' } })
    await audit.event({ entity: 'appraisal_request', entityId: 8, action: 'cancel', userId: s.staff.userId, after: { status: 'CANCELLED', orderStatus: 'CANCELLED', refunded: true, refundPending: false, refundError: null } })
    await audit.event({ entity: 'deal_split', entityId: 3, action: 'transfer_unrecorded', after: { party: 'ARTIST' } })
    const v = await adminOps(now)
    const health = Object.fromEntries(v.crons.map((c) => [c.name, c.health]))
    expect(health).toEqual({ 'certificate-anchor': 'NEVER', 'offers-expire': 'OK', 'connect-payouts': 'FAILING', 'market-indicators': 'LATE', instagram: 'NEVER' })
    expect(v.crons.find((c) => c.name === 'connect-payouts')).toMatchObject({ failures7d: 1, runs: expect.arrayContaining([expect.objectContaining({ status: 'FAILED' })]) })
    expect(v.webhookFailures).toHaveLength(1)
    expect(v.financeAlerts.map((a) => [a.entity, a.entityId, a.action]).sort()).toEqual([['appraisal_request', '7', 'cancel'], ['deal_split', '3', 'transfer_unrecorded']])
    expect(v.financeAlerts.find((a) => a.entityId === '7')?.href).toBe('/admin/audit?entity=appraisal_request&id=7')
    expect(v.kpis).toMatchObject({ cronsOk: 1, cronsBad: 2, cronsNever: 2, webhookFailures7d: 1, financeAlerts: 2 })
    const smtp = v.config.find((c) => c.key === 'SMTP_URL')!
    expect(smtp.ok).toBe(false)
    expect(JSON.stringify(v.config)).not.toContain('cron-secret')
  })
})
