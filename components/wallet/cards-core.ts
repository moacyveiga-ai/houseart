// "Carteira e cartões" — PURE helpers of the island (masks while typing, card
// preview, "vence em breve"). The rules that decide if a card is valid live in
// lib/payment-methods/domain (`checkCard`); here only presentation.
import { brandOf, type CardBrand } from '@/lib/payment-methods/domain'

/** Digit groups printed on the card: Amex 4-6-5, everyone else 4-4-4-4 (prototype `onNcNum`). */
export function groupsOf(brand: CardBrand): number[] {
  return brand === 'amex' ? [4, 6, 5] : [4, 4, 4, 4]
}

export function maxDigitsOf(brand: CardBrand): number {
  return brand === 'amex' ? 15 : 16
}

/** "4242424242424242" → "4242 4242 4242 4242" while typing; keeps at most the brand's digit count. */
export function formatCardNumber(raw: string): string {
  const all = raw.replace(/\D/g, '')
  const brand = brandOf(all)
  const digits = all.slice(0, maxDigitsOf(brand))
  const parts: string[] = []
  let i = 0
  for (const g of groupsOf(brandOf(digits))) {
    if (i < digits.length) parts.push(digits.slice(i, i + g))
    i += g
  }
  return parts.join(' ')
}

/** "1228" → "12 / 28" (prototype `onNcExp`). */
export function formatExpiry(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d
}

/** What the API expects: "MM/AA". */
export function expiryForApi(formatted: string): string {
  return formatted.replace(/\s/g, '')
}

export function formatCvc(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 4)
}

/** "40010000" → "40010-000" (prototype `onNcCep`). */
export function formatCep(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

/** The number printed on the preview card: typed digits, the rest as "•" (prototype `numPrev`). */
export function cardPreviewNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  const brand = brandOf(digits)
  let i = 0
  return groupsOf(brand).map((g) => { const p = digits.slice(i, i + g).padEnd(g, '•'); i += g; return p }).join(' ')
}

/** A saved card's number line: "•••• •••• •••• 4242". */
export function maskedNumber(last4: string): string {
  return `•••• •••• •••• ${last4}`
}

/** Big brand name printed on the card (empty while the prefix is unknown). */
export function brandMark(brand: CardBrand): string {
  if (brand === 'other') return ''
  return brand === 'amex' ? 'AMEX' : brand.toUpperCase()
}

/** "MM/AA" expiring within the next 3 months (prototype's "vence em breve"). */
export function expiresSoon(exp: string, now = new Date()): boolean {
  const m = /^(\d{2})\/(\d{2})$/.exec(exp)
  if (!m) return false
  const months = (2000 + Number(m[2])) * 12 + Number(m[1]) - 1
  const current = now.getFullYear() * 12 + now.getMonth()
  return months - current <= 3
}

export interface NewCardForm { number: string; exp: string; cvc: string; holder: string; cep: string; makeDefault: boolean }

export const EMPTY_CARD_FORM: NewCardForm = { number: '', exp: '', cvc: '', holder: '', cep: '', makeDefault: false }
