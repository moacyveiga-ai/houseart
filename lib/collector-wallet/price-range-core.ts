// "Faixa sugerida" of the sell sheet (handoff Web Colecionador › Vender uma obra) — PURE.
// The middle half of the artist's completed sales in the last 12 months, shown only with at
// least five sales: with three, p25 and p75 are the cheapest and the dearest sale themselves.

export const MIN_SALES_FOR_RANGE = 5
const STEP = 50_000n // R$ 500

/** The nearest-rank percentile of sorted values (0 < p ≤ 1). */
function percentile(sorted: bigint[], p: number): bigint {
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1))
  return sorted[i]!
}

/** p25..p75 of the sale amounts, the low end rounded down and the high end up to R$ 500; null under five sales. */
export function suggestedRange(amounts: readonly bigint[]): { lowCents: bigint; highCents: bigint; count: number } | null {
  const valid = amounts.filter((a) => a > 0n)
  if (valid.length < MIN_SALES_FOR_RANGE) return null
  const sorted = [...valid].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const lo = percentile(sorted, 0.25), hi = percentile(sorted, 0.75)
  const low = (lo / STEP) * STEP
  const high = ((hi + STEP - 1n) / STEP) * STEP
  return { lowCents: low, highCents: high < low ? low : high, count: valid.length }
}

const brl = (c: bigint) => Number(c / 100n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

/** "Faixa sugerida para Lia Santana: R$ 27.000 a R$ 33.000, com base em 6 vendas registradas nos últimos 12 meses." */
export function rangeLine(artist: string, r: { lowCents: bigint; highCents: bigint; count: number }): string {
  const span = r.lowCents === r.highCents ? brl(r.lowCents) : `${brl(r.lowCents)} a ${brl(r.highCents)}`
  return `Faixa sugerida para ${artist}: ${span}, com base em ${r.count} vendas registradas na HouseArt nos últimos 12 meses.`
}
