// "Acervo" (handoff "HouseArt Web Galeria" › Acervo) — PURE: the chips over the
// statuses, the search over title / artist / certificate, the summary line and
// the status pill + stats line of each row.
import { ARTWORK_STATUS_LABELS, formatBRL, type ArtworkStatus } from '@/lib/artworks/domain'
import { saleAction } from '@/lib/deals/sale-progress-core'
import type { DealPhase } from '@/lib/deals/domain'

export interface InventoryItem {
  id: number; title: string; year: number | null; artistName: string; status: ArtworkStatus
  listPriceCents: bigint | string | null; saleMode: string | null; publicId: string | null; coverUrl: string | null
  /** Only LISTED works carry it (listingOf). */
  listing?: { views7d: number; openOffers: number; paused: boolean; saves?: number } | null
  /** Reserved / sold works: who bought and the step (dealLinesByArtwork). */
  deal?: { buyerName: string; phase: DealPhase; sellerSigned: boolean; exception: string | null } | null
}

export const INVENTORY_CHIPS: { key: string; name: string; statuses: readonly ArtworkStatus[] | null }[] = [
  { key: 'all', name: 'Todas', statuses: null },
  { key: 'listed', name: 'À venda', statuses: ['LISTED'] },
  { key: 'reserved', name: 'Reservadas', statuses: ['IN_DEAL'] },
  { key: 'sold', name: 'Vendidas', statuses: ['SOLD'] },
  { key: 'authenticated', name: 'Autenticadas', statuses: ['AUTHENTICATED'] },
  { key: 'certifying', name: 'Em certificação', statuses: ['IN_CERTIFICATION'] },
  { key: 'drafts', name: 'Rascunhos', statuses: ['DRAFT'] },
]

/** The Acervo URL of a chip and a search (the chip stays; an empty search drops `q`). */
export function inventoryHref(chip: string, q: string): string {
  const t = q.trim()
  return `/artworks?filter=${encodeURIComponent(chip)}${t ? `&q=${encodeURIComponent(t)}` : ''}`
}

export function chipKey(raw: string | undefined): string {
  return INVENTORY_CHIPS.some((c) => c.key === raw) ? (raw as string) : 'all'
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Title, artist or certificate id contain the query (accents and case ignored). */
export function matchesQuery(a: Pick<InventoryItem, 'title' | 'artistName' | 'publicId'>, q: string): boolean {
  const needle = fold(q.trim())
  if (!needle) return true
  return fold(`${a.title} ${a.artistName} ${a.publicId ?? ''}`).includes(needle)
}

export function filterInventory<T extends InventoryItem>(items: T[], chip: string, q: string): T[] {
  const c = INVENTORY_CHIPS.find((x) => x.key === chipKey(chip))!
  return items.filter((a) => (!c.statuses || c.statuses.includes(a.status)) && matchesQuery(a, q))
}

/** The counts of each chip over the whole inventory (before the search). */
export function chipCounts(items: Pick<InventoryItem, 'status'>[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const c of INVENTORY_CHIPS) out[c.key] = c.statuses ? items.filter((a) => c.statuses!.includes(a.status)).length : items.length
  return out
}

/** "12 obras · R$ 243.000 à venda" (the sum of the listed prices, like the prototype). */
export function summaryLine(items: Pick<InventoryItem, 'status' | 'listPriceCents'>[]): string {
  const n = items.length
  const forSale = items.filter((a) => a.status === 'LISTED' && a.listPriceCents !== null).reduce((s, a) => s + BigInt(a.listPriceCents!), 0n)
  return `${n} ${n === 1 ? 'obra' : 'obras'} · ${formatBRL(forSale)} à venda`
}

export type RowTone = 'verified' | 'pending' | 'sand' | 'neutral' | 'alert'

/** The status pill of the row (prototype `stOf`): paused listings read "Pausada". */
export function rowStatus(a: Pick<InventoryItem, 'status' | 'listing'>): { label: string; tone: RowTone } {
  if (a.status === 'LISTED') return a.listing?.paused ? { label: 'Pausada', tone: 'neutral' } : { label: 'À venda', tone: 'verified' }
  if (a.status === 'IN_DEAL') return { label: 'Reservada', tone: 'sand' }
  if (a.status === 'IN_CERTIFICATION') return { label: 'Em certificação', tone: 'pending' }
  if (a.status === 'STOLEN' || a.status === 'DISPUTED') return { label: ARTWORK_STATUS_LABELS[a.status], tone: 'alert' }
  return { label: ARTWORK_STATUS_LABELS[a.status], tone: 'neutral' }
}

/** The price cell: "Sob consulta" for on-request works, "—" without a price. */
export function rowPrice(a: Pick<InventoryItem, 'saleMode' | 'listPriceCents'>): string {
  if (a.saleMode === 'ON_REQUEST') return 'Sob consulta'
  return formatBRL(a.listPriceCents === null ? null : BigInt(a.listPriceCents))
}

/** The third line of the row: engagement for listed works, the next step for the others. */
export function rowStats(a: Pick<InventoryItem, 'status' | 'listing' | 'deal'>): string {
  switch (a.status) {
    case 'LISTED': {
      const l = a.listing
      if (!l) return 'Sem visualizações ainda'
      const saves = l.saves !== undefined ? ` · ${l.saves} ${l.saves === 1 ? 'salvo' : 'salvos'}` : ''
      const offers = l.openOffers ? ` · ${l.openOffers} ${l.openOffers === 1 ? 'oferta' : 'ofertas'}` : ''
      return `${l.views7d.toLocaleString('pt-BR')} views · 7 dias${saves}${offers}`
    }
    // before the escrow is paid the work is only reserved (a lapsed Pix/boleto gives it back to the market)
    case 'IN_DEAL': return a.deal ? `${a.deal.phase === 'OFFER_ACCEPTED' ? 'Reservada' : 'Vendida'} para ${a.deal.buyerName} · ${saleAction(a.deal).label.toLowerCase()}` : 'Negócio em andamento'
    case 'IN_CERTIFICATION': return 'Vincule a etiqueta e assine o certificado'
    case 'AUTHENTICATED': return 'Liste no marketplace para vender'
    case 'DRAFT': return 'Peça a certificação para anunciar'
    case 'SOLD': return a.deal ? `Vendida para ${a.deal.buyerName}` : 'Vendida'
    default: return ARTWORK_STATUS_LABELS[a.status]
  }
}

/** The empty state: the prototype's text, or the search variant. */
export function emptyText(q: string): string {
  return q.trim() ? `Nenhuma obra para “${q.trim()}”.` : 'Nenhuma obra neste filtro.'
}
