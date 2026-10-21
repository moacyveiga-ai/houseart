// The MANDATE ENGINE — the offer against the seller's envelope (PURE).
// The floor (`reservePriceCents`) enters here and NEVER leaves: what comes
// out is the verdict and, at most, the counter-offer already computed.
//   AUTO_ACCEPT   negotiator on and offer ≥ autoAcceptMin × list price (and ≥ floor)
//   ABOVE_RESERVE offer ≥ floor: the seller decides (accept is always human unless the negotiator is on)
//   BELOW_RESERVE offer < floor: the seller sees it as "recebida"; the negotiator may counter with the list price × (1 − max discount) when that stays above the floor
export type Verdict = 'AUTO_ACCEPT' | 'ABOVE_RESERVE' | 'BELOW_RESERVE'

export interface MandateForEngine {
  listPriceCents: bigint
  reservePriceCents: bigint
  autoNegotiatorOn: boolean
  autoAcceptMinBps: number
  fixedPrice: boolean
}

export interface EngineResult {
  verdict: Verdict
  reachesReserve: boolean
  /** The only number that may leave: a counter-offer strictly above the floor, or none. */
  counterCents?: bigint
}

export const MAX_NEGOTIATOR_ROUNDS = 3

export function evaluateOffer(m: MandateForEngine, offeredCents: bigint, roundsEmitted = 0): EngineResult {
  const reachesReserve = offeredCents >= m.reservePriceCents
  const autoMin = (m.listPriceCents * BigInt(m.autoAcceptMinBps)) / 10000n
  if (m.autoNegotiatorOn && reachesReserve && offeredCents >= autoMin) return { verdict: 'AUTO_ACCEPT', reachesReserve }
  if (reachesReserve) return { verdict: 'ABOVE_RESERVE', reachesReserve }
  if (m.autoNegotiatorOn && !m.fixedPrice && roundsEmitted < MAX_NEGOTIATOR_ROUNDS) {
    // Counter at the auto-accept minimum (the number the seller already shows as "a partir de 92%"); never the floor.
    const counter = autoMin
    if (counter > m.reservePriceCents && counter > offeredCents) return { verdict: 'BELOW_RESERVE', reachesReserve, counterCents: counter }
  }
  return { verdict: 'BELOW_RESERVE', reachesReserve }
}

/** Keys that must NEVER appear in anything that leaves the platform (ratchet lib/offers/leak.test.ts). */
export const SECRET_KEYS = ['reservePriceCents', 'reserve', 'floor', 'riskAdjustedCents', 'closeProbability'] as const

/** The mandate as the seller's own screen shows it (the floor is the seller's — shown only to them). */
export function negotiatorLabel(m: { autoNegotiatorOn: boolean; autoAcceptMinBps: number }): string {
  return m.autoNegotiatorOn ? `Negociador automático: ligado · aceita ofertas a partir de ${Math.round(m.autoAcceptMinBps / 100)}% do preço pedido.` : 'Negociador automático: desligado.'
}

/** Mandate input validation: the floor at most the list price; the auto-accept minimum between 50 % and 100 %. */
export function mandateProblems(m: { listPriceCents: bigint; reservePriceCents: bigint; autoAcceptMinBps: number }): string[] {
  const out: string[] = []
  if (m.listPriceCents <= 0n) out.push('Informe o preço pedido.')
  if (m.reservePriceCents <= 0n) out.push('Informe o piso.')
  if (m.reservePriceCents > m.listPriceCents) out.push('O piso não pode passar do preço pedido.')
  if (m.autoAcceptMinBps < 5000 || m.autoAcceptMinBps > 10000) out.push('O mínimo do negociador fica entre 50% e 100%.')
  if ((m.listPriceCents * BigInt(m.autoAcceptMinBps)) / 10000n < m.reservePriceCents) out.push('O mínimo do negociador não pode ficar abaixo do piso.')
  return out
}
