// Admin › Catálogo: the desk edits plans (price, limits, active) and services (price, unit,
// active) through the route; the marker kit and the transfer fee read the catalog; the default
// plan never switches off; the operator only reads; every change leaves an audit row.
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { POST } from '@/app/api/admin/catalog/route'
import { adminCatalog } from '@/lib/admin-catalog/server'
import { catalogPriceCents } from '@/lib/orders/server'
import { requestMarkers } from '@/lib/physical-markers/server'
import { scopeOfUser } from '@/lib/scope/core'
import { withScope } from '@/lib/scope/context'
import { createScenario, type Scenario } from './fixtures'
import { signIn, signOut } from './session'

let s: Scenario
// Plan/PlanFeature/ServiceCatalog are seeded once by the migration and never truncated: whatever this file changes is put back for the files that run after it.
type PlanSnap = { id: number; name: string; description: string; priceCents: bigint; active: boolean; features: { key: string; limit: number | null }[] }
type ServiceSnap = { id: number; name: string; description: string | null; priceCents: bigint; unit: string; active: boolean }
let plansBefore: PlanSnap[] = []
let servicesBefore: ServiceSnap[] = []
beforeAll(async () => {
  plansBefore = await prisma.plan.findMany({ include: { features: { select: { key: true, limit: true } } } })
  servicesBefore = await prisma.serviceCatalog.findMany()
})
afterAll(async () => {
  for (const p of plansBefore) {
    await prisma.plan.update({ where: { id: p.id }, data: { name: p.name, description: p.description, priceCents: p.priceCents, active: p.active } })
    await prisma.planFeature.deleteMany({ where: { planId: p.id, key: { notIn: p.features.map((f) => f.key) } } })
    for (const f of p.features) await prisma.planFeature.upsert({ where: { planId_key: { planId: p.id, key: f.key } }, create: { planId: p.id, key: f.key, limit: f.limit }, update: { limit: f.limit } })
  }
  for (const x of servicesBefore) await prisma.serviceCatalog.update({ where: { id: x.id }, data: { name: x.name, description: x.description, priceCents: x.priceCents, unit: x.unit, active: x.active } })
})
beforeEach(async () => { s = await createScenario() })
afterEach(() => signOut())

const call = (body: unknown) => POST(new Request('http://test/api/admin/catalog', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }))

describe('admin catalog', () => {
  it('reads plans with limits and services with roles; the staff edits; prices reach the kit and the fee', async () => {
    const before = await adminCatalog()
    const studio = before.plans.find((p) => p.code === 'ARTIST_STUDIO')!
    const kit = before.services.find((x) => x.code === 'TAG_KIT')!
    expect(studio).toMatchObject({ audienceLabel: 'Artista', priceCents: '4900', active: true, isDefault: false, activeSubscriptions: 0 })
    expect(studio.limits.map((l) => [l.key, l.limit])).toEqual([['ARTWORKS', 60], ['TAGS_INCLUDED', 10], ['APPRAISALS_INCLUDED', 1]])
    expect(kit).toMatchObject({ priceCents: '1500', unit: 'UNIT', unitLabel: 'por unidade', active: true })
    expect(kit.note).toMatch(/etiqueta/)
    // operator: reads, never writes
    const pw = await hashPassword('senha-forte-1')
    const operator = await prisma.user.create({ data: { email: 'op@houseart.test', name: 'Operador', passwordHash: pw, profile: 'operator', active: true } })
    await signIn(operator.id)
    expect((await call({ kind: 'service', id: kit.id, name: 'x', priceCents: 1, unit: 'UNIT', active: true })).status).toBe(403)
    signOut(); await signIn(s.b.userId)
    expect((await call({ kind: 'service', id: kit.id, name: 'x', priceCents: 1, unit: 'UNIT', active: true })).status).toBe(403)
    signOut(); await signIn(s.staff.userId)
    // plan: price, a limit to unlimited, another to zero
    let res = await call({ kind: 'plan', id: studio.id, name: 'Ateliê Plus', description: studio.description, priceCents: '59,90', active: true, limits: { ARTWORKS: '', APPRAISALS_INCLUDED: 0 } })
    expect(res.status).toBe(200)
    const saved = await res.json()
    expect(saved.changed.sort()).toEqual(['limits', 'name', 'priceCents'])
    expect(saved).toMatchObject({ name: 'Ateliê Plus', priceCents: '5990', active: true, limits: { ARTWORKS: null, TAGS_INCLUDED: 10, APPRAISALS_INCLUDED: 0 } }) // the screen shows what was saved
    // a limit the plan never had would add a line to its public price card
    expect((await call({ kind: 'plan', id: studio.id, name: 'Ateliê Plus', description: studio.description, priceCents: 5990, active: true, limits: { SEATS: 3 } })).status).toBe(422)
    const after = await adminCatalog()
    const studio2 = after.plans.find((p) => p.code === 'ARTIST_STUDIO')!
    expect(studio2).toMatchObject({ name: 'Ateliê Plus', priceCents: '5990' })
    expect(studio2.limits.map((l) => [l.key, l.limit])).toEqual([['ARTWORKS', null], ['TAGS_INCLUDED', 10], ['APPRAISALS_INCLUDED', 0]])
    // nothing changed → no audit row
    res = await call({ kind: 'plan', id: studio.id, name: 'Ateliê Plus', description: studio.description, priceCents: 5990, active: true, limits: {} })
    expect(await res.json()).toMatchObject({ changed: [] })
    // service: the kit price moves ("R$ 20" typed = reais) and the kit order carries it
    res = await call({ kind: 'service', id: kit.id, name: kit.name, description: kit.description, priceCents: 'R$ 20', unit: 'UNIT', active: true })
    expect(res.status).toBe(200); expect(await res.json()).toMatchObject({ priceCents: '2000', unit: 'UNIT' })
    expect(await catalogPriceCents('TAG_KIT')).toBe(2000n)
    const artist = scopeOfUser({ profile: 'member', memberId: s.b.memberId, tenantId: s.b.tenantId, tenantRole: 'ADMIN' }, () => false)
    const kitOrder = await withScope(artist, 'test', () => requestMarkers(artist, 3))
    expect(kitOrder.unitPriceCents).toBe(2000n)
    // the kit and the transfer fee are charged by the platform itself: never under quote, never free
    expect((await call({ kind: 'service', id: kit.id, name: kit.name, priceCents: 0, unit: 'QUOTE', active: true })).status).toBe(422)
    // validation: zero price outside a quote, unknown unit, unknown kind, missing row
    expect((await call({ kind: 'service', id: kit.id, name: kit.name, priceCents: 0, unit: 'UNIT', active: true })).status).toBe(422)
    expect((await call({ kind: 'service', id: kit.id, name: kit.name, priceCents: 10, unit: 'HOUR', active: true })).status).toBe(422)
    expect((await call({ kind: 'thing', id: kit.id })).status).toBe(400)
    expect((await call({ kind: 'service', id: 999_999, name: 'x', priceCents: 10, unit: 'UNIT', active: true })).status).toBe(404)
    // the default plan never switches off; Ateliê can
    const free = after.plans.find((p) => p.code === 'ARTIST_FREE')!
    expect((await call({ kind: 'plan', id: free.id, name: free.name, description: free.description, priceCents: 0, active: false, limits: {} })).status).toBe(409)
    expect((await call({ kind: 'plan', id: studio.id, name: 'Ateliê Plus', description: studio.description, priceCents: 5990, active: false, limits: {} })).status).toBe(200)
    expect((await adminCatalog()).plans.find((p) => p.code === 'ARTIST_STUDIO')?.active).toBe(false)
    // a switched-off service is no longer priced and the kit refuses BEFORE writing anything
    expect((await call({ kind: 'service', id: kit.id, name: kit.name, description: kit.description, priceCents: 2000, unit: 'UNIT', active: false })).status).toBe(200)
    expect(await catalogPriceCents('TAG_KIT')).toBeNull()
    const before2 = await prisma.markerOrder.count()
    await expect(withScope(artist, 'test', () => requestMarkers(artist, 1))).rejects.toMatchObject({ code: 'SERVICE_OFF' })
    expect(await prisma.markerOrder.count()).toBe(before2)
    await expect.poll(() => prisma.auditLog.count({ where: { entity: { in: ['plan', 'service_catalog'] }, action: 'update' } })).toBe(4)
    const row = await prisma.auditLog.findFirst({ where: { entity: 'plan' }, orderBy: { id: 'asc' } })
    expect(row?.after).toContain('"code":"ARTIST_STUDIO"'); expect(row?.after).toContain('5990')
  })
})
