import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { buyNow } from '@/lib/offers/server'
import { consumeOrAllow, rateLimitResponse } from '@/lib/rate-limit'
import { artworkErrorResponse } from '@/app/api/artworks/_http'

const schema = z.object({ publicId: z.string().min(10).max(20), paymentMethodId: z.number().int().nullable().optional(), deliveryCep: z.string().max(12).nullable().optional(), insurance: z.boolean().optional(), buyerDocument: z.string().max(20).optional(), buyerCity: z.string().max(80).optional(),
  method: z.enum(['CARD', 'PIX', 'BOLETO']).optional(), installments: z.number().int().min(1).max(12).optional(),
  billing: z.object({ taxId: z.string().max(20), line1: z.string().max(200), city: z.string().max(80), state: z.string().max(2), postalCode: z.string().max(9) }).optional() })

/** "Comprar direto": the logged buyer pays at the list price; escrow captured on the spot (mock). */
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ ok: false, error: 'Entre para comprar.' }, { status: 401 })
  const brake = await consumeOrAllow({ key: `checkout:user:${session.id}`, limit: 10, windowMs: 3_600_000 })
  if (!brake.allowed) return rateLimitResponse(brake)
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Dados incompletos.' }, { status: 400 })
  try {
    const r = await buyNow({ publicId: parsed.data.publicId.toUpperCase(), buyerUserId: session.id, buyerName: session.name, buyerEmail: session.email, buyerDocument: parsed.data.buyerDocument ?? session.cpf ?? null, buyerCity: parsed.data.buyerCity ?? null, paymentMethodId: parsed.data.paymentMethodId ?? null, deliveryCep: parsed.data.deliveryCep ?? null, insurance: parsed.data.insurance ?? true,
      method: parsed.data.method ?? 'CARD', installments: parsed.data.installments, billing: parsed.data.billing ? { ...parsed.data.billing, state: parsed.data.billing.state.toUpperCase(), name: session.name, email: session.email } : null })
    if (!r.ok) return NextResponse.json(r, { status: 400 })
    return NextResponse.json({ ok: true, code: r.code, dealId: r.dealId, href: '/purchases', instructions: r.instructions ?? null })
  } catch (e) { return artworkErrorResponse(e) }
}
