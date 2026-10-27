// "Valorização" of the collection header (HouseArt Web Colecionador › Coleção:
// "+17,5 %" and "Valor estimado hoje: R$ 37.240 · não substitui um laudo") — PURE.
// Only works with BOTH a registered value and an estimate count, so a work with
// no reference never drags the percentage to −100 % or inflates it.

export interface WorkValue { registeredCents: bigint | null; estimateCents: bigint | null }
export interface CollectionValuation { registeredCents: bigint; estimatedCents: bigint; changeBps: number; works: number }

export function collectionValuation(works: readonly WorkValue[]): CollectionValuation | null {
  let registered = 0n
  let estimated = 0n
  let n = 0
  for (const w of works) {
    if (!w.registeredCents || w.registeredCents <= 0n || !w.estimateCents || w.estimateCents <= 0n) continue
    registered += w.registeredCents
    estimated += w.estimateCents
    n += 1
  }
  if (!n) return null
  return { registeredCents: registered, estimatedCents: estimated, changeBps: Number(((estimated - registered) * 10_000n) / registered), works: n }
}

/** The change as the label shows it (one decimal of a percent): −4 bps is "0 %", never "−0 %". */
export function shownBps(bps: number): number {
  return Math.round(bps / 10) * 10
}

/** "+17,5 %", "−3,2 %", "0 %". */
export function changeLabel(raw: number): string {
  const bps = shownBps(raw)
  if (bps === 0) return '0 %'
  const v = (Math.abs(bps) / 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  return `${bps > 0 ? '+' : '−'}${v} %`
}

/** The note under the KPIs; says how many works the number covers when it is not all of them. */
export function valuationNote(v: CollectionValuation, totalWorks: number, format: (cents: bigint) => string): string {
  const cover = v.works < totalWorks ? ` · ${v.works} de ${totalWorks} obras com referência` : ''
  return `Valor estimado hoje: ${format(v.estimatedCents)}${cover} · não substitui um laudo`
}
