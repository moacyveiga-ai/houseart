// "Gestão do anúncio" (handoff "HouseArt Web Galeria" › obra › Gestão do anúncio) — PURE.
// The price mask of the prototype (`fmtN`/`num`: digits only, pt-BR thousands), the
// "did it change?" that lights the Salvar button, the toggle texts and the share message.

/** Digits of what was typed → integer reais (0 when empty). */
export function priceReais(raw: string): number {
  return parseInt(String(raw ?? '').replace(/\D/g, ''), 10) || 0
}

/** The mask of the input: "38000" → "38.000"; empty when zero. */
export function priceMask(raw: string | number): string {
  const n = typeof raw === 'number' ? Math.max(0, Math.floor(raw)) : priceReais(raw)
  return n ? n.toLocaleString('pt-BR') : ''
}

/** Cents of the masked input (whole reais only, like the prototype). */
export function priceCents(masked: string): bigint {
  return BigInt(priceReais(masked)) * 100n
}

/** Salvar lights up only when the typed price is positive and differs from the current one. */
export function priceChanged(masked: string, currentCents: bigint | string): boolean {
  const typed = priceCents(masked)
  return typed > 0n && typed !== BigInt(currentCents)
}

/** The toast after saving: the prototype distinguishes a reduction (people who saved are told) from an update. */
export function priceSavedMessage(nextCents: bigint, previousCents: bigint, notified = 0): string {
  if (nextCents >= previousCents) return 'Preço atualizado'
  if (notified <= 0) return 'Preço reduzido'
  return `Preço reduzido · ${notified === 1 ? '1 pessoa que salvou foi avisada' : `${notified} pessoas que salvaram foram avisadas`}`
}

export interface ToggleRules { refuseBelowBps: number; responseHours: number }

/** Sub-text of "Aceita ofertas": the gallery rules when on, "Só compra direta" when off. */
export function acceptsOffersSub(on: boolean, rules: ToggleRules | null): string {
  if (!on) return 'Só compra direta'
  if (!rules) return 'Ofertas pelas regras da galeria'
  return `Regras: recusa abaixo de ${Math.round(rules.refuseBelowBps / 100)}% · prazo ${rules.responseHours} h`
}

/** Sub-text of "Pausar anúncio". Pausing keeps the mandate, the offers and the reactions (likes and saves). */
export function pausedSub(paused: boolean): string {
  return paused ? 'Fora do marketplace · curtidas, salvos e ofertas mantidos' : 'Some do marketplace sem perder curtidas nem ofertas'
}

export function pauseToggledMessage(nowPaused: boolean): string {
  return nowPaused ? 'Anúncio pausado' : 'Anúncio de volta ao marketplace'
}

export function listingStats(s: { views7d: number; openOffers: number; saves: number; likes: number }): { value: string; label: string }[] {
  return [
    { value: s.views7d.toLocaleString('pt-BR'), label: 'views · 7 dias' },
    { value: s.saves.toLocaleString('pt-BR'), label: 'salvos' },
    { value: s.likes.toLocaleString('pt-BR'), label: 'curtidas' },
    { value: String(s.openOffers), label: s.openOffers === 1 ? 'oferta' : 'ofertas' },
  ]
}
