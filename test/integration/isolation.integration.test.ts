// Tenant isolation: gallery A never sees artist B, and vice versa; the gallery
// ADMIN sees the whole gallery; staff sees everything. Through the REAL
// session path and the scope extension (an unscoped list would throw).
import { beforeEach, describe, expect, it } from 'vitest'
import { requirePanel } from '@/lib/auth/panel'
import { getArtwork, listArtworks } from '@/lib/artworks/server'
import { createScenario, type Scenario } from './fixtures'
import { asPanel, signOut } from './session'

let s: Scenario
beforeEach(async () => { s = await createScenario(); signOut() })

describe('tenant isolation', () => {
  it('artist B sees only her own artwork; A1 (gallery ADMIN) sees the whole gallery; A2 only his', async () => {
    await asPanel(s.b.userId, async (p) => {
      expect(p.scope.kind).toBe('tenant')
      expect((await listArtworks(p.scope)).items.map((a) => a.id)).toEqual([s.b.artworkId])
      expect(await getArtwork(p.scope, s.a1.artworkId)).toBeNull()
    })
    await asPanel(s.a1.userId, async (p) => {
      expect((await listArtworks(p.scope)).items.map((a) => a.id).sort()).toEqual([s.a1.artworkId, s.a2.artworkId].sort())
      expect(await getArtwork(p.scope, s.b.artworkId)).toBeNull()
    })
    await asPanel(s.a2.userId, async (p) => {
      expect(p.scope.kind).toBe('member')
      expect((await listArtworks(p.scope)).items.map((a) => a.id)).toEqual([s.a2.artworkId])
    })
  })

  it('staff sees everything; the tenantId of the artwork was derived by trigger', async () => {
    await asPanel(s.staff.userId, async (p) => {
      expect(p.scope.kind).toBe('total')
      expect((await listArtworks(p.scope)).items).toHaveLength(3)
      const { prisma } = await import('@/lib/prisma')
      const b = await prisma.artwork.findUnique({ where: { id: s.b.artworkId }, select: { tenantId: true } })
      expect(b?.tenantId).toBe(s.b.tenantId)
    })
  })

  it('without a session the panel guard refuses with 401; an unscoped hot list inside a member scope throws', async () => {
    signOut()
    await expect(requirePanel()).rejects.toMatchObject({ status: 401 })
    const { prisma } = await import('@/lib/prisma')
    await expect(asPanel(s.a2.userId, () => prisma.artwork.findMany({}))).rejects.toThrow('without an owner filter')
  })
})
