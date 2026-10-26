// Orders — I/O. `placeOrder` prices by the catalog, charges by the Stripe
// door (mock pays on the spot) and writes the Invoice line that the Cobrança
// screen lists. Callers: markers kit, off-platform transfer fee, appraisal,
// collection insurance.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { flagOn } from '@/lib/flags'
import { audit } from '@/lib/audit'
import { ArtworkError } from '@/lib/artworks/server'
import { memberFilter, type Scope } from '@/lib/scope/core'
import { totalScope } from '@/lib/scope/context'
import { chargeNow, stripeMode } from '@/lib/stripe/door'
import { isServiceCode, orderCode, type PayerKind, type ServiceCode } from './domain'

export interface PlaceOrderInput {
  serviceCode: ServiceCode
  payerKind: PayerKind
  quantity?: number
  /** overrides the catalog price (quotes) */
  amountCents?: bigint
  description?: string
  tenantId?: number | null
  memberId?: number | null
  userId?: number | null
  artworkId?: number | null
  dealId?: number | null
  appraisalRequestId?: number | null
  transferId?: number | null
}

/** The catalog price of a code (null when the row is missing or inactive): the kit's unit price, the transfer fee. */
export async function catalogPriceCents(code: ServiceCode): Promise<bigint | null> {
  const item = await prisma.serviceCatalog.findUnique({ where: { code }, select: { priceCents: true, active: true } })
  return item && item.active ? item.priceCents : null
}

/** Creates and pays (mock, or Stripe in test/live) an order; returns null when FLAG_ORDERS is off (callers go on without a charge). */
export async function placeOrder(i: PlaceOrderInput): Promise<{ id: number; code: string; amountCents: bigint; paymentRef: string } | null> {
  if (!flagOn('FLAG_ORDERS')) return null
  if (!isServiceCode(i.serviceCode)) throw new ArtworkError('BAD_SERVICE', 'Serviço desconhecido.', 400)
  const item = await prisma.serviceCatalog.findUnique({ where: { code: i.serviceCode } })
  if (!item || !item.active) throw new ArtworkError('BAD_SERVICE', 'Serviço indisponível.', 400)
  const quantity = Math.max(1, Math.trunc(i.quantity ?? 1))
  const amount = i.amountCents ?? item.priceCents * BigInt(quantity)
  if (amount <= 0n) throw new ArtworkError('QUOTE_REQUIRED', 'Este serviço é cotado à parte.', 409)
  const description = i.description ?? `${item.name}${quantity > 1 ? ` × ${quantity}` : ''}`
  // test/live: the payer is the person, else the member's login; the key is the natural one when the order has a unique origin.
  const payerUserId = stripeMode() === 'mock' ? null : i.userId ?? (i.memberId ? (await prisma.member.findUnique({ where: { id: i.memberId }, select: { userId: true } }))?.userId ?? null : null)
  const origin = i.appraisalRequestId ? `appraisal:${i.appraisalRequestId}` : i.transferId ? `transfer:${i.transferId}` : null
  const payment = await chargeNow({ amountCents: amount, description, payerUserId, idempotencyKey: origin ? `order:${i.serviceCode}:${origin}` : undefined, metadata: { kind: 'order', serviceCode: i.serviceCode } })
  const year = new Date().getUTCFullYear()
  const order = await totalScope('orders:place', () => prisma.$transaction(async (tx) => {
    const seq = await tx.order.count({ where: { code: { startsWith: `ORD-${year}-` } } })
    const o = await tx.order.create({ data: {
      code: orderCode(year, seq + 1), tenantId: i.tenantId ?? null, memberId: i.memberId ?? null, userId: i.userId ?? null, payerKind: i.payerKind, serviceCode: i.serviceCode, description, quantity, amountCents: amount,
      status: 'PAID', paymentRef: payment.ref, paidAt: payment.paidAt, artworkId: i.artworkId ?? null, dealId: i.dealId ?? null, appraisalRequestId: i.appraisalRequestId ?? null, transferId: i.transferId ?? null,
    } })
    await tx.invoice.create({ data: { tenantId: i.tenantId ?? null, userId: i.userId ?? null, kind: 'ORDER', description, amountCents: amount, status: 'PAID', orderId: o.id, date: payment.paidAt } })
    return o
  }))
  void audit.event({ entity: 'order', entityId: order.id, action: 'create', userId: i.userId ?? undefined, after: { code: order.code, serviceCode: i.serviceCode, amountCents: amount.toString() } })
  return { id: order.id, code: order.code, amountCents: amount, paymentRef: payment.ref }
}

export async function listOrders(scope: Scope, take = 50) {
  return prisma.order.findMany({ where: { ...memberFilter(scope) }, orderBy: { createdAt: 'desc' }, take })
}

export async function ordersOfUser(userId: number, take = 50) {
  return prisma.order.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take })
}

export async function catalog() {
  return prisma.serviceCatalog.findMany({ where: { active: true }, orderBy: { id: 'asc' } })
}
