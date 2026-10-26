// Admin › Auditoria: the trail read with the filters of the URL (entity, id, action, who by name or #id, days), paged newest first.
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { recordAudit } from '@/lib/audit'
import { adminAudit } from '@/lib/admin-audit/server'
import { parseQuery } from '@/lib/admin-audit/core'
import { createScenario, type Scenario } from './fixtures'

let s: Scenario
beforeEach(async () => { s = await createScenario() })

describe('admin audit', () => {
  it('filters and pages the trail', async () => {
    await recordAudit({ entity: 'user', entityId: s.b.userId, action: 'block', userId: s.staff.userId, userName: 'Equipe', after: { active: false } })
    await recordAudit({ entity: 'user', entityId: s.b.userId, action: 'unblock', userId: s.staff.userId, userName: 'Equipe', after: { active: true } })
    await recordAudit({ entity: 'artwork', entityId: s.a1.artworkId, action: 'update', userId: s.b.userId, userName: 'Joana Teixeira', before: { title: 'a' }, after: { title: 'b' }, origin: 'api' })
    await prisma.auditLog.create({ data: { entity: 'deal', entityId: '1', action: 'transfer', origin: 'job', createdAt: new Date('2026-01-10T12:00:00Z') } })
    const now = new Date()
    const all = await adminAudit(parseQuery({}), now)
    expect(all.total).toBe(4); expect(all.pages).toBe(1); expect(all.kpis.today).toBe(3); expect(all.kpis.week).toBe(3)
    expect(all.rows.map((r) => r.action)).toEqual(['update', 'unblock', 'block', 'transfer'])
    expect(all.rows[0]).toMatchObject({ entityLabel: 'Obra', actionLabel: 'alterou', who: 'Joana Teixeira', originLabel: 'API', href: null, before: '{"title":"a"}', after: '{"title":"b"}', afterFull: '{"title":"b"}' })
    expect((await adminAudit(parseQuery({ entity: 'user' }), now)).rows.map((r) => r.action)).toEqual(['unblock', 'block'])
    expect((await adminAudit(parseQuery({ entity: 'user', action: 'block' }), now)).total).toBe(1)
    expect((await adminAudit(parseQuery({ entity: 'user', id: String(s.b.userId) }), now)).total).toBe(2)
    expect((await adminAudit(parseQuery({ who: 'joana' }), now)).total).toBe(1)
    expect((await adminAudit(parseQuery({ who: `#${s.staff.userId}` }), now)).total).toBe(2)
    expect((await adminAudit(parseQuery({ from: '2026-01-01', to: '2026-01-31' }), now)).rows.map((r) => r.action)).toEqual(['transfer'])
    expect((await adminAudit(parseQuery({ from: '2026-01-01', to: '2026-12-31' }), now)).cut).toBe(true)
    expect((await adminAudit(parseQuery({ page: '2' }), now))).toMatchObject({ page: 1, pages: 1 }) // beyond the end: the last page
  })
})
