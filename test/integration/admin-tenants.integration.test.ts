// Admin › Galerias e contas: the rows the desk reads (plan in force, team, contracts, inventory,
// CNPJ only as a mask), the courtesy plan (no charge, no invoice, right audience only), and the
// suspension that closes the members' sessions, refuses the panel and hides the works from the
// public marketplace until the reinstatement.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { POST } from '@/app/api/admin/tenants/[id]/route'
import { adminTenants } from '@/lib/admin-tenants/server'
import { panelSession, requirePanel } from '@/lib/auth/panel'
import { requireAuth } from '@/lib/auth'
import { listPublicArtworks, marketItems, publicArtwork } from '@/lib/marketplace/public-server'
import { listPublicArtists } from '@/lib/public-content/server'
import { createScenario, type Scenario } from './fixtures'
import { signIn, signOut } from './session'
import { truncateTables } from './db'

let s: Scenario
beforeEach(async () => {
  s = await createScenario()
  await truncateTables(['PlanSubscription', 'Invoice', 'TeamInvite', 'ArtistContract', 'Session', 'AuditLog'])
  await prisma.galleryProfile.create({ data: { tenantId: s.galleryTenantId, legalName: 'Ladeira Arte Ltda', tradeName: 'Galeria Ladeira', cnpjHash: 'h'.repeat(64), cnpjMask: '12.***.***/0001-**' } })
  await prisma.teamInvite.create({ data: { tenantId: s.galleryTenantId, email: 'nova@galeria.test', role: 'SALES', tokenHash: 't'.repeat(64), invitedByUserId: s.a1.userId, expiresAt: new Date(Date.now() + 86_400_000) } })
  const artist = await prisma.artist.findFirstOrThrow({ where: { slug: 'tomas-rezende' } })
  await prisma.artistContract.create({ data: { tenantId: s.galleryTenantId, artistId: artist.id } })
  await prisma.artwork.update({ where: { id: s.a1.artworkId }, data: { status: 'LISTED', seal: 'GREEN', publicId: 'HA-2026-TEN-0001', listPriceCents: 500_000n } })
})
afterEach(() => signOut())

const call = (id: number, body: unknown) => POST(new Request(`http://test/api/admin/tenants/${id}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }), { params: Promise.resolve({ id: String(id) }) })

describe('admin tenants', () => {
  it('lists every tenant with plan, team, contracts and inventory; the CNPJ is only a mask', async () => {
    const { rows, plans } = await adminTenants({ profile: 'admin' }, undefined)
    const g = rows.find((r) => r.id === s.galleryTenantId)!
    expect(g).toMatchObject({ kind: 'GALLERY', status: 'ACTIVE', legalName: 'Ladeira Arte Ltda', cnpjMask: '12.***.***/0001-**', audience: 'GALLERY', contracts: 1, listed: 1, artworks: 2 })
    expect(g.members).toMatchObject({ staff: 1, advisors: 1, artists: 0 })
    expect(g.team).toMatchObject({ admin: 0, pendingInvites: 1 })
    expect(g.admin).toMatchObject({ id: s.a1.userId, email: 'a1@galeria.test' })
    expect(g.plan).toMatchObject({ code: 'GALLERY', subscription: 'DEFAULT', paid: false })
    expect(g.can).toEqual({ plan: true, suspend: true, reinstate: false })
    const p = rows.find((r) => r.id === s.b.tenantId)!
    expect(p).toMatchObject({ kind: 'PERSON', audience: 'ARTIST', plan: { code: 'ARTIST_FREE' } })
    expect(JSON.stringify(rows)).not.toContain('h'.repeat(64))
    expect(plans.map((x) => x.code)).toContain('GALLERY_PRO')
    // the reader of the team sees no action; the query finds by #id and by legal name
    expect((await adminTenants({ profile: 'operator' }, undefined)).rows[0].can).toEqual({ plan: false, suspend: false, reinstate: false })
    expect((await adminTenants({ profile: 'admin' }, `#${s.b.tenantId}`)).rows.map((r) => r.id)).toEqual([s.b.tenantId])
    expect((await adminTenants({ profile: 'admin' }, 'ladeira arte')).rows.map((r) => r.id)).toEqual([s.galleryTenantId])
  })

  it('grants a courtesy plan of the right audience without charge or invoice; a reader is refused', async () => {
    await signIn(s.a1.userId)
    expect((await call(s.galleryTenantId, { action: 'plan', code: 'GALLERY_PRO', note: 'x' })).status).toBe(403)
    const operator = await prisma.user.create({ data: { email: 'op@houseart.test', name: 'Op', profile: 'operator', active: true } })
    await signIn(operator.id)
    expect((await call(s.galleryTenantId, { action: 'plan', code: 'GALLERY_PRO', note: 'x' })).status).toBe(403)
    await signIn(s.staff.userId)
    expect((await call(s.galleryTenantId, { action: 'plan', code: 'GALLERY_PRO', note: '' })).status).toBe(422)
    expect((await call(s.galleryTenantId, { action: 'plan', code: 'ARTIST_STUDIO', note: 'parceria' })).status).toBe(400)
    const r = await call(s.galleryTenantId, { action: 'plan', code: 'GALLERY_PRO', note: 'parceria de lançamento' })
    expect(r.status).toBe(200)
    expect(await r.json()).toMatchObject({ code: 'GALLERY_PRO', name: 'Galeria Pro' })
    expect(await prisma.planSubscription.count({ where: { tenantId: s.galleryTenantId, status: 'ACTIVE' } })).toBe(1)
    expect(await prisma.invoice.count({ where: { tenantId: s.galleryTenantId } })).toBe(0)
    expect((await prisma.planSubscription.findFirstOrThrow({ where: { tenantId: s.galleryTenantId, status: 'ACTIVE' } })).currentPeriodEnd).toBeNull()
    expect((await call(s.galleryTenantId, { action: 'plan', code: 'GALLERY_PRO', note: 'de novo' })).status).toBe(409)
    const row = (await adminTenants({ profile: 'admin' }, `#${s.galleryTenantId}`)).rows[0]
    expect(row.plan).toMatchObject({ code: 'GALLERY_PRO', subscription: 'ACTIVE', paid: true })
    const a = await prisma.auditLog.findFirstOrThrow({ where: { entity: 'tenant', entityId: String(s.galleryTenantId), action: 'plan_granted' } })
    expect(a.after).toContain('"courtesy":true')
  })

  it('suspending closes the members\' sessions, refuses the panel and hides the works; reinstating brings them back', async () => {
    expect((await listPublicArtworks()).map((w) => w.publicId)).toEqual(['HA-2026-TEN-0001'])
    await signIn(s.a1.userId)
    expect(await panelSession()).not.toBeNull()
    await signIn(s.staff.userId)
    expect((await call(s.galleryTenantId, { action: 'suspend', note: '' })).status).toBe(422)
    const r = await call(s.galleryTenantId, { action: 'suspend', note: 'Denúncia em apuração' })
    expect(r.status).toBe(200)
    expect(await r.json()).toMatchObject({ status: 'SUSPENDED', closedSessions: 1 })
    expect((await call(s.galleryTenantId, { action: 'suspend', note: 'de novo' })).status).toBe(409)
    expect((await call(s.galleryTenantId, { action: 'plan', code: 'GALLERY_PRO', note: 'x' })).status).toBe(409)
    // the public site forgets the gallery's works; the gallery staff has no panel
    expect(await listPublicArtworks()).toEqual([])
    expect(await marketItems()).toEqual([])
    expect(await publicArtwork('HA-2026-TEN-0001')).toBeNull()
    expect((await listPublicArtists()).map((a) => a.slug)).not.toContain('tomas-rezende')
    // the gallery staff has no panel and no API of the product (community, messages, apps); the session says so
    await signIn(s.a1.userId)
    expect(await panelSession()).toBeNull()
    await expect(requirePanel()).rejects.toMatchObject({ status: 403 })
    await expect(requireAuth()).rejects.toMatchObject({ status: 403 })
    // the team keeps the panel; the other tenant is untouched
    await signIn(s.staff.userId)
    expect(await panelSession()).not.toBeNull()
    await signIn(s.b.userId)
    expect(await panelSession()).not.toBeNull()
    // reinstate
    await signIn(s.staff.userId)
    const back = await call(s.galleryTenantId, { action: 'reinstate' })
    expect(back.status).toBe(200)
    expect((await listPublicArtworks()).map((w) => w.publicId)).toEqual(['HA-2026-TEN-0001'])
    expect(await publicArtwork('HA-2026-TEN-0001')).not.toBeNull()
    await signIn(s.a1.userId)
    expect(await panelSession()).not.toBeNull()
    expect(await prisma.auditLog.count({ where: { entity: 'tenant', entityId: String(s.galleryTenantId), action: { in: ['suspend', 'reinstate'] } } })).toBe(2)
  })
})
