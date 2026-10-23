// Payment methods — I/O. Cards: tokenized at the provider (mock: mock_pm_ ref;
// test/live: Stripe PaymentMethod saved by a SetupIntent confirmed in Stripe
// Elements — the PAN never reaches this server), only brand/last4/expiry kept. Pix
// payout account: key cipher-at-rest, mask for the screens.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { encryptText } from '@/lib/crypto/cipher'
import { cardFromSetupIntent, detachCard, mockForbidden, stripeMode, stripePublishableKey } from '@/lib/stripe/door'
import { brandFromStripe } from '@/lib/stripe/mode-core'
import { ArtworkError } from '@/lib/artworks/server'
import { audit } from '@/lib/audit'
import { checkCard, checkPixKey, toPaymentMethodView, type CardInput, type PaymentMethodView } from './domain'

export async function listPaymentMethods(userId: number): Promise<PaymentMethodView[]> {
  const rows = await prisma.paymentMethod.findMany({ where: { userId, status: 'ACTIVE', providerMode: stripeMode() }, orderBy: [{ isDefault: 'desc' }, { id: 'asc' }] })
  return rows.map(toPaymentMethodView)
}

/** What the card screens need to choose the form: the Stripe.js key (test/live) or null (the mock form). */
export function cardFormConfig(): { publishableKey: string } | null {
  const pk = stripePublishableKey()
  return pk ? { publishableKey: pk } : null
}

async function saveCardRow(userId: number, makeDefault: boolean, data: { brand: string; last4: string; holderName: string; expMonth: number; expYear: number; billingCep: string | null; providerRef: string; providerMode: string }) {
  const count = await prisma.paymentMethod.count({ where: { userId, status: 'ACTIVE', providerMode: data.providerMode } })
  const isDefault = makeDefault || count === 0
  const row = await prisma.$transaction(async (tx) => {
    if (isDefault) await tx.paymentMethod.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } })
    return tx.paymentMethod.create({ data: { userId, ...data, isDefault } })
  })
  void audit.event({ entity: 'payment_method', entityId: row.id, action: 'create', after: { brand: data.brand, last4: data.last4, mode: data.providerMode } })
  return row
}

/** Tokenizes (mock) and saves the card. In test/live the PAN never comes here: the card goes through Stripe Elements + SetupIntent (`addCardFromSetup`). */
export async function addCard(userId: number, input: CardInput, makeDefault: boolean): Promise<{ ok: true; method: PaymentMethodView } | { ok: false; error: string }> {
  const c = checkCard(input)
  if (!c.ok) return c
  if (stripeMode() !== 'mock') throw new ArtworkError('USE_SECURE_FORM', 'Este formulário não aceita cartão real. Cadastre o cartão em Carteira e cartões, no site, pelo formulário seguro da Stripe.', 409)
  if (mockForbidden()) throw new ArtworkError('STRIPE_BLOCKED', 'Pagamento simulado bloqueado em produção.', 409)
  const row = await saveCardRow(userId, makeDefault, { brand: c.brand, last4: c.last4, holderName: c.holder, expMonth: c.expMonth, expYear: c.expYear, billingCep: c.cep, providerRef: `mock_pm_${userId}_${Date.now()}`, providerMode: 'mock' })
  return { ok: true, method: toPaymentMethodView(row) }
}

/** Saves the card a succeeded SetupIntent of this user attached at Stripe (test/live). The same card twice is the same row. */
export async function addCardFromSetup(userId: number, setupIntentId: string, makeDefault: boolean): Promise<{ ok: true; method: PaymentMethodView }> {
  const { pm, mode } = await cardFromSetupIntent(userId, setupIntentId)
  const existing = await prisma.paymentMethod.findFirst({ where: { userId, providerRef: pm.id, status: 'ACTIVE' } })
  if (existing) return { ok: true, method: toPaymentMethodView(existing) }
  const card = pm.card!
  const cep = (pm.billing_details.address?.postal_code ?? '').replace(/\D/g, '').slice(0, 8) || null
  const row = await saveCardRow(userId, makeDefault, { brand: brandFromStripe(card.brand), last4: card.last4.slice(-4), holderName: (pm.billing_details.name ?? '').trim().toUpperCase().slice(0, 60), expMonth: card.exp_month, expYear: card.exp_year, billingCep: cep, providerRef: pm.id, providerMode: mode })
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
  const card = await prisma.paymentMethod.findFirst({ where: { id, userId, status: 'ACTIVE' }, select: { providerRef: true, providerMode: true } })
  if (!card) return false
  await detachCard(card.providerRef, card.providerMode)
  const r = await prisma.paymentMethod.updateMany({ where: { id, userId, status: 'ACTIVE' }, data: { status: 'REMOVED', isDefault: false, removedAt: new Date() } })
  if (r.count === 0) return false
  const next = await prisma.paymentMethod.findFirst({ where: { userId, status: 'ACTIVE', providerMode: card.providerMode }, orderBy: { id: 'asc' } })
  if (next) await prisma.paymentMethod.update({ where: { id: next.id }, data: { isDefault: true } })
  void audit.event({ entity: 'payment_method', entityId: id, action: 'remove' })
  return true
}

/** The card a logged buyer may use: theirs, active, of the current Stripe mode (a mock card never reaches Stripe). */
export async function usableCard(userId: number, id: number | null) {
  const providerMode = stripeMode()
  if (!id) return prisma.paymentMethod.findFirst({ where: { userId, status: 'ACTIVE', providerMode, isDefault: true } })
  return prisma.paymentMethod.findFirst({ where: { id, userId, status: 'ACTIVE', providerMode } })
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
