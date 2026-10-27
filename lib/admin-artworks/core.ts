// Admin › Obras e certificados › Todas as obras — PURE. Read-only: every work of the house in any
// state, its certificate (state, versions, signed/issued) and the open review items; the filters,
// the search reading and the page.
import type { ArtworkStatus } from '@/lib/artworks/domain'

export const ARTWORK_FILTERS = ['all', 'drafts', 'certification', 'certified', 'listed', 'deal', 'alert', 'archived'] as const
export type ArtworkFilter = (typeof ARTWORK_FILTERS)[number]
export const ARTWORK_FILTER_LABELS: Record<ArtworkFilter, string> = {
  all: 'Todas', drafts: 'Rascunhos', certification: 'Em certificação', certified: 'Autenticadas', listed: 'À venda',
  deal: 'Em negócio ou vendidas', alert: 'Com alerta', archived: 'Arquivadas',
}
export const filterKey = (raw: string | undefined): ArtworkFilter => ((ARTWORK_FILTERS as readonly string[]).includes(raw ?? '') ? (raw as ArtworkFilter) : 'all')

/** The statuses of each filter; `alert` also takes a contested or revoked certificate (the server adds it). */
export const FILTER_STATUSES: Record<ArtworkFilter, readonly ArtworkStatus[] | null> = {
  all: null, drafts: ['DRAFT'], certification: ['IN_CERTIFICATION'], certified: ['AUTHENTICATED'], listed: ['LISTED'],
  deal: ['IN_DEAL', 'SOLD'], alert: ['STOLEN', 'DISPUTED'], archived: ['ARCHIVED'],
}
export const ALERT_CERTIFICATE_STATUSES = ['CONTESTED', 'REVOKED'] as const

export const PAGE_SIZE = 50

/** "HA-2026-…" → a public id; "#12" or "12" → the work id; anything else → title or artist text. */
export function parseQuery(raw: string | undefined): { publicId: string | null; id: number | null; text: string } {
  const q = (raw ?? '').trim().slice(0, 120)
  if (!q) return { publicId: null, id: null, text: '' }
  if (/^HA-/i.test(q)) return { publicId: q.toUpperCase(), id: null, text: '' }
  const m = /^#?(\d{1,9})$/.exec(q)
  if (m) return { publicId: null, id: Number(m[1]), text: '' }
  return { publicId: null, id: null, text: q }
}

/** The page asked for, inside 1..last (a page past the end shows the last one). */
export function pageOf(raw: string | undefined, total: number, size = PAGE_SIZE): { page: number; pages: number } {
  const pages = Math.max(1, Math.ceil(total / size))
  const n = Math.floor(Number(raw))
  return { page: Number.isFinite(n) && n >= 1 ? Math.min(n, pages) : 1, pages }
}

/** The list URL keeping the search and the filter. */
export function listHref(opt: { q?: string; f?: ArtworkFilter; page?: number }): string {
  const p = new URLSearchParams()
  if (opt.q) p.set('q', opt.q)
  if (opt.f && opt.f !== 'all') p.set('f', opt.f)
  if (opt.page && opt.page > 1) p.set('page', String(opt.page))
  const s = p.toString()
  return `/admin/review/artworks${s ? `?${s}` : ''}`
}

/** "v3 · 2 anteriores" — the version chain of a certificate in one line. */
export function versionsLine(versions: { version: number; status: string }[]): string {
  if (!versions.length) return 'sem versão emitida'
  const current = versions.reduce((m, v) => (v.version > m.version ? v : m))
  const older = versions.length - 1
  return `v${current.version}${older ? ` · ${older} ${older === 1 ? 'anterior' : 'anteriores'}` : ''}`
}
