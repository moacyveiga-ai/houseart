import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { buyerReply } from '@/lib/offers/server'
import { artworkErrorResponse } from '@/app/api/artworks/_http'

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const code = (await ctx.params).code.toUpperCase()
    const body = await req.json().catch(() => ({})) as { token?: string; accept?: boolean; amountCents?: number | string; message?: string }
    // The key is the one-time token (e-mail flow) or the logged buyer (Phase 4).
    const session = body.token ? null : await getSession().catch(() => null)
    const token = body.token ? String(body.token) : session ? { userId: session.id } : null
    const ok = body.accept
      ? await buyerReply(code, token, { accept: true })
      : await buyerReply(code, token, { accept: false, amountCents: BigInt(Math.round(Number(body.amountCents ?? 0))), message: body.message })
    return NextResponse.json({ ok }, { status: ok ? 200 : 404 })
  } catch (e) { return artworkErrorResponse(e) }
}
