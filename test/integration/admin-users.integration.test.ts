// Admin › Usuários e contas: the list the desk reads and the four actions through the route —
// only staff; block closes sessions; the admin never blocks themself nor the last admin; the
// staff profile moves only between staff profiles; the password link goes to an active account;
// the team invite is reissued with a new token.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { createHash } from 'node:crypto'
import { POST } from '@/app/api/admin/users/[id]/route'
import { adminUsers } from '@/lib/admin-users/server'
import { createScenario, type Scenario } from './fixtures'
import { signIn, signOut } from './session'
import { truncateTables } from './db'

let s: Scenario
beforeEach(async () => { s = await createScenario(); await truncateTables(['TeamInvite', 'KycVerification']) })
afterEach(() => signOut())

const call = (id: number, body: unknown) => POST(new Request(`http://test/api/admin/users/${id}`, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }), { params: Promise.resolve({ id: String(id) }) })
const sessionsOf = (userId: number) => prisma.session.count({ where: { userId } })

describe('admin users', () => {
  it('lists with search, kinds, member, kyc and what the viewer may do', async () => {
    await prisma.kycVerification.create({ data: { userId: s.b.userId, provider: 'mock', status: 'APPROVED', verifiedAt: new Date(), expiresAt: new Date(Date.now() - 1) } })
    const actor = { id: s.staff.userId, profile: 'admin' }
    const all = await adminUsers(actor, undefined)
    expect(all.map((r) => r.email).sort()).toEqual(['a1@galeria.test', 'a2@galeria.test', 'b@artista.test', 'staff@houseart.test'])
    const b = all.find((r) => r.email === 'b@artista.test')!
    expect(b).toMatchObject({ profile: 'member', kinds: ['ARTIST'], state: 'ACTIVE', kyc: 'EXPIRED', member: { kind: 'ARTIST', status: 'ACTIVE', tenant: 'Joana Teixeira' }, can: { block: true, profile: false, reset: true, invite: false } })
    const me = all.find((r) => r.id === s.staff.userId)!
    expect(me.can).toEqual({ block: false, profile: false, reset: false, invite: false })
    expect((await adminUsers(actor, 'galeria')).map((r) => r.email).sort()).toEqual(['a1@galeria.test', 'a2@galeria.test'])
    expect((await adminUsers(actor, `#${s.b.userId}`)).map((r) => r.id)).toEqual([s.b.userId])
  })

  it('the route: staff only; block closes the sessions, self and the last admin are refused, unblock works', async () => {
    await signIn(s.b.userId)
    expect((await call(s.a1.userId, { action: 'block' })).status).toBe(403)
    signOut()
    await signIn(s.b.userId); signOut() // a session row of b stays open
    await signIn(s.staff.userId)
    expect(await sessionsOf(s.b.userId)).toBeGreaterThan(0)
    expect((await call(s.b.userId, { action: 'block' })).status).toBe(200)
    expect(await prisma.user.findUniqueOrThrow({ where: { id: s.b.userId }, select: { active: true } })).toEqual({ active: false })
    expect(await sessionsOf(s.b.userId)).toBe(0)
    expect((await call(s.b.userId, { action: 'reset' })).status).toBe(403) // blocked: no password link
    expect((await call(s.staff.userId, { action: 'block' })).status).toBe(403)
    expect((await call(s.b.userId, { action: 'unblock' })).status).toBe(200)
    expect((await call(s.b.userId, { action: 'reset' })).status).toBe(200)
    expect(await prisma.accessCode.count({ where: { userId: s.b.userId, purpose: 'RESET' } })).toBe(1)
    expect((await call(s.b.userId, { action: 'nope' })).status).toBe(400)
    expect((await call(999_999, { action: 'block' })).status).toBe(404)
    await expect.poll(() => prisma.auditLog.findMany({ where: { entity: 'user', entityId: String(s.b.userId) }, select: { action: true } }).then((xs) => xs.map((a) => a.action).sort())).toEqual(['block', 'password_link', 'unblock'])
    // the person asked for deletion: read as "Exclusão pedida", never reopened by the desk
    await prisma.user.update({ where: { id: s.b.userId }, data: { active: false, deletionRequestedAt: new Date() } })
    expect((await adminUsers({ id: s.staff.userId, profile: 'admin' }, `#${s.b.userId}`))[0]).toMatchObject({ state: 'DELETION', can: { block: false } })
    expect((await call(s.b.userId, { action: 'unblock' })).status).toBe(403)
  })

  it('staff profile: admin only, between staff profiles, never a member, the last admin stays admin; a manager cannot block an admin', async () => {
    const pw = await hashPassword('senha-forte-1')
    const manager = await prisma.user.create({ data: { email: 'gestor@houseart.test', name: 'Gestor', passwordHash: pw, profile: 'manager', active: true } })
    await signIn(s.staff.userId)
    expect((await call(manager.id, { action: 'profile', profile: 'operator' })).status).toBe(200)
    expect((await prisma.user.findUniqueOrThrow({ where: { id: manager.id } })).profile).toBe('operator')
    expect((await call(manager.id, { action: 'profile', profile: 'member' })).status).toBe(403)
    expect((await call(s.b.userId, { action: 'profile', profile: 'operator' })).status).toBe(403)
    expect((await call(s.staff.userId, { action: 'profile', profile: 'manager' })).status).toBe(403)
    signOut()
    await prisma.user.update({ where: { id: manager.id }, data: { profile: 'manager' } })
    await signIn(manager.id)
    expect((await call(s.staff.userId, { action: 'block' })).status).toBe(403)
    expect((await call(s.b.userId, { action: 'profile', profile: 'operator' })).status).toBe(403)
    expect((await call(s.b.userId, { action: 'block' })).status).toBe(200) // a manager outranks a member
  })

  it('reissues a pending team invite with a new token; none → 409', async () => {
    await signIn(s.staff.userId)
    expect((await call(s.b.userId, { action: 'invite' })).status).toBe(409)
    const old = createHash('sha256').update('old-token').digest('hex')
    const inv = await prisma.teamInvite.create({ data: { tenantId: s.galleryTenantId, email: 'b@artista.test', role: 'SALES', tokenHash: old, invitedByUserId: s.a1.userId, expiresAt: new Date(Date.now() + 1000) } })
    const rows = await adminUsers({ id: s.staff.userId, profile: 'admin' }, 'b@artista')
    expect(rows[0].pendingInvite).toMatchObject({ id: inv.id, gallery: 'Galeria Ladeira', role: 'SALES' })
    expect(rows[0].can.invite).toBe(true)
    const res = await call(s.b.userId, { action: 'invite' })
    expect(res.status).toBe(200); expect(await res.json()).toMatchObject({ ok: true, gallery: 'Galeria Ladeira' })
    const after = await prisma.teamInvite.findUniqueOrThrow({ where: { id: inv.id } })
    expect(after.tokenHash).not.toBe(old); expect(after.expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000)
  })
})
