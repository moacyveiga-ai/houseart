// "Cadastrar obra" of the collector (/wallet/register): the draft is the collector's own and only theirs,
// the artist wizard never adopts it, an artist member is sent to the panel wizard, the default title
// counts as empty for the photo reading, and "Em cadastro" tells a concluded register from a draft.
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { collectorDraft, collectorDrafts, registerOwnArtwork } from '@/lib/collectors/server'
import { openBlankDraft } from '@/lib/artworks/server'
import { applyReading } from '@/lib/artworks/reading-core'
import { withScope } from '@/lib/scope/context'
import { scopeOfUser } from '@/lib/scope/core'
import { createScenario, type Scenario } from './fixtures'
import { truncateTables } from './db'

const collector = (email: string, name: string) => prisma.user.create({ data: { email, name, profile: 'collector', active: true, emailVerifiedAt: new Date() } })

let s: Scenario
beforeEach(async () => {
  process.env.FLAG_TENANT_SCOPE = '1'
  s = await createScenario()
  await truncateTables(['Mandate', 'Offer', 'Deal', 'Notification'])
})

describe('cadastrar obra do colecionador', () => {
  it('the draft is the collector\'s own; another person never reads it', async () => {
    const marina = await collector('marina@col.test', 'Marina')
    const lia = await collector('lia@col.test', 'Lia')
    const { id } = await registerOwnArtwork(marina.id, { artistName: 'Joana Teixeira', acquisitionKind: 'BOUGHT_OUTSIDE', acquisitionPriceCents: 1_200_000n })
    expect((await collectorDraft(marina.id, id))?.id).toBe(id)
    expect(await collectorDraft(lia.id, id)).toBeNull()
    expect(await collectorDraft(s.b.userId, id)).toBeNull()
    // an artist member registers in the panel wizard, not here
    await expect(registerOwnArtwork(s.b.userId, { artistName: 'Outro', acquisitionKind: 'INHERITED' })).rejects.toMatchObject({ code: 'NOT_COLLECTOR', status: 403 })
  }, 60_000)

  it('the artist wizard never adopts the collector draft; "Em cadastro" tells concluded from draft', async () => {
    const marina = await collector('marina@col.test', 'Marina')
    const { id } = await registerOwnArtwork(marina.id, { artistName: 'Joana Teixeira', acquisitionKind: 'FROM_ARTIST' })
    const u = await prisma.user.findUniqueOrThrow({ where: { id: marina.id }, select: { memberId: true, tenantId: true } })
    const scope = scopeOfUser({ profile: 'collector', memberId: u.memberId, tenantId: u.tenantId, tenantRole: 'ADMIN' }, () => false)
    const blank = await withScope(scope, 'test', () => openBlankDraft(scope))
    expect(blank.id).not.toBe(id)
    let rows = await collectorDrafts(marina.id)
    expect(rows.find((r) => r.id === id)).toMatchObject({ completed: false, href: `/wallet/register?draft=${id}` })
    await prisma.artwork.update({ where: { id }, data: { wizardStep: 5 } })
    rows = await collectorDrafts(marina.id)
    expect(rows.find((r) => r.id === id)).toMatchObject({ completed: true })
  }, 60_000)

  it('the default title counts as empty for the photo reading', () => {
    const r = applyReading({ title: 'Nova obra', year: null, technique: null, materials: null, edition: null, signatureLocation: null }, { title: 'Mar de dentro' })
    expect(r.patch.title).toBe('Mar de dentro')
  })
})
