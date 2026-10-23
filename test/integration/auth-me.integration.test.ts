// GET /api/auth/me carries the effective gallery team role (teamRole) the apps
// use to hide what the role cannot do: ADMIN · SALES · INVENTORY for the
// gallery team, null for anyone else (an artist, a collector). Nothing else of
// the team comes along.
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { GET as meGet } from '@/app/api/auth/me/route'
import { createScenario, type Scenario } from './fixtures'
import { signIn, signOut } from './session'

let s: Scenario

async function staff(email: string, role: 'SALES' | 'INVENTORY') {
  const u = await prisma.user.create({ data: { email, name: role, passwordHash: 'x', profile: 'member', active: true, profiles: { create: { kind: 'GALLERY', isDefault: true } } } })
  const m = await prisma.member.create({ data: { userId: u.id, tenantId: s.galleryTenantId, kind: 'GALLERY_STAFF', role, displayName: role, slug: `me-staff-${role.toLowerCase()}` } })
  await prisma.user.update({ where: { id: u.id }, data: { memberId: m.id, tenantId: s.galleryTenantId, tenantRole: 'MEMBER' } })
  return u.id
}

async function teamRoleOf(userId: number): Promise<unknown> {
  await signIn(userId)
  const res = await meGet()
  expect(res.status).toBe(200)
  const body = await res.json() as Record<string, unknown>
  expect(Object.keys(body).sort()).toEqual(['activeProfileKind', 'email', 'id', 'memberId', 'name', 'profile', 'teamRole', 'tenantId'])
  return body.teamRole
}

beforeEach(async () => {
  process.env.FLAG_TENANT_SCOPE = '1'
  s = await createScenario()
  signOut()
})

describe('GET /api/auth/me · teamRole', () => {
  it('401 without a session', async () => {
    expect((await meGet()).status).toBe(401)
  }, 60_000)

  it('admin, vendas and acervo of the gallery; null for an artist', async () => {
    const sales = await staff('me-vendas@galeria.test', 'SALES')
    const inventory = await staff('me-acervo@galeria.test', 'INVENTORY')
    expect(await teamRoleOf(s.a1.userId)).toBe('ADMIN')
    expect(await teamRoleOf(sales)).toBe('SALES')
    expect(await teamRoleOf(inventory)).toBe('INVENTORY')
    expect(await teamRoleOf(s.b.userId)).toBeNull()
    signOut()
  }, 60_000)
})
