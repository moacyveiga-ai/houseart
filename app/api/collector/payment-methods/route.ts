import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth, AuthError } from '@/lib/auth'
import { addCard, addCardFromSetup, cardFormConfig, listPaymentMethods } from '@/lib/payment-methods/server'
import { artworkErrorResponse } from '@/app/api/artworks/_http'

const schema = z.object({ number: z.string().max(30), exp: z.string().max(7), cvc: z.string().max(4), holder: z.string().max(80), cep: z.string().max(10), makeDefault: z.boolean().optional() })
/** Test/live: the browser confirmed a SetupIntent in Stripe Elements; only its id comes here. */
const setupSchema = z.object({ setupIntentId: z.string().regex(/^seti_[A-Za-z0-9_]+$/).max(100), makeDefault: z.boolean().optional() })

export async function GET() {
  try { const u = await requireAuth(); return NextResponse.json({ ok: true, methods: await listPaymentMethods(u.id), stripe: cardFormConfig() }, { headers: { 'cache-control': 'no-store' } }) }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ ok: false }, { status: 401 }); throw e }
}

/** Saves a card. Mock: validated and reduced to brand/last4 here (the number never persists). Test/live: `{ setupIntentId }` only. */
export async function POST(req: Request) {
  let u
  try { u = await requireAuth() } catch (e) { if (e instanceof AuthError) return NextResponse.json({ ok: false, error: 'Entre para continuar.' }, { status: 401 }); throw e }
  const body = await req.json().catch(() => ({}))
  const setup = setupSchema.safeParse(body)
  if (setup.success) {
    try { return NextResponse.json(await addCardFromSetup(u.id, setup.data.setupIntentId, setup.data.makeDefault ?? false), { status: 201 }) }
    catch (e) { return artworkErrorResponse(e) }
  }
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Dados incompletos.' }, { status: 400 })
  try {
    const r = await addCard(u.id, parsed.data, parsed.data.makeDefault ?? false)
    if (!r.ok) return NextResponse.json(r, { status: 400 })
    return NextResponse.json(r, { status: 201 })
  } catch (e) { return artworkErrorResponse(e) }
}
