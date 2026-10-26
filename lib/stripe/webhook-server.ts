// Stripe webhook — I/O. Signature over the RAW body (STRIPE_WEBHOOK_SECRET),
// idempotent by the event id (StripeEvent, unique), and the reconciliation of
// what our records say about a PaymentIntent: the offer guarantee
// (Offer.guaranteeRef) and the service order (Order.paymentRef). The event row
// and the reconciliation commit together: a failure answers 500 and Stripe
// retries; a repeated event answers 200 without touching anything.
// Decisions (which status an event leads to) live in mode-core.ts.
// Connect: `account.updated` (the seller's Express account — delivered by a
// Connect endpoint, "events on connected accounts", which has its OWN signing
// secret: STRIPE_CONNECT_WEBHOOK_SECRET; the same URL serves both) and
// `transfer.reversed` (a platform event, the normal endpoint) — connect-server.ts.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { isHandledEvent, nextGuaranteeStatus, nextOrderStatus, stripeModeOf, verifyStripeSignature, type HandledEvent } from './mode-core'
import { isConnectEvent, requirementCodesOf } from './connect-core'
import { markTransferReversed, syncConnectAccountFromEvent } from './connect-server'
import type { GwAccount } from './gateway-server'

export interface WebhookResult { status: number; body: { ok: boolean; duplicate?: boolean; ignored?: string; error?: string } }

type EventObject = { id?: unknown; object?: unknown } & Record<string, unknown>
interface EventShape { id?: unknown; type?: unknown; livemode?: unknown; data?: { object?: EventObject } }

/** The account as the event carries it → the gateway's shape (only what the decisions read; nothing else is kept). */
function accountOfEvent(o: Record<string, unknown>): GwAccount | null {
  if (typeof o.id !== 'string') return null
  const req = (o.requirements ?? {}) as Record<string, unknown>
  const caps = (o.capabilities ?? {}) as Record<string, unknown>
  return {
    id: o.id, details_submitted: o.details_submitted === true, charges_enabled: o.charges_enabled === true, payouts_enabled: o.payouts_enabled === true,
    requirements: { currently_due: requirementCodesOf(req.currently_due), past_due: requirementCodesOf(req.past_due), disabled_reason: typeof req.disabled_reason === 'string' ? req.disabled_reason : null },
    transfersCapability: typeof caps.transfers === 'string' ? caps.transfers : null,
  }
}

/** `onPaymentSucceeded`: injected by the route (lib/deals imports lib/stripe — never the reverse): the Pix/boleto escrow of a deal. Idempotent. */
export interface WebhookHooks { onPaymentSucceeded?: (paymentIntentId: string, metadata: Record<string, string>) => Promise<unknown> }

export async function handleStripeWebhook(rawBody: string, signature: string | null, nowMs = Date.now(), hooks: WebhookHooks = {}): Promise<WebhookResult> {
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].map((v) => (v ?? '').trim()).filter(Boolean)
  if (secrets.length === 0) return { status: 503, body: { ok: false, error: 'Webhook da Stripe não configurado.' } }
  const nowSec = Math.floor(nowMs / 1000)
  if (!secrets.some((secret) => verifyStripeSignature(rawBody, signature, secret, nowSec))) return { status: 400, body: { ok: false, error: 'Assinatura inválida.' } }
  let ev: EventShape
  try { ev = JSON.parse(rawBody) as EventShape } catch { return { status: 400, body: { ok: false, error: 'Corpo inválido.' } } }
  const id = typeof ev.id === 'string' ? ev.id : null
  const type = typeof ev.type === 'string' ? ev.type : null
  const obj = ev.data?.object
  if (!id || !type) return { status: 400, body: { ok: false, error: 'Evento inválido.' } }
  const mode = stripeModeOf(process.env)
  // an event of the other mode (a test event reaching live, or anything in mock) is acknowledged and ignored
  if (mode === 'mock' || (ev.livemode === true) !== (mode === 'live')) return { status: 200, body: { ok: true, ignored: 'mode' } }
  if (isConnectEvent(type)) return connectEvent(id, type, ev.livemode === true, obj, mode)
  if (!isHandledEvent(type) || !obj || obj.object !== 'payment_intent' || typeof obj.id !== 'string') return { status: 200, body: { ok: true, ignored: 'type' } }
  const piId = obj.id
  try {
    // First the deal (idempotent by CAS), then the event row: a failure here answers 500 and Stripe retries,
    // instead of a committed event row turning the retry into a duplicate that never settles.
    if (type === 'payment_intent.succeeded' && hooks.onPaymentSucceeded) await hooks.onPaymentSucceeded(piId, metadataOf(obj.metadata))
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

/** account.updated → the row of that account; transfer.reversed → the split line back to RELEASED. Idempotent by event id, like the rest. */
async function connectEvent(id: string, type: 'account.updated' | 'transfer.reversed', livemode: boolean, obj: EventObject | undefined, mode: 'test' | 'live'): Promise<WebhookResult> {
  if (!obj || typeof obj.id !== 'string') return { status: 200, body: { ok: true, ignored: 'type' } }
  const objectId = obj.id
  try {
    await totalScope('stripe:webhook', async () => {
      await prisma.stripeEvent.create({ data: { eventId: id, type, livemode, objectId } })
      if (type === 'account.updated') {
        const a = obj.object === 'account' ? accountOfEvent(obj) : null
        if (a) await syncConnectAccountFromEvent(a, mode)
      } else if (obj.object === 'transfer' && obj.reversed === true) {
        await markTransferReversed(objectId)
      }
    })
  } catch (e) {
    if ((e as { code?: string })?.code === 'P2002') return { status: 200, body: { ok: true, duplicate: true } }
    console.error('[stripe] webhook falhou', type, (e as { code?: string })?.code ?? (e as Error)?.name)
    return { status: 500, body: { ok: false, error: 'Falha ao processar.' } }
  }
  return { status: 200, body: { ok: true } }
}

/** The PaymentIntent's metadata as strings only (what we wrote at creation). */
function metadataOf(v: unknown): Record<string, string> {
  if (!v || typeof v !== 'object') return {}
  return Object.fromEntries(Object.entries(v as Record<string, unknown>).filter(([, x]) => typeof x === 'string')) as Record<string, string>
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
