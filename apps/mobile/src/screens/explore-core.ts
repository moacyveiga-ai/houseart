// Explorar (handoff "HouseArt App Colecionador" › Explorar · feed / descobrir): the
// chips `CATS` and the filter `passa` of the prototype, over the API items. Pure.
import type { ExploreItem } from '@/api/types'

export const EXPLORE_CHIPS = [
  { key: 'all', label: 'Tudo' },
  { key: 'PAINTING', label: 'Pintura' },
  { key: 'PHOTOGRAPHY', label: 'Fotografia' },
  { key: 'SCULPTURE', label: 'Escultura' },
  { key: 'PRINT', label: 'Gravura' },
  { key: 'DRAWING', label: 'Desenho' },
  { key: 'upto10k', label: 'Até R$ 10 mil' },
  { key: 'offers', label: 'Aceita ofertas' },
] as const
export type ExploreChip = (typeof EXPLORE_CHIPS)[number]['key']

/** The prototype's `aceita`: the listing accepts offers. */
export const acceptsOffers = (saleMode: string | null): boolean => saleMode === 'FIXED_WITH_OFFERS'

export function passesChip(item: ExploreItem, chip: ExploreChip): boolean {
  if (chip === 'all') return true
  if (chip === 'upto10k') return item.priceCents !== null && Number(item.priceCents) <= 1_000_000
  if (chip === 'offers') return acceptsOffers(item.saleMode)
  return item.category === chip
}

/** "3 de 12 · arraste para a direita para curtir" of the deck. */
export const deckCounter = (index: number, total: number): string => `${Math.min(index + 1, total)} de ${total} · arraste para a direita para curtir`
