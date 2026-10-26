// Explorar (handoff "HouseArt App Colecionador" › Explorar · feed / descobrir): the chips
// `CATS` and the filter `passa` of the prototype, over the public cards. Pure.
export interface ExploreItem {
  id: number; publicId: string; title: string; year: number | null; artist: string; category: string
  priceCents: string | null; saleMode: string | null; cover: string | null
  technique: string | null; dimensions: string; seller: string; sellerKind: 'GALLERY' | 'PRIVATE'; market: 'PRIMARY' | 'SECONDARY' | null; uf: string | null
  liked: boolean; saved: boolean
}

export const EXPLORE_CHIPS = [
  { key: 'all', label: 'Tudo' },
  { key: 'PAINTING', label: 'Pintura' },
  { key: 'PHOTOGRAPHY', label: 'Fotografia' },
  { key: 'WORK_ON_PAPER', label: 'Obra sobre papel' },
  { key: 'SCULPTURE', label: 'Escultura' },
  { key: 'upto10k', label: 'Até R$ 10 mil' },
  { key: 'offers', label: 'Aceita ofertas' },
] as const
export type ExploreChip = (typeof EXPLORE_CHIPS)[number]['key']

export function chipOf(raw: string | undefined): ExploreChip {
  return (EXPLORE_CHIPS.find((c) => c.key === raw)?.key ?? 'all') as ExploreChip
}
export type ExploreView = 'feed' | 'discover'
export const viewOf = (raw: string | undefined): ExploreView => (raw === 'discover' ? 'discover' : 'feed')

/** The prototype's `aceita`: the listing accepts offers (price visible and not fixed-only). */
export const acceptsOffers = (saleMode: string | null) => saleMode === 'FIXED_WITH_OFFERS'

export function passesChip(item: ExploreItem, chip: ExploreChip): boolean {
  if (chip === 'all') return true
  if (chip === 'upto10k') return item.priceCents !== null && BigInt(item.priceCents) <= 1_000_000n
  if (chip === 'offers') return acceptsOffers(item.saleMode)
  return item.category === chip
}

export function exploreHref(view: ExploreView, chip: ExploreChip): string {
  const p = new URLSearchParams()
  if (view === 'discover') p.set('view', 'discover')
  if (chip !== 'all') p.set('cat', chip)
  const q = p.toString()
  return `/explore${q ? `?${q}` : ''}`
}

/** The same screen with the artwork open in the side panel (?work=<publicId>). */
export function exploreWorkHref(view: ExploreView, chip: ExploreChip, publicId: string): string {
  const base = exploreHref(view, chip)
  return `${base}${base.includes('?') ? '&' : '?'}work=${encodeURIComponent(publicId)}`
}

/** "3 de 12 · arraste para a direita para curtir" of the deck. */
export function deckCounter(index: number, total: number): string {
  return `${Math.min(index + 1, total)} de ${total} · arraste para a direita para curtir`
}

/** The technical line of the card: technique · dimensions (what the prototype's `ficha` shows). */
export function sheetLineOf(item: Pick<ExploreItem, 'technique' | 'dimensions'>, fallback: string): string {
  return [item.technique ?? fallback, item.dimensions !== '—' ? item.dimensions : null].filter(Boolean).join(' · ')
}
