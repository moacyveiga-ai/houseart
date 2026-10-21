// Offers ("proposta/proponente/contraproposta" — never auction words). Pure.
export const OFFER_STATUSES = ['DRAFT', 'AWAITING_OTP', 'RECEIVED', 'BELOW_RESERVE', 'NEGOTIATING', 'ACCEPTED', 'IN_DEAL', 'CONVERTED', 'REFUSED', 'EXPIRED', 'RETRACTED', 'CANCELLED'] as const
export type OfferStatus = (typeof OFFER_STATUSES)[number]

/** Statuses where the seller still has to answer. */
export const OPEN_FOR_SELLER: readonly OfferStatus[] = ['RECEIVED', 'BELOW_RESERVE', 'NEGOTIATING']
/** Statuses that count as "live" (lock the artwork against a second accept). */
export const LIVE_STATUSES: readonly OfferStatus[] = ['ACCEPTED', 'IN_DEAL']

export const OFFER_STATUS_LABELS: Record<OfferStatus, string> = {
  DRAFT: 'Rascunho', AWAITING_OTP: 'Aguardando confirmação', RECEIVED: 'Recebida', BELOW_RESERVE: 'Recebida', NEGOTIATING: 'Em negociação',
  ACCEPTED: 'Aceita · venda em andamento', IN_DEAL: 'Em negócio', CONVERTED: 'Concluída', REFUSED: 'Recusada', EXPIRED: 'Expirada', RETRACTED: 'Retratada', CANCELLED: 'Cancelada',
}

export const OFFER_VALIDITY_DAYS = 7
export const OTP_TTL_MS = 15 * 60_000
export const OTP_MAX_ATTEMPTS = 3
export const RETRACTION_WINDOW_MS = 24 * 3_600_000

export function offerCode(year: number, seq: number): string {
  return `OFR-${year}-${String(seq).padStart(6, '0')}`
}

/** "pedido R$ 44.000 · −7%" — the difference to the list price, in whole percent. */
export function differencePct(offeredCents: bigint, listPriceCents: bigint): number {
  if (listPriceCents <= 0n) return 0
  return Math.round(Number(((offeredCents - listPriceCents) * 10000n) / listPriceCents) / 100)
}

export function formatDifference(pct: number): string {
  return pct === 0 ? 'no preço pedido' : `${pct > 0 ? '+' : '−'}${Math.abs(pct)}%`
}

/** Who the seller sees: never the buyer's document, never the e-mail. */
export function buyerLabel(o: { buyerKind: string; buyerCity: string | null; buyerName: string; buyerVerified: boolean }): string {
  if (o.buyerKind === 'ADVISOR_FOR_CLIENT') return `Consultor(a) ${o.buyerName}, para cliente`
  const who = o.buyerVerified ? 'Colecionador verificado' : 'Colecionador'
  return o.buyerCity ? `${who}, ${o.buyerCity}` : who
}

export function expiresLabel(expiresAt: Date, now: Date): string {
  const ms = expiresAt.getTime() - now.getTime()
  if (ms <= 0) return 'expirada'
  const h = Math.ceil(ms / 3_600_000)
  if (h < 48) return `${h} h`
  return `${Math.ceil(h / 24)} dias`
}
