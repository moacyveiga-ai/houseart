// Payment methods — I/O. Cards: tokenized at the provider (mock: mock_pm_ ref;
// live: Stripe PaymentMethod, Phase 5+), only brand/last4/expiry kept. Pix
// payout account: key cipher-at-rest, mask for the screens.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { encryptText } from '@/lib/crypto/cipher'
import { stripeMode, mockForbidden } from '@/lib/stripe/door'
import { ArtworkError } from '@/lib/artworks/server'
import { audit } from '@/lib/audit'
import { checkCard, checkPixKey, toPaymentMethodView, type CardInput, type PaymentMethodView } from './domain'

export async function listPaymentMethods(userId: number): Promise<PaymentMethodView[]> {
  const rows = await prisma.paymentMethod.findMany({ where: { userId, status: 'ACTIVE' }, orderBy: [{ isDefault: 'desc' }, { id: 'asc' }] })
  return rows.map(toPaymentMethodView)
}

/** Tokenizes (mock) and saves the card. Live mode needs the client-side Stripe token: 503 until Phase 5 wires it. */
export async function addCard(userId: number, input: CardInput, makeDefault: boolean): Promise<{ ok: true; method: PaymentMethodView } | { ok: false; error: string }> {
  const c = checkCard(input)
  if (!c.ok) return c
  if (stripeMode() === 'live') throw new ArtworkError('PAYMENT_REQUIRED', 'Cartão real ainda não disponível.', 503)
  if (mockForbidden()) throw new ArtworkError('STRIPE_BLOCKED', 'Pagamento simulado bloqueado em produção.', 409)
  const count = await prisma.paymentMethod.count({ where: { userId, status: 'ACTIVE' } })
  const isDefault = makeDefault || count === 0
  const row = await prisma.$transaction(async (tx) => {
    if (isDefault) await tx.paymentMethod.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } })
    return tx.paymentMethod.create({ data: { userId, brand: c.brand, last4: c.last4, holderName: c.holder, expMonth: c.expMonth, expYear: c.expYear, billingCep: c.cep, providerRef: `mock_pm_${userId}_${Date.now()}`, isDefault } })
  })
  void audit.event({ entity: 'payment_method', entityId: row.id, action: 'create', after: { brand: c.brand, last4: c.last4 } })
  return { ok: true, method: toPaymentMethodView(row) }
}

export async function setDefaultCard(userId: number, id: number): Promise<boolean> {
  const row = await prisma.paymentMethod.findFirst({ where: { id, userId, status: 'ACTIVE' } })
  if (!row) return false
  await prisma.$transaction([
    prisma.paymentMethod.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } }),
    prisma.paymentMethod.update({ where: { id }, data: { isDefault: true } }),
  ])
  return true
}

export async function removeCard(userId: number, id: number): Promise<boolean> {
  const r = await prisma.paymentMethod.updateMany({ where: { id, userId, status: 'ACTIVE' }, data: { status: 'REMOVED', isDefault: false, removedAt: new Date() } })
  if (r.count === 0) return false
  const next = await prisma.paymentMethod.findFirst({ where: { userId, status: 'ACTIVE' }, orderBy: { id: 'asc' } })
  if (next) await prisma.paymentMethod.update({ where: { id: next.id }, data: { isDefault: true } })
  void audit.event({ entity: 'payment_method', entityId: id, action: 'remove' })
  return true
}

/** The card a logged buyer may use: theirs, active. */
export async function usableCard(userId: number, id: number | null) {
  if (!id) return prisma.paymentMethod.findFirst({ where: { userId, status: 'ACTIVE', isDefault: true } })
  return prisma.paymentMethod.findFirst({ where: { id, userId, status: 'ACTIVE' } })
}

// ── payout account (seller's Pix) ─────────────────────────────────────────
export interface PayoutAccountView { pixKeyType: string; pixKeyMask: string; holderName: string }

export async function payoutAccountOf(memberId: number): Promise<PayoutAccountView | null> {
  const r = await prisma.payoutAccount.findFirst({ where: { memberId, status: 'ACTIVE' } })
  return r ? { pixKeyType: r.pixKeyType, pixKeyMask: r.pixKeyMask, holderName: r.holderName } : null
}

/** Sets (or replaces) the member's Pix key. The key is checked against the holder's own document when it is a CPF/CNPJ. */
export async function setPayoutAccount(memberId: number, tenantId: number | null, input: { type: string; key: string; holderName: string; holderDocument: string | null }): Promise<{ ok: true; account: PayoutAccountView } | { ok: false; error: string }> {
  const c = checkPixKey(input.type, input.key, input.holderDocument)
  if (!c.ok) return c
  const holderName = input.holderName.trim().slice(0, 120)
  if (!holderName) return { ok: false, error: 'Informe o nome do titular.' }
  const data = { tenantId, pixKeyType: c.type, pixKeyEnc: encryptText(c.key), pixKeyMask: c.mask, holderName, status: 'ACTIVE' }
  const r = await prisma.payoutAccount.upsert({ where: { memberId }, create: { memberId, ...data }, update: data })
  void audit.event({ entity: 'payout_account', entityId: r.id, action: 'set', after: { pixKeyType: c.type, mask: c.mask } })
  return { ok: true, account: { pixKeyType: r.pixKeyType, pixKeyMask: r.pixKeyMask, holderName: r.holderName } }
}

export async function removePayoutAccount(memberId: number): Promise<boolean> {
  const r = await prisma.payoutAccount.updateMany({ where: { memberId, status: 'ACTIVE' }, data: { status: 'REMOVED' } })
  return r.count > 0
}
