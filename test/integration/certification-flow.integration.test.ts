// Certification end to end: kit order → staff ships from a batch → the app
// links the tag with a valid SUN message (mock vendor) → publicId → sign →
// issue (version 1, PDF, hash, GREEN seal) → public verification → a
// contestation goes to the admin queue → the decision revokes.
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { uploadMedia } from '@/lib/artworks/media-server'
import { submitForCertification } from '@/lib/artworks/server'
import { createBatch, linkMarker, recordPublicRead, requestMarkers, shipOrder } from '@/lib/physical-markers/server'
import { mockSunMessage } from '@/lib/physical-markers/sun-core'
import { anchorDay, certificationView, contestCertificate, issueCertificate, publicCertificate, signCertificate } from '@/lib/certificates/server'
import { decideReviewItem, reviewQueue } from '@/lib/admin-review/server'
import { readVaultFile } from '@/lib/storage/private-vault'
import { createScenario, type Scenario } from './fixtures'
import { truncateTables } from './db'
import { asPanel } from './session'

const cwd = process.cwd()
let dir = ''
let s: Scenario
beforeAll(() => { dir = mkdtempSync(path.join(os.tmpdir(), 'ha-cert-')); process.chdir(dir); delete process.env.VERCEL; delete process.env.BLOB_READ_WRITE_TOKEN; delete process.env.BLOB_PRIVATE_READ_WRITE_TOKEN; process.env.MARKER_VENDOR = 'mock' })
afterAll(() => { process.chdir(cwd); rmSync(dir, { recursive: true, force: true }) })
beforeEach(async () => { s = await createScenario(); await truncateTables(['MarkerBatch', 'MarkerOrder', 'ReviewQueueItem', 'DailyAnchor']) })

const png = (c: { r: number; g: number; b: number }) => sharp({ create: { width: 200, height: 160, channels: 3, background: c } }).png().toBuffer()

describe('certification flow', () => {
  it('order → ship → link → sign → issue → verify → contest → decide', async () => {
    const staff = { userId: s.staff.userId, name: 'Equipe' }
    // the artist submits her artwork
    await asPanel(s.b.userId, async ({ scope, user }) => {
      await uploadMedia(scope, s.b.artworkId, 'FRONT_COLOR_CARD', { bytes: await png({ r: 10, g: 120, b: 200 }), declaredType: 'image/png' })
      await uploadMedia(scope, s.b.artworkId, 'BACK', { bytes: await png({ r: 240, g: 240, b: 230 }), declaredType: 'image/png' })
      await prisma.artwork.update({ where: { id: s.b.artworkId }, data: { technique: 'Óleo sobre linho' } })
      await submitForCertification(scope, s.b.artworkId, { userId: user.id, name: user.name })
      const order = await requestMarkers(scope, 2)
      expect(order.status).toBe('REQUESTED')
      expect((await certificationView(scope)).items[0]).toMatchObject({ stage: 1, action: 'WAIT_MARKER' })
    }, 'ARTIST')

    // staff creates a batch and ships the order
    const batch = await createBatch({ code: '2026-10', quantity: 5, destination: 'Envios avulsos · artistas' }, staff)
    const order = await prisma.markerOrder.findFirstOrThrow()
    await shipOrder(order.id, batch.id, staff)
    const shipped = await prisma.physicalMarker.findMany({ where: { orderId: order.id } })
    expect(shipped).toHaveLength(2)
    expect((await prisma.markerBatch.findUniqueOrThrow({ where: { id: batch.id } })).status).toBe('IN_USE')

    // the app taps the tag
    let publicId = ''
    await asPanel(s.b.userId, async ({ scope, user }) => {
      expect((await certificationView(scope)).items[0]).toMatchObject({ stage: 2, action: 'LINK_IN_APP' })
      const bad = mockSunMessage(shipped[0].uid, 3)
      await expect(linkMarker(scope, { ...bad, cmac: 'FFFFFFFFFFFFFFFF', artworkId: s.b.artworkId }, { userId: user.id })).rejects.toMatchObject({ code: 'BAD_READ' })
      const good = mockSunMessage(shipped[0].uid, 4)
      const r = await linkMarker(scope, { ...good, artworkId: s.b.artworkId }, { userId: user.id })
      expect(r.publicId).toMatch(/^HA-\d{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/)
      publicId = r.publicId
      // the other member cannot use her kit's tag
      await expect(linkMarker(scope, { ...mockSunMessage(shipped[1].uid, 1), artworkId: s.a1.artworkId }, { userId: user.id })).rejects.toMatchObject({ status: 404 })
      const view = await certificationView(scope)
      expect(view.items[0]).toMatchObject({ stage: 3, action: 'SIGN', publicId })
      const certId = view.items[0].certificateId!
      await expect(issueCertificate(scope, certId, { userId: user.id, name: user.name })).rejects.toMatchObject({ code: 'NOT_SIGNED' })
      const signed = await signCertificate(scope, certId, { userId: user.id, name: user.name, ip: '1.2.3.4' })
      expect(signed.contentHash).toHaveLength(64)
      await expect(signCertificate(scope, certId, { userId: user.id, name: user.name })).rejects.toMatchObject({ code: 'ALREADY_SIGNED' })
      const issued = await issueCertificate(scope, certId, { userId: user.id, name: user.name })
      expect(issued.contentHash).toBe(signed.contentHash)
      expect((await certificationView(scope)).items[0]).toMatchObject({ stage: 5, action: 'VIEW' })
      const a = await prisma.artwork.findUniqueOrThrow({ where: { id: s.b.artworkId } })
      expect(a).toMatchObject({ status: 'AUTHENTICATED', seal: 'GREEN', publicId })
      const v = await prisma.certificateVersion.findFirstOrThrow({ where: { certificateId: certId } })
      expect(v.pdfRef).toMatch(/^vault:private\/certificates\//)
      const pdf = await readVaultFile(v.pdfRef!)
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    }, 'ARTIST')

    // public verification (no session, total scope inside)
    const pub = await publicCertificate(publicId)
    expect(pub).toMatchObject({ status: 'ACTIVE', artist: 'Joana Teixeira', holder: 'Joana Teixeira · desde 2026', version: 1, chainValid: true })
    expect(pub!.events.map((e) => e.kind)).toEqual(['CREATED', 'CERTIFIED'])
    const read = await recordPublicRead(publicId, { ...mockSunMessage(shipped[0].uid, 9) }, null)
    expect(read).toEqual({ authenticated: true, tamper: false, reason: undefined })
    expect((await recordPublicRead(publicId, { ...mockSunMessage(shipped[0].uid, 9) }, null)).authenticated).toBe(false) // replay

    // anchor
    const anchor = await anchorDay('2099-01-01')
    expect(anchor.eventCount).toBe(2)
    expect(anchor.merkleRoot).toHaveLength(64)

    // contestation → queue → approve → revoked + disputed
    expect(await contestCertificate(publicId, 'Herdeiro alega titularidade anterior')).toBe(true)
    const q = await reviewQueue()
    expect(q.items.map((i) => i.kind)).toEqual(['CONTESTATION'])
    expect((await publicCertificate(publicId))?.status).toBe('CONTESTED')
    await decideReviewItem(q.items[0].id, 'APPROVED', staff)
    const after = await publicCertificate(publicId)
    expect(after).toMatchObject({ status: 'REVOKED', artworkStatus: 'DISPUTED' })
    expect(after!.events.map((e) => e.kind)).toEqual(['CREATED', 'CERTIFIED', 'DISPUTED'])
  }, 60_000)

  it('a tamper read opens MARKER_REMOVED and the approval revokes the marker', async () => {
    const staff = { userId: s.staff.userId, name: 'Equipe' }
    const batch = await createBatch({ code: '2026-11', quantity: 1, destination: 'x' }, staff)
    await asPanel(s.b.userId, async ({ scope, user }) => {
      await uploadMedia(scope, s.b.artworkId, 'FRONT_COLOR_CARD', { bytes: await png({ r: 1, g: 2, b: 3 }), declaredType: 'image/png' })
      await uploadMedia(scope, s.b.artworkId, 'BACK', { bytes: await png({ r: 3, g: 2, b: 1 }), declaredType: 'image/png' })
      await prisma.artwork.update({ where: { id: s.b.artworkId }, data: { technique: 'x' } })
      await submitForCertification(scope, s.b.artworkId, { userId: user.id, name: user.name })
      await requestMarkers(scope, 1)
    }, 'ARTIST')
    const order = await prisma.markerOrder.findFirstOrThrow()
    await shipOrder(order.id, batch.id, staff)
    const marker = await prisma.physicalMarker.findFirstOrThrow({ where: { orderId: order.id } })
    const publicId = await asPanel(s.b.userId, async ({ scope, user }) => (await linkMarker(scope, { ...mockSunMessage(marker.uid, 1), artworkId: s.b.artworkId }, { userId: user.id })).publicId, 'ARTIST')
    const read = await recordPublicRead(publicId, { ...mockSunMessage(marker.uid, 2), tt: true }, 'h')
    expect(read.tamper).toBe(true)
    const q = await reviewQueue()
    expect(q.items[0]).toMatchObject({ kind: 'MARKER_REMOVED' })
    await decideReviewItem(q.items[0].id, 'APPROVED', staff)
    expect((await prisma.physicalMarker.findUniqueOrThrow({ where: { id: marker.id } })).status).toBe('REVOKED')
    expect((await prisma.artwork.findUniqueOrThrow({ where: { id: s.b.artworkId } })).publicId).toBeNull()
  }, 60_000)
})
