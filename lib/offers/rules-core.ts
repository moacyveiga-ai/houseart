// Gallery-wide offer rules (Phase 6) — PURE. Lives in lib/offers because the
// offer flow applies them; lib/gallery edits them (gallery → offers, never back).
export const REFUSE_BELOW_OPTIONS = [6000, 7000, 8000] as const
export const RESPONSE_HOURS_OPTIONS = [24, 48, 72] as const

export interface OfferRulesView { refuseLow: boolean; refuseBelowBps: number; autoAcceptOn: boolean; autoAcceptMinBps: number; responseHours: number; notifyTeam: boolean }
export const DEFAULT_RULES: OfferRulesView = { refuseLow: true, refuseBelowBps: 7000, autoAcceptOn: false, autoAcceptMinBps: 9500, responseHours: 48, notifyTeam: true }

export function rulesProblems(r: OfferRulesView): string[] {
  const out: string[] = []
  if (!(REFUSE_BELOW_OPTIONS as readonly number[]).includes(r.refuseBelowBps)) out.push('O mínimo para recusar fica em 60, 70 ou 80 %.')
  if (r.autoAcceptMinBps < 5000 || r.autoAcceptMinBps > 10000) out.push('O mínimo do aceite automático fica entre 50 % e 100 %.')
  if (!(RESPONSE_HOURS_OPTIONS as readonly number[]).includes(r.responseHours)) out.push('O prazo para responder é 24, 48 ou 72 h.')
  return out
}

/** The gentle refusal the buyer reads when an offer falls under the gallery's minimum. */
export const LOW_OFFER_MESSAGE = 'Obrigado pelo interesse. Esta oferta ficou abaixo do que a galeria aceita para esta obra; você pode enviar outra proposta ou comprar ao preço pedido.'

/** Is the offer below the rule? (pure; bps of the list price) */
export function belowRule(offeredCents: bigint, listPriceCents: bigint, refuseBelowBps: number): boolean {
  if (listPriceCents <= 0n) return false
  return offeredCents * 10000n < listPriceCents * BigInt(refuseBelowBps)
}

