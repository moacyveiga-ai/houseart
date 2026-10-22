// "Comprar direto" (handoff App Colecionador › sheet `checkout`) — PURE.
// Mirrors the prototype's `ckCalc`: total = work + shipping + insurance; the
// shipping only with a carrier (pickup is free), the insurance optional. The
// numbers are cents as JS numbers (the island receives BigInt as strings).

export type DeliveryMode = 'CARRIER' | 'PICKUP'

export interface CheckoutInput {
  priceCents: number
  delivery: DeliveryMode
  /** The frozen quote for the CEP typed (0 while there is none). */
  shippingCents: number
  insuranceCents: number
  insurance: boolean
}

export interface CheckoutTotals { base: number; shipping: number; insurance: number; total: number }

export function checkoutTotals(i: CheckoutInput): CheckoutTotals {
  const carrier = i.delivery === 'CARRIER'
  const shipping = carrier ? Math.max(0, Math.round(i.shippingCents)) : 0
  const insurance = carrier && i.insurance ? Math.max(0, Math.round(i.insuranceCents)) : 0
  const base = Math.max(0, Math.round(i.priceCents))
  return { base, shipping, insurance, total: base + shipping + insurance }
}

export interface SummaryLine { key: string; label: string; value: string }

/** The three lines of the prototype ("Obra", "Frete" — "Grátis" when 0 —, "Seguro" — "—" when off). */
export function summaryLines(t: CheckoutTotals, format: (cents: number) => string, negotiated = false): SummaryLine[] {
  return [
    { key: 'work', label: negotiated ? 'Obra · valor negociado' : 'Obra', value: format(t.base) },
    { key: 'shipping', label: 'Frete', value: t.shipping ? format(t.shipping) : 'Grátis' },
    { key: 'insurance', label: 'Seguro', value: t.insurance ? format(t.insurance) : '—' },
  ]
}

/** Text under "Seguro parede a parede" (prototype `ckSeguroTxt`). */
export function insuranceText(i: { delivery: DeliveryMode; insurance: boolean; insuranceCents: number; quoted: boolean }, format: (cents: number) => string): string {
  if (i.delivery === 'PICKUP') return 'Na retirada com o vendedor o seguro de transporte não se aplica'
  if (!i.insurance) return 'Sem seguro, o risco do transporte é seu'
  return i.quoted ? `Cobre transporte e os primeiros 30 dias · ${format(i.insuranceCents)}` : 'Cobre transporte e os primeiros 30 dias · informe o CEP'
}

export interface ReadyInput { delivery: DeliveryMode; cepValid: boolean; hasCard: boolean }

/** Why the order cannot be confirmed yet (null = ready). */
export function blockedReason(i: ReadyInput): string | null {
  if (!i.hasCard) return 'Adicione um cartão para pagar.'
  if (i.delivery === 'CARRIER' && !i.cepValid) return 'Informe o CEP de entrega para calcular frete e seguro.'
  return null
}

/** The primary button label: "Confirmar pedido · R$ …" when a card is selected, else the prototype's call to add one. */
export function ctaLabel(i: { hasCard: boolean; total: number }, format: (cents: number) => string): string {
  return i.hasCard ? `Confirmar pedido · ${format(i.total)}` : 'Adicionar cartão para pagar'
}

// ── card form masks (prototype `onNcNum` / `onNcExp` / `onNcCep`) ────────
export function maskCardNumber(raw: string, brand: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, brand === 'amex' ? 15 : 16)
  const groups = brand === 'amex' ? [4, 6, 5] : [4, 4, 4, 4]
  const parts: string[] = []
  let j = 0
  for (const g of groups) { if (j < digits.length) parts.push(digits.slice(j, j + g)); j += g }
  return parts.join(' ')
}

export function maskExpiry(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
}

export function maskCep(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

/** Card preview number: typed digits followed by dots, in the brand's groups. */
export function previewCardNumber(masked: string, brand: string): string {
  const digits = masked.replace(/\D/g, '')
  const len = brand === 'amex' ? 15 : 16
  const padded = (digits + '•'.repeat(len)).slice(0, len)
  const groups = brand === 'amex' ? [4, 6, 5] : [4, 4, 4, 4]
  const parts: string[] = []
  let j = 0
  for (const g of groups) { parts.push(padded.slice(j, j + g)); j += g }
  return parts.join(' ')
}
