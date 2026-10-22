// The JSON routes the mobile app (apps/mobile, App Artista nativo) reads: the
// artist's home, the certificates ("Carteira de escrituras") and the head of
// "Vincular etiqueta". Every one answers 401 without a session, stays inside
// the scope (another member's work = 404) and never carries a hash, a
// signature or the mandate.
import { mkdtempSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { uploadMedia } from '@/lib/artworks/media-server'
import { submitForCertification } from '@/lib/artworks/server'
import { createBatch, linkMarker, requestMarkers, shipOrder } from '@/lib/physical-markers/server'
import { mockSunMessage } from '@/lib/physical-markers/sun-core'
import { certificationView, issueCertificate, signCertificate } from '@/lib/certificates/server'
import { GET as homeGet } from '@/app/api/artist/home/route'
import { GET as certificatesGet } from '@/app/api/artist/certificates/route'
import { GET as linkGet } from '@/app/api/artist/artworks/[id]/link/route'
import { GET as inventoryGet } from '@/app/api/gallery/inventory/route'
import { createScenario, type Scenario } from './fixtures'
import { truncateTables } from './db'
import { asPanel, signIn, signOut } from './session'

const NEVER = /reservePriceCents|riskAdjustedCents|closeProbability|documentHash|contentHash|signatureJson|masterRef|pdfRef/
const linkReq = (id: string) => linkGet(new Request(`http://test/api/artist/artworks/${id}/link`), { params: Promise.resolve({ id }) })
const png = (c: { r: number; g: number; b: number }) => sharp({ create: { width: 200, height: 160, channels: 3, background: c } }).png().toBuffer()

const cwd = process.cwd()
let dir = ''
let s: Scenario
beforeAll(() => { dir = mkdtempSync(path.join(os.tmpdir(), 'ha-artist-')); process.chdir(dir); delete process.env.VERCEL; delete process.env.BLOB_READ_WRITE_TOKEN; delete process.env.BLOB_PRIVATE_READ_WRITE_TOKEN; process.env.MARKER_VENDOR = 'mock' })
afterAll(() => { process.chdir(cwd); rmSync(dir, { recursive: true, force: true }) })
beforeEach(async () => {
  process.env.FLAG_TENANT_SCOPE = '1'
  process.env.FLAG_CERTIFICATES = '1'
  process.env.FLAG_PHYSICAL_MARKERS = '1'
  s = await createScenario()
  await truncateTables(['MarkerBatch', 'MarkerOrder', 'ReviewQueueItem', 'DailyAnchor', 'Notification'])
  signOut()
})

/** The artist submits her work, staff ships a kit, the tag is linked. Returns the certificate id. */
async function linkedArtwork(): Promise<number> {
  await asPanel(s.b.userId, async ({ scope, user }) => {
    await uploadMedia(scope, s.b.artworkId, 'FRONT_COLOR_CARD', { bytes: await png({ r: 10, g: 120, b: 200 }), declaredType: 'image/png' })
    await uploadMedia(scope, s.b.artworkId, 'BACK', { bytes: await png({ r: 240, g: 240, b: 230 }), declaredType: 'image/png' })
    await prisma.artwork.update({ where: { id: s.b.artworkId }, data: { technique: 'Óleo sobre linho', year: 2026 } })
    await submitForCertification(scope, s.b.artworkId, { userId: user.id, name: user.name })
    await requestMarkers(scope, 1)
  }, 'ARTIST')
  const staff = { userId: s.staff.userId, name: 'Equipe' }
  const batch = await createBatch({ code: '2026-10', quantity: 2, destination: 'Envios avulsos · artistas' }, staff)
  const order = await prisma.markerOrder.findFirstOrThrow()
  await shipOrder(order.id, batch.id, staff)
  const marker = await prisma.physicalMarker.findFirstOrThrow({ where: { orderId: order.id } })
  return asPanel(s.b.userId, async ({ scope, user }) => {
    await linkMarker(scope, { ...mockSunMessage(marker.uid, 2), artworkId: s.b.artworkId }, { userId: user.id })
    return (await certificationView(scope)).items[0].certificateId!
  }, 'ARTIST')
}

describe('artist mobile JSON routes', () => {
  it('refuse without a session', async () => {
    expect((await homeGet()).status).toBe(401)
    expect((await certificatesGet()).status).toBe(401)
    expect((await linkReq(String(s.b.artworkId))).status).toBe(401)
  }, 60_000)

  it('the home carries the header, the four KPIs, the actions and only her works', async () => {
    await signIn(s.b.userId, 'ARTIST')
    const res = await homeGet()
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).not.toMatch(NEVER)
    const body = JSON.parse(text) as { home: { name: string; initials: string; dateLabel: string; kpis: { label: string; value: string }[]; actions: unknown[]; recent: { id: number; status: string }[] } }
    expect(body.home).toMatchObject({ name: 'Joana Teixeira', initials: 'JT' })
    expect(body.home.kpis.map((k) => k.label)).toEqual(['Obras certificadas', 'À venda', expect.stringMatching(/^Vendidas em \d{4}$/), 'Direito de sequência'])
    expect(body.home.recent.map((r) => r.id)).toEqual([s.b.artworkId])

    // "Obras" of the app reuses the gallery inventory route: scoped to her works only
    const inv = (await (await inventoryGet()).json()) as { items: { id: number }[] }
    expect(inv.items.map((i) => i.id)).toEqual([s.b.artworkId])
  }, 60_000)

  it('the link head: the work, the certificate, the simulated tap; another member gets 404', async () => {
    await signIn(s.b.userId, 'ARTIST')
    expect((await linkReq('0')).status).toBe(404)
    expect((await linkReq(String(s.a1.artworkId))).status).toBe(404)
    const before = (await (await linkReq(String(s.b.artworkId))).json()) as { artwork: { status: string; publicId: string | null }; certificateId: number | null; signed: boolean; simulateAllowed: boolean }
    expect(before).toMatchObject({ artwork: { status: 'DRAFT', publicId: null }, certificateId: null, signed: false, simulateAllowed: true })

    const certId = await linkedArtwork()
    await signIn(s.b.userId, 'ARTIST')
    const res = await linkReq(String(s.b.artworkId))
    const text = await res.text()
    expect(text).not.toMatch(NEVER)
    expect(JSON.parse(text)).toMatchObject({ artwork: { id: s.b.artworkId, title: 'Obra de Joana Teixeira, 2026', status: 'IN_CERTIFICATION', publicId: expect.stringMatching(/^HA-/) }, certificateId: certId, signed: false, issued: false })

    // the gallery cannot read the artist's work
    await signIn(s.a1.userId, 'GALLERY')
    expect((await linkReq(String(s.b.artworkId))).status).toBe(404)
  }, 60_000)

  it('the certificates list the stage, the action and the version once issued — never the hash', async () => {
    const certId = await linkedArtwork()
    await signIn(s.b.userId, 'ARTIST')
    let body = (await (await certificatesGet()).json()) as { items: { artworkId: number; certificateId: number; stage: number; stageLabel: string; action: string; version: number | null }[] }
    expect(body.items).toEqual([expect.objectContaining({ artworkId: s.b.artworkId, certificateId: certId, stage: 3, stageLabel: 'Etiqueta vinculada', action: 'SIGN', version: null })])

    await asPanel(s.b.userId, async ({ scope, user }) => {
      await signCertificate(scope, certId, { userId: user.id, name: user.name })
      await issueCertificate(scope, certId, { userId: user.id, name: user.name })
    }, 'ARTIST')
    await signIn(s.b.userId, 'ARTIST')
    const res = await certificatesGet()
    const text = await res.text()
    expect(text).not.toMatch(NEVER)
    body = JSON.parse(text) as typeof body
    expect(body.items[0]).toMatchObject({ stage: 5, stageLabel: 'Emitido', action: 'VIEW', version: 1 })

    // another member's list does not carry her work
    await signIn(s.a1.userId, 'GALLERY')
    const other = (await (await certificatesGet()).json()) as typeof body
    expect(other.items.some((i) => i.artworkId === s.b.artworkId)).toBe(false)

    process.env.FLAG_CERTIFICATES = '0'
    expect((await certificatesGet()).status).toBe(404)
  }, 90_000)
})
