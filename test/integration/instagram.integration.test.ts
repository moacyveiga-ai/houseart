// Instagram: a community post goes to the person's own account (mock and live with a stubbed Graph API),
// the short link counts visits, the cron reads the reach, and the token never reaches a view.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { encryptText } from '@/lib/crypto/cipher'
import { awaitDetached } from '@/lib/after'
import { createPost } from '@/lib/community/server'
import { composerInstagram, disconnect, followLink, instagramView, requestPublication, runInstagramCron } from '@/lib/instagram/server'
import { createScenario, type Scenario } from './fixtures'
import { truncateTables } from './db'

let s: Scenario
const env = { ...process.env }

async function authenticated(artworkId: number) {
  await prisma.artwork.update({ where: { id: artworkId }, data: { status: 'AUTHENTICATED', publicId: `HA-T${artworkId}`, seal: 'GREEN' } })
  await prisma.artworkMedia.create({ data: { artworkId, kind: 'FRONT_COLOR_CARD', masterRef: 'm', publicUrl: '/api/public/media/content/x.jpg', sha256: 'x', width: 10, height: 10 } })
}
const connect = (userId: number, mode: 'MOCK' | 'LIVE', handle: string) =>
  prisma.instagramConnection.create({ data: { userId, mode, igUserId: `ig${userId}`, handle, tokenEnc: encryptText('tok-secret'), tokenExpiresAt: new Date(Date.now() + 5 * 86_400_000) } })

beforeEach(async () => {
  s = await createScenario()
  await truncateTables(['Post', 'ArtworkMedia', 'InstagramConnection', 'InstagramPublication'])
})
afterEach(() => { process.env = { ...env }; vi.unstubAllGlobals() })

describe('instagram', () => {
  it('mock: posts an artwork post, counts the link and never shows the token', async () => {
    process.env.INSTAGRAM_MOCK = '1'
    delete process.env.INSTAGRAM_APP_ID
    await authenticated(s.b.artworkId)
    expect((await composerInstagram(s.b.userId)).handle).toBeNull()
    await connect(s.b.userId, 'MOCK', '@joana')
    expect(await composerInstagram(s.b.userId)).toMatchObject({ mode: 'MOCK', handle: '@joana' })

    const post = await createPost(s.b.userId, { kind: 'TEXT', body: 'Obra nova', artworkId: s.b.artworkId })
    const r = await requestPublication(s.b.userId, post.id, 'BOTH')
    expect(r).toHaveProperty('id')
    await awaitDetached()
    const pub = await prisma.instagramPublication.findUniqueOrThrow({ where: { postId: post.id } })
    expect(pub).toMatchObject({ status: 'PUBLISHED', format: 'BOTH', feedMediaId: `mock_feed_${pub.id}`, storyMediaId: `mock_story_${pub.id}`, targetPath: `/e/artwork/HA-T${s.b.artworkId}` })

    expect(await followLink(pub.code)).toBe(`/e/artwork/HA-T${s.b.artworkId}`)
    expect(await followLink('nope!')).toBeNull()
    const view = await instagramView(s.b.userId)
    expect(view.publications[0]).toMatchObject({ status: 'PUBLISHED', stats: '0 alcançados · 1 visita pelo link' })
    expect(JSON.stringify(view)).not.toContain('tok-secret')
    expect(JSON.stringify(view)).not.toContain('tokenEnc')

    await disconnect(s.b.userId)
    expect((await instagramView(s.b.userId)).connection).toBeNull()
  }, 60_000)

  it('refuses a post without image, someone else\'s post, and a mock connection in a live app', async () => {
    process.env.INSTAGRAM_MOCK = '1'
    await connect(s.b.userId, 'MOCK', '@joana')
    const text = await createPost(s.b.userId, { kind: 'TEXT', body: 'Só texto' })
    expect(await requestPublication(s.b.userId, text.id, 'FEED')).toMatchObject({ error: expect.stringMatching(/imagem/) })
    expect(await requestPublication(s.a1.userId, text.id, 'FEED')).toMatchObject({ error: expect.stringMatching(/Conecte/) })
    await connect(s.a1.userId, 'MOCK', '@ladeira')
    expect(await requestPublication(s.a1.userId, text.id, 'FEED')).toMatchObject({ error: 'Post não encontrado.' })
    process.env.INSTAGRAM_APP_ID = 'app'; process.env.INSTAGRAM_APP_SECRET = 'sec'
    expect(await requestPublication(s.b.userId, text.id, 'FEED')).toMatchObject({ error: expect.stringMatching(/Conecte/) })
    expect(await prisma.instagramPublication.count()).toBe(0)
  }, 60_000)

  it('live: container → publish with the caption (artist tagged), then the cron reads the reach', async () => {
    process.env.INSTAGRAM_APP_ID = 'app'; process.env.INSTAGRAM_APP_SECRET = 'sec'; process.env.APP_URL = 'https://art.test'
    await authenticated(s.a1.artworkId)
    // the artist of the gallery's artwork has no member; tag comes only from a connected artist — none here
    await connect(s.a1.userId, 'LIVE', '@ladeira')
    const calls: { url: string; body: string }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body ? String(init.body) : ''
      calls.push({ url, body })
      const json = (o: unknown) => new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } })
      if (url.includes('/media_publish')) return json({ id: 'media_1' })
      if (url.endsWith('/media')) return json({ id: 'container_1' })
      if (url.includes('status_code')) return json({ status_code: 'FINISHED' })
      if (url.includes('/insights')) return json({ data: [{ values: [{ value: 321 }] }] })
      if (url.includes('refresh_access_token')) return json({ access_token: 'tok-new', expires_in: 5_184_000 })
      return new Response('{}', { status: 404 })
    }))
    const post = await createPost(s.a1.userId, { kind: 'TEXT', body: 'Abertura sábado', artworkId: s.a1.artworkId })
    await requestPublication(s.a1.userId, post.id, 'FEED')
    await awaitDetached()
    const pub = await prisma.instagramPublication.findUniqueOrThrow({ where: { postId: post.id } })
    expect(pub).toMatchObject({ status: 'PUBLISHED', feedMediaId: 'media_1', storyMediaId: null })
    const container = new URLSearchParams(calls.find((c) => c.url.endsWith(`/ig${s.a1.userId}/media`))!.body)
    expect(container.get('image_url')).toBe('https://art.test/api/public/media/content/x.jpg')
    expect(container.get('caption')).toContain(`Veja na HouseArt: https://art.test/api/public/ig/${pub.code}`)
    expect(container.get('caption')).toContain('Abertura sábado')

    const cron = await runInstagramCron()
    expect(cron).toMatchObject({ refreshed: 1, insights: 1 })
    expect((await prisma.instagramPublication.findUniqueOrThrow({ where: { id: pub.id } })).reach).toBe(321)
  }, 60_000)

  it('live: a refused publish fails after the attempts and can be retried', async () => {
    process.env.INSTAGRAM_APP_ID = 'app'; process.env.INSTAGRAM_APP_SECRET = 'sec'
    await authenticated(s.b.artworkId)
    await connect(s.b.userId, 'LIVE', '@joana')
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Invalid image' } }), { status: 400 })))
    const post = await createPost(s.b.userId, { kind: 'TEXT', body: 'x', artworkId: s.b.artworkId })
    await requestPublication(s.b.userId, post.id, 'FEED')
    await awaitDetached()
    let pub = await prisma.instagramPublication.findUniqueOrThrow({ where: { postId: post.id } })
    expect(pub).toMatchObject({ status: 'PENDING', attempts: 1, error: 'O Instagram recusou o envio' })
    // the cron resends what stayed pending (after 10 minutes)
    await prisma.$executeRaw`UPDATE "InstagramPublication" SET "updatedAt" = now() - interval '11 minutes' WHERE id = ${pub.id}`
    await runInstagramCron()
    await prisma.$executeRaw`UPDATE "InstagramPublication" SET "updatedAt" = now() - interval '11 minutes' WHERE id = ${pub.id}`
    await runInstagramCron()
    pub = await prisma.instagramPublication.findUniqueOrThrow({ where: { id: pub.id } })
    expect(pub).toMatchObject({ status: 'FAILED', attempts: 3 })
  }, 60_000)
})
