// Pure rules of the public profile pages (Artista, Galeria, Galerias): labels,
// filters and the small derivations the prototypes compute in the browser.
import { formatBRL } from '@/lib/artworks/domain'

/** "400" bps → "4%", 550 → "5,5%". */
export const bpsPercent = (bps: number): string => `${(bps / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`

/** Status pill of the artist header. */
export const artistStatus = (alive: boolean, span: string | null): string => (alive ? 'Em atividade' : `In memoriam${span ? ` · ${span}` : ''}`)

/** "Joana Teixeira" → "JT" (at most two letters). */
export const initialsOf = (name: string): string =>
  name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('')

/** The gallery's single letter mark: "Galeria Ladeira" → "L", "Casa Tamarindo" → "T". */
export const galleryInitial = (name: string): string => (name.replace(/^(Galeria|Casa|Ateliê|Atelier|Espaço)\s+/i, '').trim()[0] ?? name[0] ?? '').toUpperCase()

/** The line of the royalty block ("Direito de sequência"). */
export const royaltyText = (bps: number, alive: boolean): string =>
  alive ? `Recebe ${bpsPercent(bps)} em toda revenda pela HouseArt, pago automaticamente.` : `O espólio recebe ${bpsPercent(bps)} em toda revenda pela HouseArt, pago automaticamente.`

// ── works of the artist ─────────────────────────────────────────────────────
export const WORK_FILTERS = [{ key: 'todas', label: 'Todas' }, { key: 'venda', label: 'À venda' }, { key: 'vendidas', label: 'Vendidas' }] as const
export type WorkFilter = (typeof WORK_FILTERS)[number]['key']

export const workFilterOf = (v: string | null | undefined): WorkFilter => (WORK_FILTERS.some((f) => f.key === v) ? (v as WorkFilter) : 'todas')

export const passesWorkFilter = (status: string, f: WorkFilter): boolean =>
  f === 'todas' || (f === 'venda' && status === 'LISTED') || (f === 'vendidas' && status === 'SOLD')

export function workPriceLabel(w: { status: string; priceCents: bigint | null }): string {
  if (w.status === 'SOLD') return 'Vendida'
  if (w.status === 'LISTED') return w.priceCents === null ? 'Sob consulta' : formatBRL(w.priceCents)
  if (w.status === 'IN_DEAL') return 'Em negociação'
  return 'Não está à venda'
}

/** Who is selling, as the card prints it: name · kind. */
export const sellerLine = (seller: string | null): { name: string; kind: string; icon: string } =>
  seller ? { name: seller, kind: 'Galeria', icon: 'storefront' } : { name: 'Colecionador particular', kind: 'Particular', icon: 'person' }

/** Price of a publication: formatted or "Grátis". */
export const publicationPrice = (cents: bigint | null): string => (cents === null || cents === 0n ? 'Grátis' : formatBRL(cents))

// ── gallery ─────────────────────────────────────────────────────────────────
/** OpenStreetMap embed around a point (no library, no key). */
export function osmEmbedUrl(lat: number, lng: number, delta = 0.004): string {
  const bbox = [lng - delta, lat - delta, lng + delta, lat + delta].map((n) => n.toFixed(5)).join('%2C')
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat.toFixed(5)}%2C${lng.toFixed(5)}`
}
export const mapLinks = (lat: number, lng: number) => ({
  directions: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
  waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
})

/** Column/row span of the i-th photo in the mosaic (the prototype's 2-2 · 1-1 ×4 · 2-1 pattern). */
export function photoSpan(i: number): { c: number; r: number } {
  const pattern = [{ c: 2, r: 2 }, { c: 1, r: 1 }, { c: 1, r: 1 }, { c: 1, r: 1 }, { c: 1, r: 1 }, { c: 2, r: 1 }]
  return pattern[i % pattern.length]!
}

// ── galleries list ──────────────────────────────────────────────────────────
/** "9 galerias · 446 obras" (singular for one gallery). */
export const galleriesSummary = (n: number, works: number): string => `${n} ${n === 1 ? 'galeria' : 'galerias'} · ${works} ${works === 1 ? 'obra' : 'obras'}`

/** Distinct tags in order of first appearance. */
export const tagsOf = (galleries: { tags: string[] }[]): string[] => [...new Set(galleries.flatMap((g) => g.tags))]

/** Distinct UFs, sorted. */
export const ufsOf = (galleries: { uf: string | null }[]): string[] => [...new Set(galleries.map((g) => g.uf).filter((u): u is string => !!u))].sort()

/** Query string of the galleries list (only what is set). */
export function galleriesHref(f: { q?: string | null; uf?: string | null; tag?: string | null }): string {
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  if (f.uf) p.set('uf', f.uf)
  if (f.tag) p.set('tag', f.tag)
  const s = p.toString()
  return `/e/galleries${s ? `?${s}` : ''}`
}
