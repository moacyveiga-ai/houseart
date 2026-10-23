// "Nova obra" is a GET page: visiting it twice must not leave two drafts behind.
import { beforeEach, describe, expect, it } from 'vitest'
import { openBlankDraft, patchArtwork } from '@/lib/artworks/server'
import { artworkPatchSchema } from '@/lib/artworks/input'
import { prisma } from '@/lib/prisma'
import { createScenario, type Scenario } from './fixtures'
import { asPanel } from './session'

let s: Scenario
beforeEach(async () => { s = await createScenario() })

describe('openBlankDraft', () => {
  it('reuses the untouched draft and creates a new one once it was filled', async () => {
    await asPanel(s.b.userId, async ({ scope }) => {
      const first = await openBlankDraft(scope)
      const again = await openBlankDraft(scope)
      expect(again.id).toBe(first.id)
      await patchArtwork(scope, first.id, artworkPatchSchema.parse({ title: 'Maré de março' }))
      const next = await openBlankDraft(scope)
      expect(next.id).not.toBe(first.id)
      expect(await prisma.artwork.count({ where: { memberId: first.memberId, status: 'DRAFT', title: 'Nova obra' } })).toBe(1)
    })
  })
})
