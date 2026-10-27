// Marketplace of the panel — PURE: the chips combine (audit web-app §16: "Pintura" + "Até R$ 50 mil"
// + "Bahia" at once). The URL keeps the on chips in `f` (comma list) and, from the search's "Em alta",
// any category in `category`; "Só autenticadas" is every work (the marketplace only lists authenticated
// ones) and clears the rest.
import { ARTWORK_CATEGORIES, ARTWORK_CATEGORY_LABELS, type ArtworkCategory } from '@/lib/artworks/domain'

export const PANEL_CHIPS = [
  { key: 'painting', label: 'Pintura' },
  { key: 'under50', label: 'Até R$ 50 mil' },
  { key: 'primary', label: 'Primário' },
  { key: 'ba', label: 'Bahia' },
] as const
export type PanelChip = (typeof PANEL_CHIPS)[number]['key']

export interface PanelFilter { chips: PanelChip[]; category: ArtworkCategory | null }

const isChip = (k: string): k is PanelChip => PANEL_CHIPS.some((c) => c.key === k)
const isCategory = (k: string): k is ArtworkCategory => (ARTWORK_CATEGORIES as readonly string[]).includes(k)

export function parsePanelFilter(sp: { f?: string; category?: string }): PanelFilter {
  const chips = [...new Set((sp.f ?? '').split(',').map((s) => s.trim()).filter(isChip))]
  const category = sp.category && isCategory(sp.category) && !chips.includes('painting') ? sp.category : null
  return { chips: PANEL_CHIPS.map((c) => c.key).filter((k) => chips.includes(k)), category }
}

/** The query of the public listing (the same filters /e/marketplace applies). */
export function panelQuery(f: PanelFilter): { category: string | null; maxPriceCents: bigint | null; market: string | null; uf: string | null } {
  return {
    category: f.chips.includes('painting') ? 'PAINTING' : f.category,
    maxPriceCents: f.chips.includes('under50') ? 5_000_000n : null,
    market: f.chips.includes('primary') ? 'PRIMARY' : null,
    uf: f.chips.includes('ba') ? 'BA' : null,
  }
}

function hrefOf(chips: PanelChip[], category: ArtworkCategory | null): string {
  const p = new URLSearchParams()
  if (chips.length) p.set('f', chips.join(','))
  if (category) p.set('category', category)
  const s = p.toString()
  return s ? `/marketplace?${s}` : '/marketplace'
}

/** Clicking a chip turns it on or off and keeps the others. */
export function toggleHref(f: PanelFilter, key: PanelChip): string {
  const on = f.chips.includes(key)
  const chips = on ? f.chips.filter((k) => k !== key) : PANEL_CHIPS.map((c) => c.key).filter((k) => k === key || f.chips.includes(k))
  // "Pintura" replaces a category that came from the search
  return hrefOf(chips, key === 'painting' && !on ? null : f.category)
}

/** The category chip from the search (removable), e.g. "Escultura". */
export function categoryChip(f: PanelFilter): { label: string; clearHref: string } | null {
  return f.category ? { label: ARTWORK_CATEGORY_LABELS[f.category], clearHref: hrefOf(f.chips, null) } : null
}

export const ALL_HREF = '/marketplace'
export const isAll = (f: PanelFilter) => f.chips.length === 0 && !f.category
