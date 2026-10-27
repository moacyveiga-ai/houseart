// "Faixa sugerida" of the sell sheet (handoff Web Colecionador › Vender uma obra) — PURE.
// The middle half of the artist's completed sales in the last 12 months. Sales of other people
// are private, so the range is coarse on purpose: six sales at least, interpolated quartiles (an
// end is never one sale's price) and ends rounded outwards to a step that grows with the price
// (5 % of the median, never under R$ 1.000).

export const MIN_SALES_FOR_RANGE = 6
const MIN_STEP = 100_000n // R$ 1.000

/** Linear-interpolated percentile of sorted values (0 ≤ p ≤ 1), in whole cents. */
function percentile(sorted: bigint[], p: number): bigint {
  const pos = p * (sorted.length - 1)
  const lo = Math.floor(pos), hi = Math.ceil(pos)
  if (lo === hi) return sorted[lo]!
  const w = BigInt(Math.round((pos - lo) * 1000))
  return (sorted[lo]! * (1000n - w) + sorted[hi]! * w) / 1000n
}

/** The rounding step: 5 % of the median, in multiples of R$ 1.000, at least R$ 1.000. */
export function stepOf(median: bigint): bigint {
  const raw = median / 20n
  const step = (raw / MIN_STEP) * MIN_STEP
  return step < MIN_STEP ? MIN_STEP : step
}

/** p25..p75 of the sale amounts, the low end rounded down and the high end up; null under six sales. */
export function suggestedRange(amounts: readonly bigint[]): { lowCents: bigint; highCents: bigint; count: number } | null {
  const valid = amounts.filter((a) => a > 0n)
  if (valid.length < MIN_SALES_FOR_RANGE) return null
  const sorted = [...valid].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
  const step = stepOf(percentile(sorted, 0.5))
  const lo = percentile(sorted, 0.25), hi = percentile(sorted, 0.75)
  const low = (lo / step) * step
  let high = ((hi + step - 1n) / step) * step
  if (high <= low) high = low + step
  return { lowCents: low, highCents: high, count: valid.length }
}

const brl = (c: bigint) => Number(c / 100n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

/** "Faixa sugerida para Lia Santana: R$ 27.000 a R$ 33.000, com base em 6 vendas registradas na HouseArt nos últimos 12 meses." */
export function rangeLine(artist: string, r: { lowCents: bigint; highCents: bigint; count: number }): string {
  return `Faixa sugerida para ${artist}: ${brl(r.lowCents)} a ${brl(r.highCents)}, com base em ${r.count} vendas registradas na HouseArt nos últimos 12 meses.`
}
