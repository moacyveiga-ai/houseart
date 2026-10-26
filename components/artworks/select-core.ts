// "Minhas obras" › seleção múltipla (handoff "Web Artista" › Minhas obras: a
// caixa em cada cartão e a barra "N obras selecionadas · Solicitar etiquetas ·
// Listar no marketplace · ×"). PURE: o que a seleção permite e o corpo do
// listar em lote — a tela só mostra o que a rota aceitaria.
import type { ArtworkStatus } from '@/lib/artworks/domain'
import { canTransition } from '@/lib/artworks/state-machine'
import { mandateProblems } from '@/lib/offers/mandate-core'

export interface SelectableWork {
  id: number; title: string; year: number | null; status: ArtworkStatus; seal: string
  /** The certificate id: a work with one already has its marker linked. */
  publicId: string | null
  /** As string (BigInt never crosses the RSC boundary). */
  listPriceCents: string | null
}

/** "1 obra selecionada" / "3 obras selecionadas". */
export function selectionText(n: number): string {
  return `${n} ${n === 1 ? 'obra selecionada' : 'obras selecionadas'}`
}

/** A work still before the marker: in certification (or a draft about to go) and no certificate id yet. */
export function needsMarker(w: Pick<SelectableWork, 'status' | 'publicId'>): boolean {
  return (w.status === 'DRAFT' || w.status === 'IN_CERTIFICATION') && !w.publicId
}

/** The same guard as `listArtworkForSale`: AUTHENTICATED with the GREEN seal. */
export function canList(w: Pick<SelectableWork, 'status' | 'seal'>): boolean {
  return canTransition(w.status, 'LISTED', { seal: w.seal }).ok
}

export interface SelectionSummary {
  text: string
  /** How many selected works would use a marker (the quantity the kit order starts with). */
  markers: number
  listable: SelectableWork[]
  /** Selected works the marketplace would refuse (no green seal, already listed, sold…). */
  notListable: number
}

export function summarize(selected: SelectableWork[]): SelectionSummary {
  const listable = selected.filter(canList)
  return { text: selectionText(selected.length), markers: selected.filter(needsMarker).length, listable, notListable: selected.length - listable.length }
}

/** The message under the bar's buttons when a click would do nothing. */
export const EMPTY_MARKERS = 'Nenhuma obra selecionada está esperando etiqueta.'
export const EMPTY_LISTABLE = 'Nenhuma obra selecionada pode ir ao marketplace: só obras autenticadas com o selo verde.'

/** Reais typed by hand ("12.500", "R$ 12500", "12500") → cents; empty or zero → null. Same reading as the single dialog. */
export function reaisToCents(s: string): bigint | null {
  const digits = s.replace(/\D/g, '')
  if (!digits) return null
  const n = BigInt(digits) * 100n
  return n > 0n ? n : null
}

export interface BatchRow { id: number; listPrice: string; reservePrice: string }
export interface BatchShared { fixedPrice: boolean; autoNegotiatorOn: boolean; autoAcceptMin: string }
export interface BatchItem { id: number; body: { listPriceCents: string; reservePriceCents: string; autoNegotiatorOn: boolean; autoAcceptMinBps: number; fixedPrice: boolean } }

/**
 * The body of each `POST /api/artworks/[id]/list` of the batch, validated row by row with the
 * mandate's own rules (floor ≤ price, negotiator minimum ≥ floor). The first problem names the row.
 */
export function batchPayload(rows: BatchRow[], shared: BatchShared, titles: Map<number, string>): { ok: true; items: BatchItem[] } | { ok: false; error: string } {
  if (rows.length === 0) return { ok: false, error: 'Nenhuma obra para listar.' }
  const pct = Number(shared.autoAcceptMin.replace(',', '.'))
  if (!shared.fixedPrice && (!Number.isFinite(pct) || pct < 1 || pct > 100)) return { ok: false, error: 'O mínimo do negociador é um percentual entre 1 e 100.' }
  // fixed price: no negotiator, and the minimum is the price itself (the mandate's rule "minimum ≥ floor" then never bites)
  const autoAcceptMinBps = shared.fixedPrice ? 10000 : Math.round(pct * 100)
  const items: BatchItem[] = []
  for (const r of rows) {
    const name = titles.get(r.id) ?? `#${r.id}`
    const listPriceCents = reaisToCents(r.listPrice)
    if (listPriceCents === null) return { ok: false, error: `Informe o preço pedido de "${name}".` }
    const reservePriceCents = reaisToCents(r.reservePrice)
    if (reservePriceCents === null) return { ok: false, error: `Informe o piso de "${name}".` }
    const problems = mandateProblems({ listPriceCents, reservePriceCents, autoAcceptMinBps })
    if (problems.length) return { ok: false, error: `"${name}": ${problems.join(' ')}` }
    items.push({ id: r.id, body: { listPriceCents: listPriceCents.toString(), reservePriceCents: reservePriceCents.toString(), autoNegotiatorOn: shared.fixedPrice ? false : shared.autoNegotiatorOn, autoAcceptMinBps, fixedPrice: shared.fixedPrice } })
  }
  return { ok: true, items }
}

/** "3 obras listadas" / "2 obras listadas · 1 não foi". */
export function batchResultText(ok: number, failed: number): string {
  const listed = `${ok} ${ok === 1 ? 'obra listada' : 'obras listadas'}`
  if (!failed) return listed
  return `${listed} · ${failed} ${failed === 1 ? 'não foi' : 'não foram'}`
}
