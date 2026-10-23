// Stripe webhook — I/O. Signature over the RAW body (STRIPE_WEBHOOK_SECRET),
// idempotent by the event id (StripeEvent, unique), and the reconciliation of
// what our records say about a PaymentIntent: the offer guarantee
// (Offer.guaranteeRef) and the service order (Order.paymentRef). The event row
// and the reconciliation commit together: a failure answers 500 and Stripe
// retries; a repeated event answers 200 without touching anything.
// Decisions (which status an event leads to) live in mode-core.ts.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { isHandledEvent, nextGuaranteeStatus, nextOrderStatus, stripeModeOf, verifyStripeSignature, type HandledEvent } from './mode-core'

export interface WebhookResult { status: number; body: { ok: boolean; duplicate?: boolean; ignored?: string; error?: string } }

interface EventShape { id?: unknown; type?: unknown; livemode?: unknown; data?: { object?: { id?: unknown; object?: unknown } } }

export async function handleStripeWebhook(rawBody: string, signature: string | null, nowMs = Date.now()): Promise<WebhookResult> {
  const secret = (process.env.STRIPE_WEBHOOK_SECRET ?? '').trim()
  if (!secret) return { status: 503, body: { ok: false, error: 'Webhook da Stripe não configurado.' } }
  if (!verifyStripeSignature(rawBody, signature, secret, Math.floor(nowMs / 1000))) return { status: 400, body: { ok: false, error: 'Assinatura inválida.' } }
  let ev: EventShape
  try { ev = JSON.parse(rawBody) as EventShape } catch { return { status: 400, body: { ok: false, error: 'Corpo inválido.' } } }
  const id = typeof ev.id === 'string' ? ev.id : null
  const type = typeof ev.type === 'string' ? ev.type : null
  const obj = ev.data?.object
  if (!id || !type) return { status: 400, body: { ok: false, error: 'Evento inválido.' } }
  const mode = stripeModeOf(process.env)
  // an event of the other mode (a test event reaching live, or anything in mock) is acknowledged and ignored
  if (mode === 'mock' || (ev.livemode === true) !== (mode === 'live')) return { status: 200, body: { ok: true, ignored: 'mode' } }
  if (!isHandledEvent(type) || !obj || obj.object !== 'payment_intent' || typeof obj.id !== 'string') return { status: 200, body: { ok: true, ignored: 'type' } }
  const piId = obj.id
  try {
    await totalScope('stripe:webhook', () => prisma.$transaction(async (tx) => {
      await tx.stripeEvent.create({ data: { eventId: id, type, livemode: ev.livemode === true, objectId: piId } })
      await reconcile(tx, piId, type)
    }))
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2002') return { status: 200, body: { ok: true, duplicate: true } }
    console.error('[stripe] webhook falhou', type, (e as { code?: string })?.code ?? (e as Error)?.name)
    return { status: 500, body: { ok: false, error: 'Falha ao processar.' } }
  }
  return { status: 200, body: { ok: true } }
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

async function reconcile(tx: Tx, piId: string, type: HandledEvent): Promise<void> {
  const offers = await tx.offer.findMany({ where: { guaranteeRef: piId }, select: { id: true, guaranteeStatus: true } })
  for (const o of offers) {
    const to = nextGuaranteeStatus(o.guaranteeStatus, type)
    if (!to) continue
    const r = await tx.offer.updateMany({ where: { id: o.id, guaranteeStatus: o.guaranteeStatus }, data: { guaranteeStatus: to } })
    if (r.count) await tx.offerEvent.create({ data: { offerId: o.id, kind: to === 'CAPTURED' ? 'GUARANTEE_CAPTURED' : to === 'CANCELLED' ? 'GUARANTEE_RELEASED' : to === 'FAILED' ? 'GUARANTEE_FAILED' : 'GUARANTEE_AUTHORIZED', actorKind: 'SYSTEM', payloadJson: JSON.stringify({ via: 'webhook' }) } })
  }
  const orders = await tx.order.findMany({ where: { paymentRef: piId }, select: { id: true, status: true } })
  for (const o of orders) {
    const to = nextOrderStatus(o.status, type)
    if (!to) continue
    await tx.order.updateMany({ where: { id: o.id, status: o.status }, data: to === 'PAID' ? { status: to, paidAt: new Date() } : { status: to } })
  }
}
