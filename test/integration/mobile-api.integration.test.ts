// The JSON routes the mobile app (apps/mobile, App Colecionador fase 1) reads:
// Explorar, Favoritos, Minha coleção and the public artwork by publicId.
import { beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { listArtworkForSale } from '@/lib/offers/server'
import { toggleReaction } from '@/lib/community/server'
import { GET as exploreGet } from '@/app/api/collector/explore/route'
import { GET as favoritesGet } from '@/app/api/collector/favorites/route'
import { GET as walletGet } from '@/app/api/collector/wallet/route'
import { GET as artworkGet } from '@/app/api/public/artworks/[publicId]/route'
import { createScenario, type Scenario } from './fixtures'
import { asPanel, signIn, signOut } from './session'
import { truncateTables } from './db'

const PUBLIC_ID = 'HA-2026-TEST-0009'
const artworkReq = (id: string) => artworkGet(new Request(`http://test/api/public/artworks/${id}`), { params: Promise.resolve({ publicId: id }) })

let s: Scenario
let buyerId: number
beforeEach(async () => {
  process.env.FLAG_TENANT_SCOPE = '1'
  s = await createScenario()
  await truncateTables(['Mandate', 'Offer', 'Deal', 'Contact', 'Notification', 'Conversation', 'Reaction', 'rate_limit_bucket'])
  await prisma.artwork.update({ where: { id: s.a1.artworkId }, data: { status: 'AUTHENTICATED', seal: 'GREEN', publicId: PUBLIC_ID, technique: 'Óleo sobre tela', heightMm: 1000, widthMm: 800 } })
  await asPanel(s.a1.userId, async ({ scope, user }) => {
    await listArtworkForSale(scope, s.a1.artworkId, { listPriceCents: 1_000_000n, reservePriceCents: 600_000n, autoNegotiatorOn: false, autoAcceptMinBps: 10000, fixedPrice: false }, { userId: user.id })
  })
  buyerId = (await prisma.user.create({ data: { email: 'lia@col.test', name: 'Lia Souza', profile: 'collector', active: true, emailVerifiedAt: new Date() } })).id
  signOut()
})

describe('mobile JSON routes', () => {
  it('explore, favorites and wallet answer the signed collector and refuse without session', async () => {
    for (const h of [exploreGet, favoritesGet, walletGet]) expect((await h()).status).toBe(401)
    await signIn(buyerId, 'COLLECTOR')

    const explore = (await (await exploreGet()).json()) as { items: { id: number; publicId: string; liked: boolean; saved: boolean; seller: string; sellerKind: string; technique: string | null; priceCents: string | null }[] }
    expect(explore.items).toMatchObject([{ publicId: PUBLIC_ID, liked: false, saved: false, seller: 'Ana Ladeira', sellerKind: 'GALLERY', technique: 'Óleo sobre tela', priceCents: '1000000' }])
    expect(JSON.stringify(explore)).not.toMatch(/reservePriceCents/)

    await toggleReaction(buyerId, 'ARTWORK', s.a1.artworkId, 'SAVE')
    expect(((await (await exploreGet()).json()) as typeof explore).items[0]).toMatchObject({ saved: true, liked: false })
    const favs = (await (await favoritesGet()).json()) as { items: { publicId: string; saved: boolean; liked: boolean; priceCents: string | null; status: string }[] }
    expect(favs.items).toMatchObject([{ publicId: PUBLIC_ID, saved: true, liked: false, priceCents: '1000000', status: 'LISTED' }])

    const wallet = (await (await walletGet()).json()) as { items: unknown[]; totalCents: string; holderName: string }
    expect(wallet).toEqual({ items: [], totalCents: '0', holderName: 'Lia Souza' })
  }, 60_000)

  it('the public artwork by publicId carries the page projection, the viewer flags and never the floor', async () => {
    expect((await artworkReq('nope')).status).toBe(404)
    expect((await artworkReq('HA-2026-TEST-0000')).status).toBe(404)
    const anon = await artworkReq(PUBLIC_ID.toLowerCase())
    expect(anon.status).toBe(200)
    const body = await anon.text()
    expect(body).not.toMatch(/reservePriceCents|documentHash|holderDocument/)
    const a = JSON.parse(body) as { id: number; publicId: string; status: string; priceCents: string | null; acceptsOffers: boolean; liked: boolean; saved: boolean; seller: { name: string; kind: string }; events: unknown[] }
    expect(a).toMatchObject({ id: s.a1.artworkId, publicId: PUBLIC_ID, status: 'LISTED', priceCents: '1000000', acceptsOffers: true, liked: false, saved: false, seller: { name: 'Ana Ladeira', kind: 'GALLERY' } })

    await signIn(buyerId, 'COLLECTOR')
    await toggleReaction(buyerId, 'ARTWORK', s.a1.artworkId, 'LIKE')
    expect((await (await artworkReq(PUBLIC_ID)).json()) as object).toMatchObject({ liked: true, saved: false })
  }, 60_000)
})
