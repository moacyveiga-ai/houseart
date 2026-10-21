// Reference estimate (E.2 step 5) — pure. From the comparable prices of the
// same artist (and technique when there are enough) → min / suggested / max.
// Suggested = median; min = 80 %, max = 125 %, rounded to the nearest
// thousand reais. Fewer than MIN_COMPARABLES → no estimate (never a guess).
export const MIN_COMPARABLES = 1

export interface Estimate { minCents: bigint; suggestedCents: bigint; maxCents: bigint; count: number }

function roundThousand(cents: bigint): bigint {
  const unit = 100_000n
  return ((cents + unit / 2n) / unit) * unit
}

export function median(values: readonly bigint[]): bigint {
  const s = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const n = s.length
  if (n === 0) return 0n
  return n % 2 === 1 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2n
}

export function estimateFromComparables(prices: readonly bigint[]): Estimate | null {
  const valid = prices.filter((p) => p > 0n)
  if (valid.length < MIN_COMPARABLES) return null
  const suggested = roundThousand(median(valid))
  if (suggested <= 0n) return null
  return { minCents: roundThousand((suggested * 80n) / 100n), suggestedCents: suggested, maxCents: roundThousand((suggested * 125n) / 100n), count: valid.length }
}

/** The design's line: "Estimativa de referência com base em N vendas comparáveis. Não é laudo." */
export function estimateLine(e: Estimate): string {
  return `Estimativa de referência com base em ${e.count} venda${e.count === 1 ? '' : 's'} comparáve${e.count === 1 ? 'l' : 'is'}. Não é laudo.`
}

/** Short reais: R$ 17 mil, R$ 1,2 mi. */
export function shortBRL(cents: bigint): string {
  const reais = Number(cents / 100n)
  if (reais >= 1_000_000) return `R$ ${(reais / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi`
  if (reais >= 1_000) return `R$ ${Math.round(reais / 1_000).toLocaleString('pt-BR')} mil`
  return `R$ ${reais.toLocaleString('pt-BR')}`
}

/** The appraiser's range must be ordered and positive. */
export function validRange(r: { minCents: bigint; suggestedCents: bigint; maxCents: bigint }): string | null {
  if (r.minCents <= 0n || r.suggestedCents <= 0n || r.maxCents <= 0n) return 'Os três valores precisam ser positivos.'
  if (!(r.minCents <= r.suggestedCents && r.suggestedCents <= r.maxCents)) return 'Mínimo ≤ sugerido ≤ máximo.'
  return null
}
