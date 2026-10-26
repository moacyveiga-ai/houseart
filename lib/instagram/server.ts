// Instagram — I/O: connect (state cookie, code exchange, long-lived token, profile), preferences,
// publishing a community post (container → publish), the short link that counts visits, and the
// cron (token refresh, insights, the publish that a lost `after()` left PENDING). Pure rules in core.ts.
// The token is encrypted at rest and never leaves this file.
import 'server-only'
import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { decryptText, encryptText } from '@/lib/crypto/cipher'
import { publicBaseUrl } from '@/lib/public-url'
import { afterResponse } from '@/lib/after'
import { ArtworkError } from '@/lib/artworks/server'
import {
  GRAPH, MAX_ATTEMPTS, PREF_KEYS, STATE_COOKIE, STATE_TTL_MS, accountTypeLabel, authorizeUrl, captionOf, errorText, followersLabel,
  handleOf, instagramMode, isFormat, needsRefresh, publicationStats, publishBlocker, stateValid, targetPathOf,
  type ConnectState, type InstagramFormat, type InstagramMode, type PrefKey,
} from './core'

const newNonce = () => randomBytes(16).toString('base64url')
const newCode = () => randomBytes(6).toString('base64url')

export const redirectUri = () => `${publicBaseUrl()}/api/instagram/callback`
const mode = (): InstagramMode => instagramMode(process.env)
const absolute = (u: string) => (/^https?:\/\//.test(u) ? u : `${publicBaseUrl()}${u.startsWith('/') ? '' : '/'}${u}`)

// ── HTTP to Instagram (LIVE only) ──────────────────────────────────────────

async function igFetch(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) })
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok || body.error) {
    const err = body.error as { message?: string } | undefined
    throw new Error(`Instagram ${res.status}: ${err?.message ?? 'erro'}`)
  }
  return body
}
const form = (o: Record<string, string>) => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o) })
const str = (v: unknown) => (typeof v === 'string' && v ? v : typeof v === 'number' ? String(v) : null)

// ── views ──────────────────────────────────────────────────────────────────

export interface InstagramView {
  mode: InstagramMode
  connection: { handle: string; account: string; followers: string | null; status: string; lastError: string | null; prefs: Record<PrefKey, boolean> } | null
  publications: { id: number; image: string | null; text: string; stats: string; status: string; canRetry: boolean }[]
}

export async function instagramView(userId: number): Promise<InstagramView> {
  const c = await prisma.instagramConnection.findUnique({ where: { userId } })
  const pubs = await prisma.instagramPublication.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 20 })
  const posts = pubs.length ? await prisma.post.findMany({ where: { id: { in: pubs.map((p) => p.postId) } }, select: { id: true, body: true, imageUrl: true, artworkId: true } }) : []
  const covers = await coversOf(posts.map((p) => p.artworkId).filter((v): v is number => v != null))
  const byPost = new Map(posts.map((p) => [p.id, p]))
  return {
    mode: mode(),
    connection: c ? { handle: c.handle, account: accountTypeLabel(c.accountType), followers: followersLabel(c.followers), status: c.status, lastError: c.lastError, prefs: { defaultOn: c.defaultOn, includeLink: c.includeLink, tagArtist: c.tagArtist } } : null,
    publications: pubs.map((p) => {
      const post = byPost.get(p.postId)
      return { id: p.id, image: post?.imageUrl ?? (post?.artworkId ? covers.get(post.artworkId) ?? null : null), text: (post?.body || 'Post').slice(0, 80), stats: publicationStats(p), status: p.status, canRetry: p.status === 'FAILED' }
    }),
  }
}

/** What the composer needs: is it available, the handle, and whether the switch starts on. */
export async function composerInstagram(userId: number): Promise<{ mode: InstagramMode; handle: string | null; defaultOn: boolean }> {
  const m = mode()
  if (m === 'OFF') return { mode: m, handle: null, defaultOn: false }
  const c = await prisma.instagramConnection.findUnique({ where: { userId }, select: { handle: true, defaultOn: true, mode: true } })
  // a mock connection does not serve a LIVE app (and the other way round)
  const usable = c && c.mode === m ? c : null
  return { mode: m, handle: usable?.handle ?? null, defaultOn: usable?.defaultOn ?? false }
}

async function coversOf(artworkIds: number[]): Promise<Map<number, string>> {
  if (!artworkIds.length) return new Map()
  const media = await prisma.artworkMedia.findMany({ where: { artworkId: { in: artworkIds }, publicUrl: { not: null } }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], select: { artworkId: true, kind: true, publicUrl: true } })
  const out = new Map<number, string>()
  const front = new Set<number>()
  for (const m of media) {
    if (front.has(m.artworkId)) continue
    if (m.kind === 'FRONT_COLOR_CARD') { out.set(m.artworkId, m.publicUrl!); front.add(m.artworkId) } else if (!out.has(m.artworkId)) out.set(m.artworkId, m.publicUrl!)
  }
  return out
}

// ── connect ────────────────────────────────────────────────────────────────

export async function beginConnect(userId: number): Promise<string> {
  const m = mode()
  if (m === 'OFF') throw new ArtworkError('IG_OFF', 'A conexão com o Instagram ainda não está disponível.', 409)
  const state: ConnectState = { nonce: newNonce(), userId, issuedAt: Date.now() }
  const jar = await cookies()
  jar.set(STATE_COOKIE, encryptText(JSON.stringify(state)), { httpOnly: true, path: '/api/instagram', maxAge: STATE_TTL_MS / 1000, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' })
  return authorizeUrl(m, process.env.INSTAGRAM_APP_ID ?? '', redirectUri(), state.nonce, publicBaseUrl())
}

async function takeState(userId: number, nonce: string): Promise<boolean> {
  const jar = await cookies()
  const raw = jar.get(STATE_COOKIE)?.value
  jar.delete(STATE_COOKIE)
  if (!raw) return false
  try { return stateValid(JSON.parse(decryptText(raw)) as ConnectState, nonce, userId, Date.now()) } catch { return false }
}

/** The callback: checks the state, exchanges the code (LIVE) and saves the connection. */
export async function completeConnect(userId: number, code: string | null, nonce: string | null): Promise<{ ok: true; handle: string } | { ok: false; error: string }> {
  const m = mode()
  if (m === 'OFF') return { ok: false, error: 'indisponivel' }
  if (!code || !nonce || !(await takeState(userId, nonce))) return { ok: false, error: 'expirado' }
  let data: { igUserId: string; handle: string; accountType: string | null; followers: number | null; token: string; expiresAt: Date | null }
  if (m === 'MOCK') {
    const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { name: true, member: { select: { kind: true } } } })
    data = { igUserId: `mock:${userId}`, handle: handleOf(u.name), accountType: u.member?.kind === 'GALLERY_STAFF' ? 'BUSINESS' : 'MEDIA_CREATOR', followers: u.member?.kind === 'GALLERY_STAFF' ? 12_400 : 1_830, token: 'mock', expiresAt: null }
  } else {
    try {
      const appId = process.env.INSTAGRAM_APP_ID!, secret = process.env.INSTAGRAM_APP_SECRET!
      const short = await igFetch('https://api.instagram.com/oauth/access_token', form({ client_id: appId, client_secret: secret, grant_type: 'authorization_code', redirect_uri: redirectUri(), code }))
      const shortToken = str(short.access_token)
      if (!shortToken) return { ok: false, error: 'recusado' }
      const long = await igFetch(`https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(secret)}&access_token=${encodeURIComponent(shortToken)}`)
      const token = str(long.access_token) ?? shortToken
      const me = await igFetch(`${GRAPH}/me?fields=user_id,username,account_type,followers_count&access_token=${encodeURIComponent(token)}`)
      const igUserId = str(me.user_id) ?? str(me.id)
      if (!igUserId || !str(me.username)) return { ok: false, error: 'recusado' }
      const exp = typeof long.expires_in === 'number' ? new Date(Date.now() + long.expires_in * 1000) : null
      data = { igUserId, handle: handleOf(str(me.username)!), accountType: str(me.account_type), followers: typeof me.followers_count === 'number' ? me.followers_count : null, token, expiresAt: exp }
    } catch (e) {
      console.error('[instagram] conexão falhou:', errorText(e))
      return { ok: false, error: 'recusado' }
    }
  }
  const row = { mode: m, igUserId: data.igUserId, handle: data.handle, accountType: data.accountType, followers: data.followers, tokenEnc: encryptText(data.token), tokenExpiresAt: data.expiresAt, status: 'CONNECTED', lastError: null }
  await prisma.instagramConnection.upsert({ where: { userId }, create: { userId, ...row }, update: row })
  return { ok: true, handle: data.handle }
}

export async function updatePrefs(userId: number, raw: Record<string, unknown>): Promise<void> {
  const data: Partial<Record<PrefKey, boolean>> = {}
  for (const k of PREF_KEYS) if (typeof raw[k] === 'boolean') data[k] = raw[k] as boolean
  if (!Object.keys(data).length) throw new ArtworkError('BAD_PREFS', 'Nada para mudar.', 422)
  const r = await prisma.instagramConnection.updateMany({ where: { userId }, data })
  if (!r.count) throw new ArtworkError('NOT_CONNECTED', 'Conecte o Instagram primeiro.', 409)
}

/** Forgets the account here (Instagram Login has no revoke call: the person removes the app in Instagram, the screen says so). */
export async function disconnect(userId: number): Promise<void> {
  await prisma.instagramConnection.deleteMany({ where: { userId } })
}

// ── publish ────────────────────────────────────────────────────────────────

/** Called right after the community post is created, when the person left the switch on. */
export async function requestPublication(userId: number, postId: number, rawFormat: unknown): Promise<{ id: number } | { error: string }> {
  const m = mode()
  if (m === 'OFF') return { error: 'O Instagram ainda não está disponível.' }
  const format: InstagramFormat = isFormat(rawFormat) ? rawFormat : 'FEED'
  const c = await prisma.instagramConnection.findUnique({ where: { userId } })
  if (!c || c.mode !== m) return { error: 'Conecte o Instagram para publicar lá também.' }
  const post = await prisma.post.findFirst({ where: { id: postId, authorUserId: userId, hiddenAt: null }, select: { id: true, kind: true, imageUrl: true, artworkId: true } })
  if (!post) return { error: 'Post não encontrado.' }
  const art = post.artworkId ? await prisma.artwork.findUnique({ where: { id: post.artworkId }, select: { publicId: true } }) : null
  const covers = await coversOf(post.artworkId ? [post.artworkId] : [])
  const blocker = publishBlocker({ kind: post.kind, imageUrl: post.imageUrl, hasArtworkImage: covers.size > 0 })
  if (blocker) return { error: blocker }
  const pub = await prisma.instagramPublication.upsert({
    where: { postId: post.id },
    create: { postId: post.id, userId, connectionId: c.id, format, code: newCode(), targetPath: targetPathOf(art?.publicId ?? null) },
    update: {},
  })
  afterResponse('instagram:publish', () => publishNow(pub.id))
  return { id: pub.id }
}

export async function retryPublication(userId: number, id: number): Promise<void> {
  const r = await prisma.instagramPublication.updateMany({ where: { id, userId, status: 'FAILED' }, data: { status: 'PENDING', attempts: 0, error: null } })
  if (!r.count) throw new ArtworkError('NOT_FOUND', 'Publicação não encontrada.', 404)
  afterResponse('instagram:publish', () => publishNow(id))
}

/** Sends one publication (idempotent per media id: a format already published is not sent again). */
export async function publishNow(id: number): Promise<void> {
  // claim: only PENDING rows, one runner at a time (attempts bump is the lease)
  const p = await prisma.instagramPublication.findUnique({ where: { id } })
  if (!p || p.status !== 'PENDING' || p.attempts >= MAX_ATTEMPTS) return
  const claimed = await prisma.instagramPublication.updateMany({ where: { id, status: 'PENDING', attempts: p.attempts, updatedAt: p.updatedAt }, data: { attempts: { increment: 1 } } })
  if (!claimed.count) return
  const c = await prisma.instagramConnection.findUnique({ where: { id: p.connectionId } })
  const fail = async (error: string) => {
    const final = p.attempts + 1 >= MAX_ATTEMPTS || !c
    await prisma.instagramPublication.update({ where: { id }, data: { status: final ? 'FAILED' : 'PENDING', error } })
  }
  if (!c || c.userId !== p.userId) { await fail('Instagram desconectado'); return }
  const post = await prisma.post.findUnique({ where: { id: p.postId }, select: { body: true, imageUrl: true, artworkId: true, hiddenAt: true } })
  if (!post || post.hiddenAt) { await prisma.instagramPublication.update({ where: { id }, data: { status: 'FAILED', error: 'O post foi apagado' } }); return }
  const art = post.artworkId ? await prisma.artwork.findUnique({ where: { id: post.artworkId }, select: { title: true, artist: { select: { name: true, member: { select: { userId: true } } } } } }) : null
  const artistUser = art?.artist.member?.userId ?? null
  const artistHandle = artistUser && artistUser !== c.userId ? (await prisma.instagramConnection.findUnique({ where: { userId: artistUser }, select: { handle: true } }))?.handle ?? null : null
  const image = post.imageUrl ?? (post.artworkId ? (await coversOf([post.artworkId])).get(post.artworkId) ?? null : null)
  if (!image) { await prisma.instagramPublication.update({ where: { id }, data: { status: 'FAILED', error: 'O post não tem imagem' } }); return }
  const caption = captionOf({ body: post.body, artwork: art ? { title: art.title, artist: art.artist.name } : null, artistHandle, tagArtist: c.tagArtist, link: c.includeLink ? `${publicBaseUrl()}/api/public/ig/${p.code}` : null })

  try {
    let feed = p.feedMediaId, story = p.storyMediaId
    if (c.mode === 'MOCK') {
      if (p.format !== 'STORIES' && !feed) feed = `mock_feed_${p.id}`
      if (p.format !== 'FEED' && !story) story = `mock_story_${p.id}`
    } else {
      const token = decryptText(c.tokenEnc)
      const send = async (kind: 'FEED' | 'STORIES') => {
        const params: Record<string, string> = { image_url: absolute(image), access_token: token }
        if (kind === 'FEED') params.caption = caption
        else params.media_type = 'STORIES'
        const container = await igFetch(`${GRAPH}/${c.igUserId}/media`, form(params))
        const creationId = str(container.id)
        if (!creationId) throw new Error('Instagram não devolveu o contêiner')
        // images are usually ready at once; wait a little when not
        for (let i = 0; i < 5; i++) {
          const st = await igFetch(`${GRAPH}/${creationId}?fields=status_code&access_token=${encodeURIComponent(token)}`)
          if (st.status_code === 'FINISHED') break
          if (st.status_code === 'ERROR') throw new Error('Instagram recusou a imagem')
          await new Promise((r) => setTimeout(r, 1500))
        }
        const done = await igFetch(`${GRAPH}/${c.igUserId}/media_publish`, form({ creation_id: creationId, access_token: token }))
        return str(done.id)
      }
      if (p.format !== 'STORIES' && !feed) { feed = await send('FEED'); await prisma.instagramPublication.update({ where: { id }, data: { feedMediaId: feed } }) }
      if (p.format !== 'FEED' && !story) story = await send('STORIES')
    }
    await prisma.instagramPublication.update({ where: { id }, data: { status: 'PUBLISHED', feedMediaId: feed, storyMediaId: story, error: null, publishedAt: new Date() } })
  } catch (e) {
    const msg = errorText(e)
    console.error('[instagram] publicação falhou:', msg)
    await fail(msg.includes('190') || /token/i.test(msg) ? 'A conexão expirou: conecte de novo' : 'O Instagram recusou o envio')
    if (/token|190/i.test(msg)) await prisma.instagramConnection.update({ where: { id: c.id }, data: { status: 'ERROR', lastError: 'A conexão expirou. Conecte de novo.' } })
  }
}

// ── short link ─────────────────────────────────────────────────────────────

/** The caption link: counts one visit and returns where to send the person (null = unknown code). */
export async function followLink(code: string): Promise<string | null> {
  if (!/^[A-Za-z0-9_-]{4,16}$/.test(code)) return null
  const p = await prisma.instagramPublication.findUnique({ where: { code }, select: { id: true, targetPath: true } })
  if (!p) return null
  await prisma.instagramPublication.update({ where: { id: p.id }, data: { clicks: { increment: 1 } } })
  return p.targetPath
}

// ── cron ───────────────────────────────────────────────────────────────────

export async function runInstagramCron(now = new Date()): Promise<{ refreshed: number; insights: number; resent: number }> {
  let refreshed = 0, insights = 0, resent = 0
  // tokens close to expiry (LIVE only)
  const expiring = await prisma.instagramConnection.findMany({ where: { mode: 'LIVE', status: 'CONNECTED', tokenExpiresAt: { not: null, lt: new Date(now.getTime() + 10 * 86_400_000) } }, take: 50 })
  for (const c of expiring) {
    if (!needsRefresh(c.tokenExpiresAt, now)) continue
    try {
      const r = await igFetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(decryptText(c.tokenEnc))}`)
      const t = str(r.access_token)
      if (!t) throw new Error('sem token')
      await prisma.instagramConnection.update({ where: { id: c.id }, data: { tokenEnc: encryptText(t), tokenExpiresAt: typeof r.expires_in === 'number' ? new Date(now.getTime() + r.expires_in * 1000) : c.tokenExpiresAt } })
      refreshed++
    } catch (e) {
      console.error('[instagram] renovação falhou:', errorText(e))
      if (c.tokenExpiresAt && c.tokenExpiresAt < now) await prisma.instagramConnection.update({ where: { id: c.id }, data: { status: 'ERROR', lastError: 'A conexão expirou. Conecte de novo.' } })
    }
  }
  // publishes a lost after() left PENDING
  const stuck = await prisma.instagramPublication.findMany({ where: { status: 'PENDING', attempts: { lt: MAX_ATTEMPTS }, updatedAt: { lt: new Date(now.getTime() - 10 * 60_000) } }, select: { id: true }, take: 20 })
  for (const s of stuck) { await publishNow(s.id); resent++ }
  // reach of the last 30 days, every 6 h
  const recent = await prisma.instagramPublication.findMany({
    where: { status: 'PUBLISHED', publishedAt: { gte: new Date(now.getTime() - 30 * 86_400_000) }, OR: [{ insightsAt: null }, { insightsAt: { lt: new Date(now.getTime() - 6 * 3_600_000) } }] },
    take: 50,
  })
  const conns = new Map((await prisma.instagramConnection.findMany({ where: { id: { in: [...new Set(recent.map((r) => r.connectionId))] } } })).map((c) => [c.id, c]))
  for (const p of recent) {
    const c = conns.get(p.connectionId)
    if (!c || c.mode !== 'LIVE' || c.status !== 'CONNECTED') { await prisma.instagramPublication.update({ where: { id: p.id }, data: { insightsAt: now } }); continue }
    try {
      const token = decryptText(c.tokenEnc)
      let reach = 0
      for (const mediaId of [p.feedMediaId, p.storyMediaId]) {
        if (!mediaId) continue
        const r = await igFetch(`${GRAPH}/${mediaId}/insights?metric=reach&access_token=${encodeURIComponent(token)}`)
        const v = ((r.data as { values?: { value?: number }[] }[] | undefined)?.[0]?.values?.[0]?.value) ?? 0
        reach += typeof v === 'number' ? v : 0
      }
      await prisma.instagramPublication.update({ where: { id: p.id }, data: { reach, insightsAt: now } })
      insights++
    } catch (e) {
      console.error('[instagram] alcance falhou:', errorText(e))
      await prisma.instagramPublication.update({ where: { id: p.id }, data: { insightsAt: now } })
    }
  }
  return { refreshed, insights, resent }
}
