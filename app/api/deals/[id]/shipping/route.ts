import { NextResponse } from 'next/server'
import { z } from 'zod'
import { bookShipping } from '@/lib/deals/server'
import { artworkErrorResponse, dealContext } from '../../_http'

const schema = z.object({ carrier: z.string().trim().min(2).max(80), tracking: z.string().trim().min(2).max(80), insurer: z.string().max(80).optional(), policyRef: z.string().max(80).optional(), shippingCents: z.number().int().min(0).optional(), insuranceCents: z.number().int().min(0).optional() })

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const c = await dealContext(ctx); if (c.gate) return c.gate
    if (!c.scope) return NextResponse.json({ error: 'Só o vendedor registra o transporte.' }, { status: 403 })
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
    const d = parsed.data
    await bookShipping(c.scope, c.id, { ...d, shippingCents: d.shippingCents === undefined ? undefined : BigInt(d.shippingCents), insuranceCents: d.insuranceCents === undefined ? undefined : BigInt(d.insuranceCents) })
    return NextResponse.json({ ok: true })
  } catch (e) { return artworkErrorResponse(e) }
}
