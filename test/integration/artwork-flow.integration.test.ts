// Artist creates a draft, fills the sheet, uploads front/back (vault + public
// derivative + pHash), and submits for certification.
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createDraft, getArtwork, patchArtwork, submitForCertification } from '@/lib/artworks/server'
import { uploadMedia } from '@/lib/artworks/media-server'
import { artworkPatchSchema } from '@/lib/artworks/input'
import { createScenario, type Scenario } from './fixtures'
import { asPanel } from './session'

const cwd = process.cwd()
let dir = ''
let s: Scenario
beforeAll(() => { dir = mkdtempSync(path.join(os.tmpdir(), 'ha-flow-')); process.chdir(dir); delete process.env.VERCEL; delete process.env.BLOB_READ_WRITE_TOKEN; delete process.env.BLOB_PRIVATE_READ_WRITE_TOKEN })
afterAll(() => { process.chdir(cwd); rmSync(dir, { recursive: true, force: true }) })
beforeEach(async () => { s = await createScenario() })

async function png(color: { r: number; g: number; b: number }): Promise<Buffer> {
  return sharp({ create: { width: 320, height: 240, channels: 3, background: color } }).png().toBuffer()
}

describe('artwork flow', () => {
  it('draft → sheet → media → submit', async () => {
    await asPanel(s.b.userId, async ({ scope, user }) => {
    const draft = await createDraft(scope, { title: 'Maré de março' })
    const patch = artworkPatchSchema.parse({ year: 2026, technique: 'Têmpera sobre tela', heightMm: '90', widthMm: '90', saleMode: 'FIXED_WITH_OFFERS', listPriceCents: '21000' })
    const after = await patchArtwork(scope, draft.id, patch)
    expect(after).toMatchObject({ heightMm: 900, listPriceCents: 2_100_000n })

    await expect(submitForCertification(scope, draft.id, { userId: user.id, name: user.name })).rejects.toMatchObject({ code: 'INCOMPLETE' })

    const front = await uploadMedia(scope, draft.id, 'FRONT_COLOR_CARD', { bytes: await png({ r: 200, g: 30, b: 30 }), declaredType: 'image/png' })
    expect(front.media.masterRef).toMatch(/^vault:private\/artworks\//)
    expect(front.media.publicUrl).toMatch(/^\/uploads\/artworks\//)
    expect(front.media.pHash).toHaveLength(16)
    await uploadMedia(scope, draft.id, 'BACK', { bytes: await png({ r: 240, g: 240, b: 230 }), declaredType: 'image/png' })

    const submitted = await submitForCertification(scope, draft.id, { userId: user.id, name: user.name })
    expect(submitted?.status).toBe('IN_CERTIFICATION')
    expect(submitted?.certificate).toMatchObject({ stage: 0, status: 'DRAFT' })
    expect((await getArtwork(scope, draft.id))?.media).toHaveLength(2)
    }, 'ARTIST')
  })

  it('refuses a non-image and another member\'s artwork', async () => {
    await asPanel(s.b.userId, async ({ scope }) => {
      await expect(uploadMedia(scope, s.b.artworkId, 'BACK', { bytes: Buffer.from('<svg/>'), declaredType: 'image/svg+xml' })).rejects.toMatchObject({ status: 415 })
      await expect(uploadMedia(scope, s.a1.artworkId, 'BACK', { bytes: await png({ r: 1, g: 1, b: 1 }), declaredType: 'image/png' })).rejects.toMatchObject({ status: 404 })
    }, 'ARTIST')
  })
})
