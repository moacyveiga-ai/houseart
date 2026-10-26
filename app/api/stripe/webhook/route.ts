import { NextResponse } from 'next/server'
import { handleStripeWebhook } from '@/lib/stripe/webhook-server'
import { settleEscrowByIntent } from '@/lib/deals/server'

/**
 * Stripe → HouseArt. Public at the middleware (exact path in lib/public-routes.ts);
 * the credential is the `Stripe-Signature` over the RAW body, checked in lib/stripe.
 */
export async function POST(req: Request) {
  const raw = await req.text()
  const r = await handleStripeWebhook(raw, req.headers.get('stripe-signature'), Date.now(), { onPaymentSucceeded: settleEscrowByIntent })
  return NextResponse.json(r.body, { status: r.status })
}
