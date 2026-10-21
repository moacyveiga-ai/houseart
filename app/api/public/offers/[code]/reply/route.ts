import { NextResponse } from 'next/server'
import { buyerReply } from '@/lib/offers/server'
import { artworkErrorResponse } from '@/app/api/artworks/_http'

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const code = (await ctx.params).code.toUpperCase()
    const body = await req.json().catch(() => ({})) as { token?: string; accept?: boolean; amountCents?: number | string; message?: string }
    const token = String(body.token ?? '')
    const ok = body.accept
      ? await buyerReply(code, token, { accept: true })
      : await buyerReply(code, token, { accept: false, amountCents: BigInt(Math.round(Number(body.amountCents ?? 0))), message: body.message })
    return NextResponse.json({ ok }, { status: ok ? 200 : 404 })
  } catch (e) { return artworkErrorResponse(e) }
}
