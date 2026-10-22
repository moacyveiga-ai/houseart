// The calls of the offer, the purchase and the wallet cards (fase 2 do App
// Colecionador). Thin wrappers over `api()`: the server is the authority on
// every rule; these only name the routes and their bodies.
import { api } from './client'
import type { BuyerOfferView, GuaranteeMethod, IdentityView, PaymentMethodView } from './types'

export interface ShippingQuote { cep: string; shippingCents: number; insuranceCents: number }

/** GET /api/public/shipping-quote — null when the CEP is not a full one the server prices. */
export async function shippingQuote(publicId: string, cep: string, priceCents: number): Promise<ShippingQuote | null> {
  const digits = cep.replace(/\D/g, '')
  if (digits.length !== 8) return null
  const r = await api<{ ok: boolean; cep: string | null; shippingCents: string; insuranceCents: string }>(`/api/public/shipping-quote?publicId=${encodeURIComponent(publicId)}&cep=${digits}&priceCents=${priceCents}`)
  return r.ok && r.cep ? { cep: r.cep, shippingCents: Number(r.shippingCents), insuranceCents: Number(r.insuranceCents) } : null
}

export const listCards = async (): Promise<PaymentMethodView[]> => (await api<{ ok: boolean; methods: PaymentMethodView[] }>('/api/collector/payment-methods')).methods ?? []

export interface CardInput { number: string; exp: string; cvc: string; holder: string; cep: string }
export async function addCard(input: CardInput, makeDefault: boolean): Promise<PaymentMethodView> {
  return (await api<{ ok: boolean; method: PaymentMethodView }>('/api/collector/payment-methods', { body: { ...input, makeDefault } })).method
}

export const identity = async (): Promise<IdentityView> => (await api<{ ok: boolean; identity: IdentityView }>('/api/auth/identity')).identity
export async function setIdentity(input: { cpf?: string; city?: string }): Promise<IdentityView> {
  return (await api<{ ok: boolean; identity: IdentityView }>('/api/auth/identity', { method: 'PATCH', body: input })).identity
}
export const startPhone = (phone: string) => api<{ ok: boolean; token: string; phoneMask: string; echo?: string }>('/api/auth/phone/start', { body: { phone } })
export const verifyPhone = (token: string, code: string) => api<{ ok: boolean }>('/api/auth/phone/verify', { body: { token, code } })

export interface OfferInput { publicId: string; buyerName: string; buyerEmail: string; buyerDocument?: string; buyerCity?: string; offeredCents: number; message?: string; validityHours: number; guaranteeMethod: GuaranteeMethod; paymentMethodId?: number; deliveryCep?: string }
/** POST /api/public/offers — a logged buyer with a proven e-mail comes back `confirmed` (no code). */
export const startOffer = (input: OfferInput) => api<{ ok: boolean; code: string; confirmed: boolean; message?: string }>('/api/public/offers', { body: input })
export const confirmOffer = (code: string, otp: string) => api<{ ok: boolean; code: string }>(`/api/public/offers/${encodeURIComponent(code)}/confirm`, { body: { otp } })

export const buyerOffer = async (code: string): Promise<BuyerOfferView> => (await api<{ ok: boolean; offer: BuyerOfferView }>(`/api/collector/offers/${encodeURIComponent(code)}`)).offer
/** The logged buyer answers the seller's counter: accept, or a new amount (never above the counter). */
export const replyOffer = (code: string, reply: { accept: true } | { accept: false; amountCents: number; message?: string }) => api<{ ok: boolean }>(`/api/public/offers/${encodeURIComponent(code)}/reply`, { body: reply })
export const retractOffer = (code: string) => api<{ ok: boolean }>(`/api/public/offers/${encodeURIComponent(code)}/retract`, { body: {} })

export interface CheckoutInput { publicId: string; paymentMethodId: number; deliveryCep: string | null; insurance: boolean }
/** POST /api/public/checkout — the list price captured in escrow (mock) on the saved card. */
export const checkout = (input: CheckoutInput) => api<{ ok: boolean; code: string; dealId: number | null }>('/api/public/checkout', { body: input })
