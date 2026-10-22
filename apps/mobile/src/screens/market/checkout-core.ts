// Comprar direto (handoff "HouseArt App Colecionador" › sheet `checkout`) — PURE,
// the prototype's `ckCalc`: total = obra + frete + seguro; the shipping only
// with the carrier (pickup is free), the insurance optional. Cents as numbers.
import { brl } from '@/ui/format'

export type DeliveryMode = 'CARRIER' | 'PICKUP'

export interface CheckoutTotals { base: number; shipping: number; insurance: number; total: number }
export function checkoutTotals(i: { priceCents: number; delivery: DeliveryMode; shippingCents: number; insuranceCents: number; insurance: boolean }): CheckoutTotals {
  const carrier = i.delivery === 'CARRIER'
  const shipping = carrier ? Math.max(0, Math.round(i.shippingCents)) : 0
  const insurance = carrier && i.insurance ? Math.max(0, Math.round(i.insuranceCents)) : 0
  const base = Math.max(0, Math.round(i.priceCents))
  return { base, shipping, insurance, total: base + shipping + insurance }
}

/** "Obra" · "Frete" (Grátis) · "Seguro" (—) of the prototype `ckLinhas`. */
export const summaryLines = (t: CheckoutTotals) => [
  { k: 'Obra', v: brl(t.base) },
  { k: 'Frete', v: t.shipping ? brl(t.shipping) : 'Grátis' },
  { k: 'Seguro', v: t.insurance ? brl(t.insurance) : '—' },
]

/** `ckSeguroTxt` */
export function insuranceText(i: { delivery: DeliveryMode; insurance: boolean; insuranceCents: number; quoted: boolean }): string {
  if (i.delivery === 'PICKUP') return 'Na retirada com o vendedor o seguro de transporte não se aplica'
  if (!i.insurance) return 'Sem seguro, o risco do transporte é seu'
  return i.quoted ? `Cobre transporte e os primeiros 30 dias · ${brl(i.insuranceCents)}` : 'Cobre transporte e os primeiros 30 dias · informe o CEP'
}

/** Why the order cannot be confirmed yet (null = ready). */
export function blockedReason(i: { delivery: DeliveryMode; cepValid: boolean; hasCard: boolean }): string | null {
  if (!i.hasCard) return 'Adicione um cartão para pagar.'
  if (i.delivery === 'CARRIER' && !i.cepValid) return 'Informe o CEP de entrega para calcular frete e seguro.'
  return null
}

/** `ckCta`: "Pagar R$ X" with a card, else the prototype's call to add one. */
export const ctaLabel = (hasCard: boolean, total: number) => (hasCard ? `Pagar ${brl(total)}` : 'Adicionar cartão para pagar')
