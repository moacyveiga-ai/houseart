// Instagram (handoff "Web Galeria" › Instagram, "App Colecionador" › Instagram · conectar e postar) — PURE.
// The person connects their OWN professional account (Instagram API with Instagram Login) and a
// community post can go to it too. Modes: LIVE with INSTAGRAM_APP_ID + INSTAGRAM_APP_SECRET; MOCK with
// INSTAGRAM_MOCK=1 outside production (a local page "connects" and publishing records a fake id);
// otherwise OFF and the screens say "Em breve".

export const INSTAGRAM_MODES = ['OFF', 'MOCK', 'LIVE'] as const
export type InstagramMode = (typeof INSTAGRAM_MODES)[number]

export const INSTAGRAM_FORMATS = ['FEED', 'STORIES', 'BOTH'] as const
export type InstagramFormat = (typeof INSTAGRAM_FORMATS)[number]
export const FORMAT_LABELS: Record<InstagramFormat, string> = { FEED: 'Feed', STORIES: 'Stories', BOTH: 'Feed + Stories' }
export const isFormat = (v: unknown): v is InstagramFormat => typeof v === 'string' && (INSTAGRAM_FORMATS as readonly string[]).includes(v)

export const PUBLICATION_STATUSES = ['PENDING', 'PUBLISHED', 'FAILED'] as const
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number]

export const PREF_KEYS = ['defaultOn', 'includeLink', 'tagArtist'] as const
export type PrefKey = (typeof PREF_KEYS)[number]
export const PREFS: { key: PrefKey; name: string; sub: string }[] = [
  { key: 'defaultOn', name: 'Ligado por padrão em novos posts', sub: 'Você ainda pode desligar post a post' },
  { key: 'includeLink', name: 'Incluir o link da obra', sub: 'Na legenda, o endereço da página pública da obra ou do post' },
  { key: 'tagArtist', name: 'Marcar o artista', sub: 'Quando o artista tiver o Instagram conectado' },
]

export const BENEFITS: { icon: string; text: string }[] = [
  { icon: 'send', text: 'Um toque: o post vai para a comunidade e para o seu feed ou Stories.' },
  { icon: 'link', text: 'A legenda leva o link da página pública da obra, com certificado e compra.' },
  { icon: 'insights', text: 'Veja alcance e visitas pelo link de cada post aqui.' },
]

type Env = Record<string, string | undefined>

export function instagramMode(env: Env): InstagramMode {
  if (env.INSTAGRAM_APP_ID && env.INSTAGRAM_APP_SECRET) return 'LIVE'
  if (env.INSTAGRAM_MOCK === '1' && env.NODE_ENV !== 'production' && env.VERCEL_ENV !== 'production') return 'MOCK'
  return 'OFF'
}

export const GRAPH = 'https://graph.instagram.com/v21.0'
export const SCOPES = ['instagram_business_basic', 'instagram_business_content_publish', 'instagram_business_manage_insights']
export const STATE_COOKIE = 'houseart_ig'
export const STATE_TTL_MS = 10 * 60_000

export interface ConnectState { nonce: string; userId: number; issuedAt: number }

export function stateValid(s: ConnectState, nonce: string, userId: number, now: number): boolean {
  return s.nonce === nonce && s.userId === userId && now - s.issuedAt >= 0 && now - s.issuedAt <= STATE_TTL_MS
}

/** Where the person authorizes: Instagram (LIVE) or the local mock page. */
export function authorizeUrl(mode: 'MOCK' | 'LIVE', appId: string, redirectUri: string, nonce: string, baseUrl: string): string {
  if (mode === 'MOCK') {
    const u = new URL('/api/instagram/mock/authorize', baseUrl)
    u.searchParams.set('state', nonce)
    return u.toString()
  }
  const u = new URL('https://www.instagram.com/oauth/authorize')
  u.searchParams.set('client_id', appId)
  u.searchParams.set('redirect_uri', redirectUri)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', SCOPES.join(','))
  u.searchParams.set('state', nonce)
  return u.toString()
}

/** "@galerialadeira" from a username (Instagram) or a name (mock). */
export function handleOf(raw: string): string {
  const h = raw.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 30)
  return '@' + (h || 'houseart')
}

export function accountTypeLabel(t: string | null): string {
  return t === 'BUSINESS' ? 'Conta comercial' : t === 'MEDIA_CREATOR' ? 'Conta de criador' : 'Conta profissional'
}

export function followersLabel(n: number | null): string | null {
  if (n == null) return null
  if (n >= 1000) return `${(Math.round(n / 100) / 10).toLocaleString('pt-BR')} mil seguidores`
  return `${n} ${n === 1 ? 'seguidor' : 'seguidores'}`
}

const HASHTAGS = '#arte #houseart'
export const CAPTION_MAX = 2200

/**
 * The caption: the post text, the artwork and its artist, the artist's handle when connected and the
 * person wants the tag, the short link (Instagram does not make it clickable in the feed — it is there
 * to copy, and the page is also on the profile), and the hashtags. Always within Instagram's 2,200.
 */
export function captionOf(input: { body: string; artwork: { title: string; artist: string } | null; artistHandle: string | null; tagArtist: boolean; link: string | null }): string {
  const tail = [
    input.artwork ? `${input.artwork.title}, ${input.artwork.artist}${input.tagArtist && input.artistHandle ? ` ${input.artistHandle}` : ''}` : null,
    input.link ? `Veja na HouseArt: ${input.link}` : null,
    HASHTAGS,
  ].filter(Boolean).join('\n')
  const room = CAPTION_MAX - tail.length - 2
  const body = input.body.trim()
  const head = body.length > room ? body.slice(0, Math.max(0, room - 1)).trimEnd() + '…' : body
  return head ? `${head}\n\n${tail}` : tail
}

/** The feed takes images between 4:5 (portrait) and 1.91:1 (landscape); Stories take any. */
export function feedRatioOk(width: number, height: number): boolean {
  if (!(width > 0 && height > 0)) return true
  const r = width / height
  return r >= 0.8 - 0.005 && r <= 1.91 + 0.005
}

/**
 * Why a post cannot go to Instagram (null = it can). Instagram only takes posts with an image; the feed
 * refuses an image outside 4:5–1.91:1 (a 3:4 portrait painting), so that is said before sending.
 * `image` is the size of the artwork image when the post uses it (unknown for the post's own photo).
 */
export function publishBlocker(post: { kind: string; imageUrl: string | null; hasArtworkImage: boolean; format?: InstagramFormat; image?: { width: number; height: number } | null }): string | null {
  if (post.kind === 'POLL') return 'Enquetes ficam só na comunidade.'
  if (!post.imageUrl && !post.hasArtworkImage) return 'O Instagram precisa de uma imagem: marque uma obra ou poste uma foto.'
  if (post.format && post.format !== 'STORIES' && post.image && !feedRatioOk(post.image.width, post.image.height)) return 'No feed, o Instagram só aceita imagens entre 4:5 e 1,91:1. Escolha Stories ou poste uma foto recortada.'
  return null
}

/** Where the short link of the caption lands: the public page of the artwork, else the community. */
export function targetPathOf(artworkPublicId: string | null): string {
  return artworkPublicId ? `/e/artwork/${artworkPublicId}` : '/community'
}

/** The line under a sent post: "1.240 alcançados · 18 visitas pelo link" (or the state while not published). */
export function publicationStats(p: { status: string; reach: number; clicks: number; error: string | null }): string {
  if (p.status === 'PENDING') return 'Enviando ao Instagram…'
  if (p.status === 'FAILED') return `Não publicado · ${p.error ?? 'tente de novo'}`
  return `${p.reach.toLocaleString('pt-BR')} alcançados · ${p.clicks} ${p.clicks === 1 ? 'visita' : 'visitas'} pelo link`
}

/** Short reason kept on the row: never the token or the whole provider body. */
export function errorText(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e)
  return m.replace(/access_token=[^&\s]+/g, 'access_token=…').slice(0, 160)
}

export const MAX_ATTEMPTS = 3
/** Days before expiry when the cron refreshes a long-lived token (it lives 60 days; refreshable after 24 h). */
export const REFRESH_BEFORE_DAYS = 10

export function needsRefresh(expiresAt: Date | null, now: Date): boolean {
  return !!expiresAt && expiresAt.getTime() - now.getTime() < REFRESH_BEFORE_DAYS * 86_400_000
}
