// The JSON routes the mobile app (apps/mobile, App Galeria nativo) reads: the
// day panel, the inventory with the listing flags, the head of "Gestão do
// anúncio" and the seller's deals. Every one answers 401 without a session,
// stays inside the scope (another gallery = 404) and never carries the mandate.
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { listArtworkForSale } from '@/lib/offers/server'
import { recordView } from '@/lib/gallery/listing-server'
import { GET as panelGet } from '@/app/api/gallery/panel/route'
import { GET as inventoryGet } from '@/app/api/gallery/inventory/route'
import { GET as dealsGet } from '@/app/api/gallery/deals/route'
import { GET as artworkGet } from '@/app/api/gallery/artworks/[id]/route'
import { createScenario, type Scenario } from './fixtures'
import { asPanel, signIn, signOut } from './session'
import { truncateTables } from './db'

const PUBLIC_ID = 'HA-2026-TEST-0021'
const artworkReq = (id: string) => artworkGet(new Request(`http://test/api/gallery/artworks/${id}`), { params: Promise.resolve({ id }) })
const NEVER = /reservePriceCents|riskAdjustedCents|closeProbability|documentHash/

let s: Scenario
beforeEach(async () => {
  process.env.FLAG_TENANT_SCOPE = '1'
  process.env.FLAG_DEALS = '1'
  s = await createScenario()
  await truncateTables(['Mandate', 'Offer', 'Deal', 'Contact', 'Notification', 'OfferRules', 'ArtworkViewDay', 'rate_limit_bucket'])
  await prisma.artwork.update({ where: { id: s.a1.artworkId }, data: { status: 'AUTHENTICATED', seal: 'GREEN', publicId: PUBLIC_ID } })
  await asPanel(s.a1.userId, async ({ scope, user }) => {
    await listArtworkForSale(scope, s.a1.artworkId, { listPriceCents: 1_000_000n, reservePriceCents: 600_000n, autoNegotiatorOn: false, autoAcceptMinBps: 10000, fixedPrice: false }, { userId: user.id })
  })
  await recordView(PUBLIC_ID)
  signOut()
})

describe('gallery mobile JSON routes', () => {
  it('refuse without a session', async () => {
    for (const h of [panelGet, inventoryGet, dealsGet]) expect((await h()).status).toBe(401)
    expect((await artworkReq(String(s.a1.artworkId))).status).toBe(401)
  }, 60_000)

  it('the day panel carries the header, the four KPIs, the actions and the most viewed works', async () => {
    await signIn(s.a1.userId, 'GALLERY')
    const res = await panelGet()
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).not.toMatch(NEVER)
    const body = JSON.parse(text) as { ok: boolean; panel: { name: string; initials: string; dateLabel: string; kpis: { key: string; value: string }[]; actions: unknown[]; top: { id: number; views7d: number; openOffers: number }[] } }
    expect(body.panel).toMatchObject({ name: 'Ana Ladeira', initials: 'AL' })
    expect(body.panel.dateLabel.length).toBeGreaterThan(5)
    expect(body.panel.kpis.map((k) => k.key)).toEqual(['sales', 'offers', 'escrow', 'views'])
    expect(body.panel.kpis.find((k) => k.key === 'views')?.value).toBe('1')
    expect(body.panel.top).toEqual([{ id: s.a1.artworkId, title: 'Obra de Ana Ladeira', coverUrl: null, views7d: 1, openOffers: 0 }])
  }, 60_000)

  it('the inventory lists the scope with the listing flags, the chip counts and the summary', async () => {
    await signIn(s.a1.userId, 'GALLERY')
    const res = await inventoryGet()
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).not.toMatch(NEVER)
    const body = JSON.parse(text) as { items: { id: number; status: string; listPriceCents: string | null; listing: { views7d: number; openOffers: number; paused: boolean } | null }[]; counts: Record<string, number>; summary: string }
    const mine = body.items.find((i) => i.id === s.a1.artworkId)
    expect(mine).toMatchObject({ status: 'LISTED', listPriceCents: '1000000', listing: { views7d: 1, openOffers: 0, paused: false } })
    expect(body.counts.listed).toBe(1)
    expect(body.summary).toMatch(/à venda$/)
    // the artist of the other tenant is not in this gallery's inventory
    expect(body.items.some((i) => i.id === s.b.artworkId)).toBe(false)

    // the advisor (a MEMBER of the gallery, not staff) sees only their own portfolio
    await signIn(s.a2.userId, 'ADVISOR')
    const other = (await (await inventoryGet()).json()) as typeof body
    expect(other.items.map((i) => i.id)).toEqual([s.a2.artworkId])
  }, 60_000)

  it('the artwork head carries the listing and the rules; another gallery gets 404', async () => {
    await signIn(s.a1.userId, 'GALLERY')
    expect((await artworkReq('0')).status).toBe(404)
    expect((await artworkReq('999999')).status).toBe(404)
    const res = await artworkReq(String(s.a1.artworkId))
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).not.toMatch(NEVER)
    const body = JSON.parse(text) as { artwork: { id: number; publicId: string; artistName: string; status: string }; listing: { listPriceCents: string; acceptsOffers: boolean; paused: boolean; stats: { views7d: number; openOffers: number } } | null; rules: { refuseBelowBps: number; responseHours: number } | null }
    expect(body.artwork).toMatchObject({ id: s.a1.artworkId, publicId: PUBLIC_ID, status: 'LISTED' })
    expect(body.listing).toMatchObject({ listPriceCents: '1000000', acceptsOffers: true, paused: false, stats: { views7d: 1, openOffers: 0 } })
    expect(body.rules).toMatchObject({ refuseBelowBps: 7000, responseHours: 48 })

    // not listed: the head comes, the listing is null
    const unlisted = (await (await artworkReq(String(s.a2.artworkId))).json()) as typeof body
    expect(unlisted.listing).toBeNull()

    await signIn(s.b.userId, 'ARTIST')
    expect((await artworkReq(String(s.a1.artworkId))).status).toBe(404)
  }, 60_000)

  it('the deals answer the seller (empty here) and hide behind the flag', async () => {
    await signIn(s.a1.userId, 'GALLERY')
    expect(await (await dealsGet()).json()).toEqual({ ok: true, deals: [] })
    process.env.FLAG_DEALS = '0'
    expect((await dealsGet()).status).toBe(404)
  }, 60_000)
})
