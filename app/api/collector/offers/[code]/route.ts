import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { buyerOffer } from '@/lib/offers/server'
import { json } from '@/app/api/artworks/_http'

/**
 * One proposal of the logged buyer by its code (App Colecionador › "Sua oferta" /
 * "Contraproposta recebida"): the same BuyerOffer projection of /e/offer/[code],
 * keyed by the session instead of the e-mail token. 404 for someone else's code.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  try {
    const u = await requireAuth()
    const code = (await ctx.params).code.toUpperCase()
    const o = await buyerOffer(code, { userId: u.id })
    if (!o) return NextResponse.json({ ok: false, error: 'Proposta não encontrada.' }, { status: 404 })
    return json({ ok: true, offer: o }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) { if (e instanceof AuthError) return NextResponse.json({ ok: false }, { status: 401 }); throw e }
}
