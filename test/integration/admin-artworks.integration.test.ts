// Admin › Obras e certificados › Todas as obras: every work in any state, filters, search and the certificate line.
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { adminArtworks } from '@/lib/admin-artworks/server'
import { createScenario, type Scenario } from './fixtures'
import { truncateTables } from './db'

let s: Scenario
beforeEach(async () => {
  s = await createScenario()
  await truncateTables(['ReviewQueueItem'])
  await prisma.artwork.update({ where: { id: s.a1.artworkId }, data: { status: 'AUTHENTICATED', seal: 'GREEN', publicId: 'HA-2026-LIST-0001' } })
  await prisma.artwork.update({ where: { id: s.b.artworkId }, data: { status: 'DISPUTED' } })
  await prisma.reviewQueueItem.create({ data: { kind: 'CONTESTATION', artworkId: s.b.artworkId, reason: 'Contestação de teste' } })
})

describe('admin artworks list', () => {
  it('lists every account, filters by state and reads the search', async () => {
    const all = await adminArtworks({ f: 'all' })
    expect(all.total).toBe(3)
    expect(all.kpis).toMatchObject({ all: 3, certified: 1, alert: 1 })
    const alert = await adminArtworks({ f: 'alert' })
    expect(alert.rows.map((r) => r.id)).toEqual([s.b.artworkId])
    expect(alert.rows[0]!.openReviews).toBe(1)
    expect((await adminArtworks({ f: 'all', q: 'ha-2026-list' })).rows.map((r) => r.id)).toEqual([s.a1.artworkId])
    expect((await adminArtworks({ f: 'all', q: `#${s.a2.artworkId}` })).rows.map((r) => r.id)).toEqual([s.a2.artworkId])
    expect((await adminArtworks({ f: 'drafts' })).rows.map((r) => r.id)).toEqual([s.a2.artworkId])
    // nothing of the mandate or the vault leaves: only the listed fields
    expect(Object.keys(all.rows[0]!).sort()).toEqual(['account', 'artist', 'certificate', 'cover', 'createdAt', 'id', 'openReviews', 'publicId', 'seal', 'status', 'title', 'year'])
  })
})
