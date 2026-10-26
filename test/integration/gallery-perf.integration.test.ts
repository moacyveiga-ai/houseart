// Query count of the inventory/panel/certificates routes (review finding,
// 2026-10-23): they used to call `listingOf`/`certificateOfArtwork` once per
// artwork (~5 queries each), so a gallery with 200 works passed 1,000 queries
// per request. Here the count is MEASURED — a test client with Prisma's query
// log replaces the lazy singleton of lib/prisma.ts (it reads the global on
// every call) — and must not grow with the size of the inventory. The batch
// readers must also answer exactly what the unit readers answer, and never a
// work of another tenant.
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/app/generated/prisma/client'
import { scopeExtension } from '@/lib/scope/extension'
import { prisma } from '@/lib/prisma'
import { listingOf, listingsOf } from '@/lib/gallery/listing-server'
import { certificateOfArtwork, currentCertificateVersionsOf } from '@/lib/certificates/server'
import { dayPanel } from '@/lib/gallery/panel-server'
import { GET as panelGet } from '@/app/api/gallery/panel/route'
import { GET as inventoryGet } from '@/app/api/gallery/inventory/route'
import { GET as certificatesGet } from '@/app/api/artist/certificates/route'
import { createScenario, type Scenario } from './fixtures'
import { asPanel, signIn, signOut } from './session'
import { truncateTables } from './db'

// ── the counting client (test only; lib/prisma.ts is untouched) ──────────
type Global = { prisma?: unknown }
const g = globalThis as unknown as Global
const previous = g.prisma
let queries = 0
const base = new PrismaClient({ adapter: new PrismaPg({ connectionString: (process.env.DATABASE_URL ?? '').trim() }), log: [{ emit: 'event', level: 'query' }] })
base.$on('query', () => { queries += 1 })
g.prisma = base.$extends(scopeExtension)
afterAll(async () => { g.prisma = previous; await base.$disconnect() })

async function counted<T>(fn: () => Promise<T>): Promise<{ result: T; queries: number }> {
  const before = queries
  const result = await fn()
  return { result, queries: queries - before }
}

const day = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10)
let seq = 0

/** `n` LISTED works with an ACTIVE mandate, views and open offers for `memberId`. */
async function listedWorks(memberId: number, artistId: number, n: number, tag: string): Promise<number[]> {
  const rows = await prisma.artwork.createManyAndReturn({
    data: Array.from({ length: n }, (_, i) => ({ memberId, artistId, title: `${tag} ${i}`, status: 'LISTED', seal: 'GREEN', sealIssuedAt: new Date(), publicId: `HA-PERF-${tag}-${i}-${++seq}`, saleMode: 'FIXED_WITH_OFFERS', listPriceCents: BigInt(100_000 + i), listingPausedAt: i % 7 === 3 ? new Date() : null })),
    select: { id: true },
  })
  const ids = rows.map((r) => r.id)
  await prisma.mandate.createMany({ data: ids.map((artworkId, i) => ({ artworkId, memberId, listPriceCents: BigInt(100_000 + i), reservePriceCents: 50_000n, fixedPrice: i % 5 === 0, autoNegotiatorOn: i % 2 === 0, autoAcceptMinBps: 9000 + i })) })
  // a superseded version must not count as the listing
  await prisma.mandate.createMany({ data: ids.slice(0, 3).map((artworkId) => ({ artworkId, memberId, listPriceCents: 1n, reservePriceCents: 1n, status: 'SUPERSEDED' })) })
  await prisma.artworkViewDay.createMany({ data: ids.flatMap((artworkId, i) => [{ artworkId, day: day(1), count: i % 4 }, { artworkId, day: day(10), count: 2 }, { artworkId, day: day(40), count: 9 }].filter((v) => v.count > 0)) })
  await prisma.offer.createMany({
    data: ids.flatMap((artworkId, i) => (['RECEIVED', 'NEGOTIATING', 'REFUSED'] as const).slice(0, i % 4).map((status, k) => ({ code: `OFR-PERF-${artworkId}-${k}`, artworkId, sellerMemberId: memberId, memberId, buyerName: 'Comprador', buyerEmail: 'c@test.dev', offeredCents: 90_000n, status, expiresAt: new Date(Date.now() + 86_400_000) }))),
  })
  return ids
}

/** `n` AUTHENTICATED works with an issued certificate (stage 5) and 1–2 versions. */
async function certifiedWorks(memberId: number, artistId: number, n: number, tag: string): Promise<number[]> {
  const now = new Date()
  const rows = await prisma.artwork.createManyAndReturn({
    data: Array.from({ length: n }, (_, i) => ({ memberId, artistId, title: `${tag} ${i}`, status: 'AUTHENTICATED', seal: 'GREEN', publicId: `HA-CERT-${tag}-${i}-${++seq}`, submittedAt: new Date(now.getTime() - i * 1000) })),
    select: { id: true },
  })
  const ids = rows.map((r) => r.id)
  const certs = await prisma.certificate.createManyAndReturn({ data: ids.map((artworkId, i) => ({ artworkId, publicId: `CERT-${artworkId}`, status: 'ACTIVE', stage: 5, signedAt: now, issuedAt: now, ...(i % 6 === 5 ? { stage: 4, issuedAt: null } : {}) })), select: { id: true } })
  await prisma.certificateVersion.createMany({ data: certs.flatMap((c, i) => Array.from({ length: 1 + (i % 2) }, (_, v) => ({ certificateId: c.id, version: v + 1, holderName: 'Titular', contentJson: '{}', contentHash: `h${c.id}-${v}` }))) })
  return ids
}

let s: Scenario
beforeEach(async () => {
  process.env.FLAG_TENANT_SCOPE = '1'
  process.env.FLAG_DEALS = '1'
  process.env.FLAG_CERTIFICATES = '1'
  s = await createScenario()
  await truncateTables(['Mandate', 'Offer', 'Deal', 'Contact', 'Notification', 'OfferRules', 'ArtworkViewDay', 'Certificate', 'rate_limit_bucket'])
  signOut()
})

async function artistOf(artworkId: number) { return (await prisma.artwork.findUniqueOrThrow({ where: { id: artworkId }, select: { artistId: true } })).artistId }

interface Measure { inventory: number; panel: number; certificates: number; dayPanel: number }

async function measure(n: number): Promise<Measure> {
  const galleryArtist = await artistOf(s.a1.artworkId)
  const bArtist = await artistOf(s.b.artworkId)
  const mine = await listedWorks(s.a1.memberId, galleryArtist, n, 'G')
  const theirs = await listedWorks(s.b.memberId, bArtist, 3, 'B') // another tenant: never in the gallery
  const myCerts = await certifiedWorks(s.b.memberId, bArtist, n, 'C')
  const otherCerts = await certifiedWorks(s.a1.memberId, galleryArtist, 3, 'D') // the gallery's: never the artist's

  // ── gallery: inventory and panel
  await signIn(s.a1.userId, 'GALLERY')
  const inv = await counted(() => inventoryGet())
  expect(inv.result.status).toBe(200)
  const invBody = (await inv.result.json()) as { items: { id: number; listing: { views7d: number; openOffers: number; paused: boolean } | null }[] }
  const panel = await counted(() => panelGet())
  expect(panel.result.status).toBe(200)
  const panelBody = (await panel.result.json()) as { panel: { top: { id: number; views7d: number; openOffers: number }[]; kpis: { key: string; value: string }[] } }

  expect(invBody.items.filter((i) => mine.includes(i.id))).toHaveLength(n)
  for (const id of theirs) expect(invBody.items.some((i) => i.id === id)).toBe(false)
  expect(panelBody.panel.top.every((t) => !theirs.includes(t.id))).toBe(true)

  const dp = await asPanel(s.a1.userId, async ({ scope }) => {
    // batch ≡ unit, artwork by artwork (and the other tenant stays out of the batch)
    const batch = await listingsOf(scope, [...mine, ...theirs])
    for (const id of theirs) expect(batch.has(id)).toBe(false)
    for (const id of mine) expect(batch.get(id)).toEqual(await listingOf(scope, id))
    for (const id of theirs) await expect(listingOf(scope, id)).rejects.toThrow()
    for (const item of invBody.items.filter((i) => mine.includes(i.id))) {
      const l = batch.get(item.id)!
      expect(item.listing).toEqual({ views7d: l.stats.views7d, openOffers: l.stats.openOffers, paused: l.paused, saves: l.stats.saves })
    }
    const views = [...batch.values()].reduce((a, l) => a + l.stats.views7d, 0)
    const c = await counted(() => dayPanel(scope))
    expect(c.result.kpis.find((k) => k.key === 'views')?.value).toBe(views.toLocaleString('pt-BR'))
    return c.queries
  }, 'GALLERY')

  // ── artist: certificates
  await signIn(s.b.userId, 'ARTIST')
  const certs = await counted(() => certificatesGet())
  expect(certs.result.status).toBe(200)
  const certBody = (await certs.result.json()) as { items: { artworkId: number; stage: number; version: number | null }[] }
  for (const id of otherCerts) expect(certBody.items.some((i) => i.artworkId === id)).toBe(false)
  await asPanel(s.b.userId, async ({ scope }) => {
    const batch = await currentCertificateVersionsOf(scope, [...myCerts, ...otherCerts])
    for (const id of otherCerts) expect(batch.has(id)).toBe(false)
    for (const item of certBody.items.filter((i) => myCerts.includes(i.artworkId))) {
      const unit = item.stage >= 5 ? ((await certificateOfArtwork(scope, item.artworkId))?.versions[0]?.version ?? null) : null
      expect(item.version).toBe(unit)
      if (item.stage >= 5) expect(batch.get(item.artworkId)).toBe(unit)
    }
  }, 'ARTIST')
  signOut()
  return { inventory: inv.queries, panel: panel.queries, certificates: certs.queries, dayPanel: dp }
}

describe('gallery and artist lists: queries per request do not grow with the inventory', () => {
  it('N = 5 and N = 60 cost the same number of queries', async () => {
    const small = await measure(5)
    s = await createScenario()
    await truncateTables(['Mandate', 'Offer', 'ArtworkViewDay', 'Certificate'])
    const large = await measure(60)
    console.log('[gallery-perf] queries per request', JSON.stringify({ n5: small, n60: large }))
    expect(large).toEqual(small)
  }, 120_000)
})
