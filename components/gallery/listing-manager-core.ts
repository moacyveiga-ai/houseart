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
export function priceSavedMessage(nextCents: bigint, previousCents: bigint): string {
  return nextCents < previousCents ? 'Preço reduzido' : 'Preço atualizado'
}

export interface ToggleRules { refuseBelowBps: number; responseHours: number }

/** Sub-text of "Aceita ofertas": the gallery rules when on, "Só compra direta" when off. */
export function acceptsOffersSub(on: boolean, rules: ToggleRules | null): string {
  if (!on) return 'Só compra direta'
  if (!rules) return 'Ofertas pelas regras da galeria'
  return `Regras: recusa abaixo de ${Math.round(rules.refuseBelowBps / 100)}% · prazo ${rules.responseHours} h`
}

/** Sub-text of "Pausar anúncio". The product keeps the mandate and the offers while paused (no likes/saves yet). */
export function pausedSub(paused: boolean): string {
  return paused ? 'Fora do marketplace · mandato e ofertas mantidos' : 'Some do marketplace sem perder o mandato'
}

export function pauseToggledMessage(nowPaused: boolean): string {
  return nowPaused ? 'Anúncio pausado' : 'Anúncio de volta ao marketplace'
}

/** "Enviar a um cliente": the prototype's message plus the public link. */
export function shareMessage(a: { title: string; artistName: string }, publicUrl: string): string {
  return `Separei esta obra para você: ${a.title}, de ${a.artistName}. Qualquer dúvida, é só responder. ${publicUrl}`
}

export function publicArtworkPath(publicId: string): string {
  return `/e/artwork/${encodeURIComponent(publicId)}`
}

/** The four stats of the block; saves and likes do not exist yet ("—"). */
export function listingStats(s: { views7d: number; openOffers: number; saves: number; likes: number }): { value: string; label: string }[] {
  return [
    { value: s.views7d.toLocaleString('pt-BR'), label: 'views · 7 dias' },
    { value: s.saves.toLocaleString('pt-BR'), label: 'salvos' },
    { value: s.likes.toLocaleString('pt-BR'), label: 'curtidas' },
    { value: String(s.openOffers), label: s.openOffers === 1 ? 'oferta' : 'ofertas' },
  ]
}
