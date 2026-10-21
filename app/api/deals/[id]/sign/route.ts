import { NextResponse } from 'next/server'
import { signAgreement } from '@/lib/deals/server'
import { artworkErrorResponse, dealContext } from '../../_http'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const c = await dealContext(ctx); if (c.gate) return c.gate
    if (c.scope) await signAgreement('SELLER', c.id, { userId: c.user.id, scope: c.scope })
    else await signAgreement('BUYER', c.id, { userId: c.user.id })
    return NextResponse.json({ ok: true })
  } catch (e) { return artworkErrorResponse(e) }
}
