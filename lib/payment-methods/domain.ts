// Payment methods (Phase 4, handoff "Carteira e cartões" / "Cadastrar Pix") — PURE.
// Card validation mirrors the prototype: Luhn, brand by prefix, expiry, CVC
// length, holder, billing CEP. The PAN is validated and reduced to brand +
// last4 here; it is never stored (the server keeps only the provider token).

export const CARD_BRANDS = ['visa', 'mastercard', 'amex', 'elo', 'hipercard', 'other'] as const
export type CardBrand = (typeof CARD_BRANDS)[number]
export const CARD_BRAND_LABELS: Record<CardBrand, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', elo: 'Elo', hipercard: 'Hipercard', other: 'Cartão' }

export const PIX_KEY_TYPES = ['CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM'] as const
export type PixKeyType = (typeof PIX_KEY_TYPES)[number]
export const PIX_KEY_TYPE_LABELS: Record<PixKeyType, string> = { CPF: 'CPF', CNPJ: 'CNPJ', EMAIL: 'E-mail', PHONE: 'Celular', RANDOM: 'Chave aleatória' }

/** How the buyer guarantees an offer (prototype "Garantia da oferta"). */
export const GUARANTEE_METHODS = ['NONE', 'CARD_HOLD', 'PIX_RESERVE', 'TRANSFER_ON_ACCEPT'] as const
export type GuaranteeMethod = (typeof GUARANTEE_METHODS)[number]
export const GUARANTEE_LABELS: Record<GuaranteeMethod, { name: string; sub: string; icon: string }> = {
  NONE: { name: 'Sem garantia', sub: 'Proposta sem reserva de valor', icon: 'block' },
  CARD_HOLD: { name: 'Pré-autorização no cartão', sub: 'O valor é reservado, não cobrado', icon: 'credit_card' },
  PIX_RESERVE: { name: 'Pix com devolução automática', sub: 'Devolvido em até 1 minuto se a oferta não for aceita', icon: 'pix' },
  TRANSFER_ON_ACCEPT: { name: 'Transferência na aceitação', sub: 'Você paga só depois do aceite, em até 24 horas', icon: 'account_balance' },
}

export const VALIDITY_HOURS = [24, 48, 72] as const
export const DEFAULT_VALIDITY_HOURS = 48

export function luhn(digits: string): boolean {
  if (!/^\d{13,19}$/.test(digits)) return false
  let sum = 0, alt = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i])
    if (alt) { n *= 2; if (n > 9) n -= 9 }
    sum += n; alt = !alt
  }
  return sum % 10 === 0
}

export function brandOf(digits: string): CardBrand {
  if (/^4/.test(digits)) return 'visa'
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'mastercard'
  if (/^3[47]/.test(digits)) return 'amex'
  if (/^(606282|3841)/.test(digits)) return 'hipercard'
  if (/^(4011|4312|4389|4514|4573|5041|5066|5090|6277|6362|6363|650|6516|6550)/.test(digits)) return 'elo'
  return 'other'
}

export interface CardInput { number: string; exp: string; cvc: string; holder: string; cep: string }
export type CardCheck = { ok: true; brand: CardBrand; last4: string; expMonth: number; expYear: number; holder: string; cep: string } | { ok: false; error: string }

/** The same six rules as the prototype's `salvarCartao`. `now` for the expiry. */
export function checkCard(i: CardInput, now = new Date()): CardCheck {
  const digits = (i.number ?? '').replace(/\D/g, '')
  if (!luhn(digits)) return { ok: false, error: 'O número do cartão é inválido.' }
  const brand = brandOf(digits)
  const m = /^(\d{1,2})\s*\/\s*(\d{2,4})$/.exec((i.exp ?? '').trim())
  const mm = m ? Number(m[1]) : 0
  let yy = m ? Number(m[2]) : 0
  if (yy < 100) yy += 2000
  const expired = !m || mm < 1 || mm > 12 || yy < now.getFullYear() || (yy === now.getFullYear() && mm < now.getMonth() + 1)
  if (expired) return { ok: false, error: 'A data de validade do cartão já passou ou é inválida.' }
  const cvc = (i.cvc ?? '').replace(/\D/g, '')
  if (cvc.length < (brand === 'amex' ? 4 : 3)) return { ok: false, error: 'O código de segurança está incompleto.' }
  const holder = (i.holder ?? '').trim().toUpperCase().slice(0, 60)
  if (!holder) return { ok: false, error: 'Informe o nome impresso no cartão.' }
  const cep = (i.cep ?? '').replace(/\D/g, '')
  if (cep.length !== 8) return { ok: false, error: 'O CEP está incompleto.' }
  return { ok: true, brand, last4: digits.slice(-4), expMonth: mm, expYear: yy, holder, cep }
}

export function maskCard(brand: CardBrand, last4: string): string { return `${CARD_BRAND_LABELS[brand]} •••• ${last4}` }

export type PixCheck = { ok: true; type: PixKeyType; key: string; mask: string } | { ok: false; error: string }

/** Validates the key by type; CPF/CNPJ keys must match the holder's document digits when given. */
export function checkPixKey(type: string, raw: string, holderDocument: string | null): PixCheck {
  if (!(PIX_KEY_TYPES as readonly string[]).includes(type)) return { ok: false, error: 'Tipo de chave inválido.' }
  const t = type as PixKeyType
  const key = (raw ?? '').trim()
  const d = key.replace(/\D/g, '')
  if (t === 'CPF') {
    if (d.length !== 11) return { ok: false, error: 'Digite os 11 números do CPF.' }
    if (holderDocument && holderDocument.replace(/\D/g, '') !== d) return { ok: false, error: 'Este CPF não é o seu. A chave precisa estar no CPF do titular da conta.' }
    return { ok: true, type: t, key: d, mask: `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` }
  }
  if (t === 'CNPJ') {
    if (d.length !== 14) return { ok: false, error: 'Digite os 14 números do CNPJ.' }
    if (holderDocument && holderDocument.replace(/\D/g, '') !== d) return { ok: false, error: 'Este CNPJ não é o da conta.' }
    return { ok: true, type: t, key: d, mask: `**.${d.slice(2, 5)}.${d.slice(5, 8)}/****-**` }
  }
  if (t === 'EMAIL') {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(key)) return { ok: false, error: 'Digite um e-mail válido.' }
    const [u, h] = key.toLowerCase().split('@')
    return { ok: true, type: t, key: key.toLowerCase(), mask: `${u.slice(0, 2)}***@${h}` }
  }
  if (t === 'PHONE') {
    if (d.length !== 11 && !(d.length === 13 && d.startsWith('55'))) return { ok: false, error: 'Digite o celular com DDD.' }
    const n = d.length === 13 ? d.slice(2) : d
    return { ok: true, type: t, key: `+55${n}`, mask: `(${n.slice(0, 2)}) 9****-${n.slice(7)}` }
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key)) return { ok: false, error: 'A chave aleatória tem 32 caracteres no formato do seu banco.' }
  return { ok: true, type: t, key: key.toLowerCase(), mask: `${key.slice(0, 8)}-****-…` }
}

/** Public projection of a saved card: never the token. */
export interface PaymentMethodView { id: number; brand: CardBrand; brandLabel: string; last4: string; holderName: string; exp: string; isDefault: boolean; label: string }
export function toPaymentMethodView(r: { id: number; brand: string; last4: string; holderName: string; expMonth: number; expYear: number; isDefault: boolean }): PaymentMethodView {
  const brand = ((CARD_BRANDS as readonly string[]).includes(r.brand) ? r.brand : 'other') as CardBrand
  return { id: r.id, brand, brandLabel: CARD_BRAND_LABELS[brand], last4: r.last4, holderName: r.holderName, exp: `${String(r.expMonth).padStart(2, '0')}/${String(r.expYear).slice(-2)}`, isDefault: r.isDefault, label: maskCard(brand, r.last4) }
}

/** The holder's CPF as the Pix screens show it (`***.456.789-**`); null when the account has no CPF. */
export function cpfMaskOf(cpf: string | null): string | null {
  const d = (cpf ?? '').replace(/\D/g, '')
  return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : null
}
