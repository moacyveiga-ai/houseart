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

export type PayMethod = 'PIX' | 'CARD' | 'BOLETO'
/** The three ways of the prototype (`ckPags`), in its order. */
export const PAY_METHODS: { key: PayMethod; name: string; sub: string; icon: string }[] = [
  { key: 'PIX', name: 'Pix', sub: 'aprovação na hora', icon: 'qr_code_2' },
  { key: 'CARD', name: 'Cartão', sub: 'cobrado agora, em garantia', icon: 'credit_card' },
  { key: 'BOLETO', name: 'Boleto', sub: '1 dia útil', icon: 'receipt_long' },
]

export interface ReadyInput { delivery: DeliveryMode; cepValid: boolean; hasCard: boolean; method?: PayMethod; boletoProblem?: string | null; /** the CEP was typed but did not quote */ cepFailed?: boolean }

/** Why the order cannot be confirmed yet (null = ready). */
export function blockedReason(i: ReadyInput): string | null {
  const method = i.method ?? 'CARD'
  if (method === 'CARD' && !i.hasCard) return 'Adicione um cartão para pagar.'
  if (i.delivery === 'CARRIER' && !i.cepValid) return i.cepFailed ? 'Não foi possível calcular o frete deste CEP. Confira o CEP ou escolha outro endereço.' : 'Informe o CEP de entrega para calcular frete e seguro.'
  if (method === 'BOLETO' && i.boletoProblem) return i.boletoProblem
  return null
}

/** The primary button (prototype `ckCta`): "Pagar R$ … com Pix" / "no boleto"; the card says "Confirmar pedido" or asks for a card. */
export function ctaLabel(i: { hasCard: boolean; total: number; method?: PayMethod }, format: (cents: number) => string): string {
  const method = i.method ?? 'CARD'
  if (method === 'PIX') return `Pagar ${format(i.total)} com Pix`
  if (method === 'BOLETO') return `Pagar ${format(i.total)} no boleto`
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

/** A saved delivery address offered at checkout (Perfil › Endereços de entrega). */
export interface CheckoutAddress { id: number; label: string; line: string; cep: string; isDefault: boolean }

/** The address the checkout opens on: the default one, else the first; none → the CEP field. */
export function initialAddressId(addresses: readonly CheckoutAddress[]): number | null {
  return (addresses.find((a) => a.isDefault) ?? addresses[0])?.id ?? null
}
