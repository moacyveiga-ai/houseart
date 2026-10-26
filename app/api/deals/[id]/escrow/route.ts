import { NextResponse } from 'next/server'
import { payEscrow, simulateEscrowPayment, startEscrowPayment } from '@/lib/deals/server'
import { isAsyncMethod, type BoletoBilling } from '@/lib/payments/async-core'
import { artworkErrorResponse, dealContext } from '../../_http'

/** The buyer pays the escrow: `{}` / `{ method: 'CARD' }` charges the card; `{ method: 'PIX' | 'BOLETO' }` returns the
 *  instructions (paid when the bank confirms); `{ simulate: true }` confirms a pending one in mock only. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const c = await dealContext(ctx); if (c.gate) return c.gate
    const body = (await req.json().catch(() => ({}))) as { method?: unknown; billing?: Partial<BoletoBilling>; simulate?: unknown }
    if (body.simulate === true) { await simulateEscrowPayment(c.user.id, c.id); return NextResponse.json({ ok: true, paid: true }) }
    if (isAsyncMethod(body.method)) {
      const b = body.billing ?? {}
      const billing: BoletoBilling | null = body.method === 'BOLETO' ? { name: String(b.name ?? c.user.name).slice(0, 120), email: String(b.email ?? c.user.email).slice(0, 200), taxId: String(b.taxId ?? '').slice(0, 20), line1: String(b.line1 ?? '').slice(0, 200), city: String(b.city ?? '').slice(0, 80), state: String(b.state ?? '').slice(0, 2).toUpperCase(), postalCode: String(b.postalCode ?? '').slice(0, 9) } : null
      const r = await startEscrowPayment(c.user.id, c.id, body.method, billing)
      return NextResponse.json({ ok: true, paid: r.paid, instructions: r.instructions })
    }
    await payEscrow(c.user.id, c.id)
    return NextResponse.json({ ok: true, paid: true })
  } catch (e) { return artworkErrorResponse(e) }
}
