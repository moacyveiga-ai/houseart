// Editing of the public content — PURE rules (no prisma, no next): what the
// editor screens send is normalized and validated here, the server only writes.
// Every text is trimmed and capped, every kind/category passes an allowlist,
// links are http(s) only and an image is either a file uploaded by the editor
// (the public derivative) or the value already stored — never an arbitrary URL.
import { slugify } from '@/lib/tenant/slug'
import {
  AGENDA_KINDS, ARTIST_ENTRY_KINDS, GALLERY_ITEM_IMAGE_KINDS, GALLERY_ITEM_KINDS, NEWS_CATEGORIES, PUBLICATION_ACTIONS, PUBLICATION_KINDS,
  type AgendaKind, type ArtistEntryKind, type GalleryItemKind, type PublicationAction, type PublicationKind,
} from './domain'

export class ContentError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message) }
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

// ── limits ──────────────────────────────────────────────────────────────────
export const CONTENT_IMAGE_MAX_BYTES = 10 * 1024 * 1024
export const CONTENT_IMAGE_MAX_SIDE = 2048
export const MAX_ENTRIES = 200
export const MAX_PUBLICATIONS = 50
export const MAX_GALLERY_ITEMS = 200
export const MAX_LANGUAGES = 12
export const MAX_TAGS = 12
const MAX_PRICE_CENTS = 100_000_000_00 // R$ 100 milhões

// ── primitives ──────────────────────────────────────────────────────────────
class Invalid extends Error {}
const fail = (msg: string): never => { throw new Invalid(msg) }

function str(v: unknown, label: string, max: number, opt: { required?: boolean; min?: number } = {}): string | null {
  if (v === undefined || v === null) { if (opt.required) fail(`${label}: obrigatório.`); return null }
  if (typeof v !== 'string') return fail(`${label}: valor inválido.`)
  const s = v.replace(/\r\n/g, '\n').trim()
  if (!s) { if (opt.required) fail(`${label}: obrigatório.`); return null }
  if (s.length > max) fail(`${label}: no máximo ${max} caracteres.`)
  if (opt.min && s.length < opt.min) fail(`${label}: no mínimo ${opt.min} caracteres.`)
  return s
}

function list(v: unknown, label: string, max: number): unknown[] {
  if (v === undefined || v === null) return []
  if (!Array.isArray(v)) return fail(`${label}: lista inválida.`)
  if (v.length > max) fail(`${label}: no máximo ${max} itens.`)
  return v
}

function oneOf<T extends string>(v: unknown, allowed: readonly T[], label: string): T {
  if (typeof v !== 'string' || !(allowed as readonly string[]).includes(v)) return fail(`${label}: opção inválida.`)
  return v as T
}

/** http(s) link, at most 500 characters, or null. */
export function httpUrl(v: unknown, label: string): string | null {
  const s = str(v, label, 500)
  if (!s) return null
  let u: URL
  try { u = new URL(s) } catch { return fail(`${label}: endereço inválido (use https://…).`) }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') fail(`${label}: só links http ou https.`)
  if (u.username || u.password) fail(`${label}: endereço inválido.`)
  return u.toString()
}

const OWN_BLOB = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/uploads\/content\//

/** A public derivative written by `uploadContentImage` (prefix `content/`), in any of the three homes of lib/storage/blob. */
export function isOwnContentImage(url: string): boolean {
  if (url.length > 500 || /[\s"'<>\\]/.test(url) || url.includes('..')) return false
  return url.startsWith('/api/public/media/content/') || url.startsWith('/uploads/content/') || OWN_BLOB.test(url)
}

/** An image field: empty, an image uploaded through the editor, or the URL already stored (`keep`). */
export function imageUrl(v: unknown, label: string, keep: ReadonlySet<string>): string | null {
  if (v === undefined || v === null || v === '') return null
  if (typeof v !== 'string') return fail(`${label}: imagem inválida.`)
  const s = v.trim()
  if (!s) return null
  if (keep.has(s) || isOwnContentImage(s)) return s
  return fail(`${label}: envie a imagem pelo botão de upload.`)
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
function email(v: unknown, label: string): string | null {
  const s = str(v, label, 254)
  if (s && !EMAIL.test(s)) fail(`${label}: e-mail inválido.`)
  return s ? s.toLowerCase() : null
}

function phone(v: unknown, label: string): string | null {
  const s = str(v, label, 30)
  if (s && !/^[0-9+()\-.\s]{8,30}$/.test(s)) fail(`${label}: use só números, espaços, +, ( ) e -.`)
  return s
}

/** "@galeria", "galeria" or "https://instagram.com/galeria/" → "galeria". */
export function instagramHandle(v: unknown, label = 'Instagram'): string | null {
  const s = str(v, label, 120)
  if (!s) return null
  const m = s.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#]+)\/?(?:[?#].*)?$/i)
  const h = (m ? m[1]! : s).replace(/^@/, '')
  if (!/^[A-Za-z0-9._]{1,30}$/.test(h)) fail(`${label}: perfil inválido.`)
  return h
}

/** A calendar day 'YYYY-MM-DD' that exists. */
export function isoDay(v: unknown, label: string, required = false): string | null {
  const s = str(v, label, 10, { required })
  if (!s) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return fail(`${label}: data inválida.`)
  const d = new Date(`${s}T12:00:00Z`)
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) fail(`${label}: data inválida.`)
  return s
}

function intIn(v: unknown, label: string, min: number, max: number): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.trim()) : NaN
  if (!Number.isInteger(n) || n < min || n > max) return fail(`${label}: número entre ${min} e ${max}.`)
  return n
}

function coord(v: unknown, label: string, limit: number): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.trim().replace(',', '.')) : NaN
  if (!Number.isFinite(n) || Math.abs(n) > limit) return fail(`${label}: coordenada inválida.`)
  return Math.round(n * 1e6) / 1e6
}

/** Price of a publication, in cents (integer ≥ 0) — null = free. Accepts a number or digits. */
export function priceCents(v: unknown, label: string): bigint | null {
  if (v === undefined || v === null || v === '') return null
  const s = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : ''
  if (!/^\d{1,12}$/.test(s)) return fail(`${label}: preço em centavos inválido.`)
  const n = BigInt(s)
  if (n > BigInt(MAX_PRICE_CENTS)) fail(`${label}: preço acima do limite.`)
  return n === 0n ? null : n
}

/** "R$ 49,90" / "49,90" / "49.90" / "49" → cents as a string (the editor field); '' → ''. */
export function centsFromReais(text: string): string | null {
  const t = text.replace(/R\$\s?/i, '').trim()
  if (!t) return ''
  const norm = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  if (!/^\d+(\.\d{1,2})?$/.test(norm)) return null
  const [int, dec = ''] = norm.split('.')
  return String(BigInt(int!) * 100n + BigInt((dec + '00').slice(0, 2)))
}

/** cents → "49,90" for the editor field. */
export const reaisOfCents = (c: bigint | string | null): string => {
  if (c === null || c === '') return ''
  const n = BigInt(c)
  return `${n / 100n},${String(n % 100n).padStart(2, '0')}`
}

function strings(v: unknown, label: string, maxItems: number, maxLen: number): string[] {
  const out: string[] = []
  for (const [i, x] of list(v, label, maxItems).entries()) {
    const s = str(x, `${label} ${i + 1}`, maxLen)
    if (s && !out.includes(s)) out.push(s)
  }
  return out
}

function run<T>(fn: () => T): Parsed<T> {
  try { return { ok: true, value: fn() } } catch (e) { if (e instanceof Invalid) return { ok: false, error: e.message }; throw e }
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

// ── news ────────────────────────────────────────────────────────────────────
export interface NewsInput { title: string; category: string; slug: string | null; summary: string | null; body: string | null; imageUrl: string | null; sourceName: string | null; sourceUrl: string | null; featured: boolean }

/** A slug the editor typed, normalized (or null = derive from the title). */
export function slugOf(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null
  return slugify(v)
}

export function parseNews(raw: unknown, keep: ReadonlySet<string> = new Set()): Parsed<NewsInput> {
  const r = obj(raw)
  return run(() => ({
    title: str(r.title, 'Título', 200, { required: true, min: 3 })!,
    category: oneOf(r.category, NEWS_CATEGORIES, 'Categoria'),
    slug: slugOf(r.slug),
    summary: str(r.summary, 'Resumo', 400),
    body: str(r.body, 'Texto', 20_000),
    imageUrl: imageUrl(r.imageUrl, 'Imagem', keep),
    sourceName: str(r.sourceName, 'Fonte', 120),
    sourceUrl: httpUrl(r.sourceUrl, 'Link da fonte'),
    featured: r.featured === true,
  }))
}

/** `publishedAt` after a publish toggle: keeps the first publication date; unpublish = draft (null). */
export function nextPublishedAt(current: Date | null, publish: boolean, now: Date): Date | null {
  if (!publish) return null
  return current ?? now
}

export type NewsState = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED'
export function newsState(publishedAt: Date | null, now: Date): NewsState {
  if (!publishedAt) return 'DRAFT'
  return publishedAt.getTime() > now.getTime() ? 'SCHEDULED' : 'PUBLISHED'
}
export const NEWS_STATE_LABELS: Record<NewsState, string> = { DRAFT: 'Rascunho', SCHEDULED: 'Agendada', PUBLISHED: 'Publicada' }

// ── agenda ──────────────────────────────────────────────────────────────────
export interface AgendaInput { kind: AgendaKind; title: string; venue: string; city: string; startsOn: string; endsOn: string | null; period: string | null; url: string | null }

export function parseAgenda(raw: unknown): Parsed<AgendaInput> {
  const r = obj(raw)
  return run(() => {
    const startsOn = isoDay(r.startsOn, 'Início', true)!
    const endsOn = isoDay(r.endsOn, 'Fim')
    if (endsOn && endsOn < startsOn) fail('Fim: não pode ser antes do início.')
    return {
      kind: oneOf(r.kind, AGENDA_KINDS, 'Tipo'),
      title: str(r.title, 'Título', 200, { required: true, min: 3 })!,
      venue: str(r.venue, 'Local', 160, { required: true })!,
      city: str(r.city, 'Cidade', 80, { required: true })!,
      startsOn, endsOn,
      period: str(r.period, 'Período', 40),
      url: httpUrl(r.url, 'Link'),
    }
  })
}

// ── publications (artist and gallery) ───────────────────────────────────────
export interface PublicationInput { kind: PublicationKind; title: string; meta: string | null; priceCents: bigint | null; action: PublicationAction; url: string | null; coverUrl: string | null; sortOrder: number }

function parsePublications(v: unknown, keep: ReadonlySet<string>): PublicationInput[] {
  return list(v, 'Publicações', MAX_PUBLICATIONS).map((x, i) => {
    const p = obj(x)
    const label = `Publicação ${i + 1}`
    return {
      kind: oneOf(p.kind, PUBLICATION_KINDS, `${label} · tipo`),
      title: str(p.title, `${label} · título`, 200, { required: true })!,
      meta: str(p.meta, `${label} · detalhes`, 120),
      priceCents: priceCents(p.priceCents, `${label} · preço`),
      action: p.action === undefined || p.action === null || p.action === '' ? 'READ' : oneOf(p.action, PUBLICATION_ACTIONS, `${label} · ação`),
      url: httpUrl(p.url, `${label} · link`),
      coverUrl: imageUrl(p.coverUrl, `${label} · capa`, keep),
      sortOrder: i,
    }
  })
}

// ── artist ──────────────────────────────────────────────────────────────────
export interface ArtistEntryInput { kind: ArtistEntryKind; year: string; title: string; venue: string | null; city: string | null; sortOrder: number }
export interface ArtistProfileInput {
  profile: { fullName: string | null; birthPlace: string | null; livesIn: string | null; nationality: string | null; quote: string | null; bio: string | null; languagesJson: string; photoUrl: string | null; photoCredit: string | null }
  entries: ArtistEntryInput[]
  publications: PublicationInput[]
}

export function parseArtistProfile(raw: unknown, keep: ReadonlySet<string> = new Set()): Parsed<ArtistProfileInput> {
  const r = obj(raw)
  return run(() => {
    const photoUrl = imageUrl(r.photoUrl, 'Foto', keep)
    const counters = new Map<string, number>()
    const entries = list(r.entries, 'Trajetória', MAX_ENTRIES).map((x, i) => {
      const e = obj(x)
      const label = `Trajetória, linha ${i + 1}`
      const kind = oneOf(e.kind, ARTIST_ENTRY_KINDS, `${label} · tipo`)
      const n = counters.get(kind) ?? 0
      counters.set(kind, n + 1)
      return { kind, year: str(e.year, `${label} · ano`, 20, { required: true })!, title: str(e.title, `${label} · título`, 200, { required: true })!, venue: str(e.venue, `${label} · local`, 160), city: str(e.city, `${label} · cidade`, 80), sortOrder: n }
    })
    return {
      profile: {
        fullName: str(r.fullName, 'Nome completo', 160),
        birthPlace: str(r.birthPlace, 'Local de nascimento', 80),
        livesIn: str(r.livesIn, 'Onde vive', 80),
        nationality: str(r.nationality, 'Nacionalidade', 60),
        quote: str(r.quote, 'Frase', 300),
        bio: str(r.bio, 'Biografia', 10_000),
        languagesJson: JSON.stringify(strings(r.languages, 'Linguagem', MAX_LANGUAGES, 40)),
        photoUrl,
        photoCredit: photoUrl ? str(r.photoCredit, 'Crédito da foto', 120) : null,
      },
      entries,
      publications: parsePublications(r.publications, keep),
    }
  })
}

// ── gallery ─────────────────────────────────────────────────────────────────
export interface GalleryItemInput { kind: GalleryItemKind; title: string; subtitle: string | null; url: string | null; sortOrder: number
  /** TEAM only: bio, e-mail and phone of the person (null for the other kinds) */
  body: string | null; email: string | null; phone: string | null }
export interface GalleryProfileInput {
  profile: { name: string; city: string | null; uf: string | null; foundedYear: number | null; summary: string | null; about: string | null; tagsJson: string; street: string | null; district: string | null; lat: number | null; lng: number | null; coverUrl: string | null; websiteUrl: string | null; instagram: string | null; email: string | null; phone: string | null; hours: string | null }
  items: GalleryItemInput[]
  publications: PublicationInput[]
}

export function parseGalleryProfile(raw: unknown, keep: ReadonlySet<string> = new Set(), thisYear = 2100): Parsed<GalleryProfileInput> {
  const r = obj(raw)
  return run(() => {
    const ufRaw = str(r.uf, 'UF', 2)
    const uf = ufRaw ? ufRaw.toUpperCase() : null
    if (uf && !/^[A-Z]{2}$/.test(uf)) fail('UF: use a sigla do estado (ex.: BA).')
    const lat = coord(r.lat, 'Latitude', 90)
    const lng = coord(r.lng, 'Longitude', 180)
    if ((lat === null) !== (lng === null)) fail('Mapa: informe latitude e longitude juntas (ou nenhuma).')
    const counters = new Map<string, number>()
    const items = list(r.items, 'Itens', MAX_GALLERY_ITEMS).map((x, i) => {
      const it = obj(x)
      const label = `Item ${i + 1}`
      const kind = oneOf(it.kind, GALLERY_ITEM_KINDS, `${label} · tipo`)
      const n = counters.get(kind) ?? 0
      counters.set(kind, n + 1)
      const url = GALLERY_ITEM_IMAGE_KINDS.includes(kind) ? imageUrl(it.url, `${label} · imagem`, keep) : kind === 'VIDEO' ? httpUrl(it.url, `${label} · link do vídeo`) : null
      const team = kind === 'TEAM'
      return {
        kind, title: str(it.title, `${label} · título`, 160, { required: true })!, subtitle: str(it.subtitle, `${label} · subtítulo`, 120), url, sortOrder: n,
        body: team ? str(it.body, `${label} · bio`, 400) : null,
        email: team ? email(it.email, `${label} · e-mail`) : null,
        phone: team ? phone(it.phone, `${label} · telefone`) : null,
      }
    })
    return {
      profile: {
        name: str(r.name, 'Nome', 120, { required: true, min: 2 })!,
        city: str(r.city, 'Cidade', 80),
        uf,
        foundedYear: intIn(r.foundedYear, 'Ano de fundação', 1800, thisYear),
        summary: str(r.summary, 'Resumo', 200),
        about: str(r.about, 'Sobre', 10_000),
        tagsJson: JSON.stringify(strings(r.tags, 'Etiqueta', MAX_TAGS, 30)),
        street: str(r.street, 'Endereço', 160),
        district: str(r.district, 'Bairro', 80),
        lat, lng,
        coverUrl: imageUrl(r.coverUrl, 'Capa', keep),
        websiteUrl: httpUrl(r.websiteUrl, 'Site'),
        instagram: instagramHandle(r.instagram),
        email: email(r.email, 'E-mail'),
        phone: phone(r.phone, 'Telefone'),
        hours: str(r.hours, 'Horários', 200),
      },
      items,
      publications: parsePublications(r.publications, keep),
    }
  })
}

/** Image intake verdict by the first bytes (JPEG/PNG/WebP) and the size. */
export function contentImageVerdict(type: string, size: number): { ok: true } | { ok: false; error: string; status: number } {
  if (size <= 0) return { ok: false, error: 'Arquivo vazio.', status: 400 }
  if (size > CONTENT_IMAGE_MAX_BYTES) return { ok: false, error: 'Imagem acima de 10 MB.', status: 413 }
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) return { ok: false, error: 'Envie uma imagem JPEG, PNG ou WebP.', status: 415 }
  return { ok: true }
}
