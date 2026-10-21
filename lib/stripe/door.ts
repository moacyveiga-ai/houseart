// The Stripe door (D.14). `STRIPE_ENV=live` with a secret key talks to Stripe
// (Phase 6+: PaymentIntents, Connect, webhooks); anything else is the MOCK —
// the charge is marked paid on the spot with a `mock_` reference. A mock in
// production is refused (same rule as the origin's `stripeSimuladoProibido`).
import 'server-only'
import { ArtworkError } from '@/lib/artworks/server'

export type StripeMode = 'live' | 'mock'

export function stripeMode(env: NodeJS.ProcessEnv = process.env): StripeMode {
  const live = env.STRIPE_ENV?.trim() === 'live' && (env.STRIPE_SECRET_KEY ?? '').startsWith('sk_live_')
  return live ? 'live' : 'mock'
}

/** Mock refused in production unless STRIPE_MOCK_ALLOWED=1 (previews, smoke). */
export function mockForbidden(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'production' && !!env.VERCEL && env.VERCEL_ENV === 'production' && env.STRIPE_MOCK_ALLOWED !== '1' && stripeMode(env) === 'mock'
}

let seq = 0

/** Charges now. Mock: paid; live: not available in this phase (503, nothing written). */
export async function chargeNow(_i: { amountCents: bigint; description: string }): Promise<{ ref: string; paidAt: Date }> {
  if (stripeMode() === 'live') throw new ArtworkError('PAYMENT_REQUIRED', 'Pagamento real ainda não disponível.', 503)
  if (mockForbidden()) throw new ArtworkError('STRIPE_BLOCKED', 'Pagamento simulado bloqueado em produção.', 409)
  seq += 1
  return { ref: `mock_ch_${Date.now()}_${seq}`, paidAt: new Date() }
}
