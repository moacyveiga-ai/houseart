// Marketplace filters of the handoff (HouseArt Marketplace.dc.html): technique,
// price ranges, seller kind, market, size, UF — multi-select per group, with the
// count of each option computed against the OTHER groups (as the prototype does).
// Pure: the page loads the listed set once and filters here.
export interface MarketItem {
  publicId: string; artist: string; artistSlug: string; title: string; year: number | null; category: string; technique: string | null; dimensions: string; sizeKey: 'SMALL' | 'MEDIUM' | 'LARGE' | null
  priceCents: bigint | null; saleMode: string | null; seller: string; sellerKind: 'GALLERY' | 'PRIVATE'; market: 'PRIMARY' | 'SECONDARY' | null; uf: string | null; cover: string | null; updatedAt: number
}

export const PRICE_RANGES = [
  { key: 'upto10', label: 'Até R$ 10 mil', min: 0n, max: 1_000_000n },
  { key: '10to50', label: 'R$ 10 a 50 mil', min: 1_000_000n, max: 5_000_000n },
  { key: '50to200', label: 'R$ 50 a 200 mil', min: 5_000_000n, max: 20_000_000n },
  { key: 'over200', label: 'Acima de R$ 200 mil', min: 20_000_000n, max: null },
] as const

export const SIZE_LABELS = { SMALL: 'Pequeno', MEDIUM: 'Médio', LARGE: 'Grande' } as const
export const SELLER_LABELS = { GALLERY: 'Galeria', PRIVATE: 'Particular' } as const
export const MARKET_LABELS = { PRIMARY: 'Primário', SECONDARY: 'Secundário' } as const

/** Pequeno < 60 cm · Médio < 120 cm · Grande ≥ 120 cm on the largest side. */
export function sizeKeyOf(heightMm: number | null, widthMm: number | null): MarketItem['sizeKey'] {
  const max = Math.max(heightMm ?? 0, widthMm ?? 0)
  if (!max) return null
  return max < 600 ? 'SMALL' : max < 1200 ? 'MEDIUM' : 'LARGE'
}

export type GroupKey = 'category' | 'price' | 'seller' | 'market' | 'size' | 'uf'
export type Selection = Record<GroupKey, string[]>
export const EMPTY_SELECTION: Selection = { category: [], price: [], seller: [], market: [], size: [], uf: [] }

const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function matchesGroup(item: MarketItem, g: GroupKey, values: string[]): boolean {
  if (values.length === 0) return true
  switch (g) {
    case 'category': return values.includes(item.category)
    case 'price': return item.priceCents !== null && values.some((k) => { const r = PRICE_RANGES.find((x) => x.key === k); return !!r && item.priceCents! >= r.min && (r.max === null || item.priceCents! < r.max) })
    case 'seller': return values.includes(item.sellerKind)
    case 'market': return item.market !== null && values.includes(item.market)
    case 'size': return item.sizeKey !== null && values.includes(item.sizeKey)
    case 'uf': return item.uf !== null && values.includes(item.uf)
  }
}

export function passes(item: MarketItem, sel: Selection, q: string, except?: GroupKey): boolean {
  const qq = norm(q.trim())
  if (qq && !norm(`${item.artist} ${item.title} ${item.technique ?? ''} ${item.seller}`).includes(qq)) return false
  return (Object.keys(sel) as GroupKey[]).every((g) => g === except || matchesGroup(item, g, sel[g]))
}

export type SortKey = 'rel' | 'lower' | 'higher' | 'recent'
export function sortItems(items: MarketItem[], sort: SortKey): MarketItem[] {
  const out = [...items]
  const price = (i: MarketItem) => (i.priceCents === null ? null : i.priceCents)
  if (sort === 'lower') out.sort((a, b) => cmp(price(a), price(b), true))
  if (sort === 'higher') out.sort((a, b) => (price(a) === null) !== (price(b) === null) ? (price(a) === null ? 1 : -1) : cmp(price(b), price(a), true))
  if (sort === 'recent') out.sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || b.updatedAt - a.updatedAt)
  return out
}
function cmp(a: bigint | null, b: bigint | null, nullsLast: boolean): number {
  if (a === null && b === null) return 0
  if (a === null) return nullsLast ? 1 : -1
  if (b === null) return nullsLast ? -1 : 1
  return a < b ? -1 : a > b ? 1 : 0
}

/** Option counts of a group, computed against the other groups (so a selected option never zeroes its siblings). */
export function countFor(items: MarketItem[], sel: Selection, q: string, g: GroupKey, value: string): number {
  return items.filter((i) => passes(i, sel, q, g) && matchesGroup(i, g, [value])).length
}

/** Read the selection from URL search params (`?category=PAINTING,SCULPTURE&price=upto10`). */
export function selectionFromParams(p: Record<string, string | string[] | undefined>): Selection {
  const read = (k: GroupKey) => { const v = p[k]; const s = Array.isArray(v) ? v.join(',') : v ?? ''; return s.split(',').map((x) => x.trim()).filter(Boolean) }
  return { category: read('category'), price: read('price'), seller: read('seller'), market: read('market'), size: read('size'), uf: read('uf') }
}

export function toggleIn(sel: Selection, g: GroupKey, value: string): Selection {
  const cur = sel[g]
  return { ...sel, [g]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] }
}

export function paramsOf(sel: Selection, q: string, sort: SortKey): string {
  const u = new URLSearchParams()
  for (const g of Object.keys(sel) as GroupKey[]) if (sel[g].length) u.set(g, sel[g].join(','))
  if (q.trim()) u.set('q', q.trim())
  if (sort !== 'rel') u.set('sort', sort)
  const s = u.toString()
  return s ? `?${s}` : ''
}
