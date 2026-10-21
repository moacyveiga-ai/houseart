import { NextResponse } from 'next/server'
import { requirePanel } from '@/lib/auth/panel'
import { refuseOffer } from '@/lib/offers/server'
import { InvalidOfferTransition } from '@/lib/offers/state'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { scope, user } = await requirePanel()
    const id = idParam((await ctx.params).id)
    if (!id) return NextResponse.json({ error: 'Proposta não encontrada.' }, { status: 404 })
    const body = await req.json().catch(() => ({})) as { reason?: string }
    await refuseOffer(scope, id, { userId: user.id }, body.reason)
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof InvalidOfferTransition) return NextResponse.json({ error: e.message }, { status: 409 })
    return artworkErrorResponse(e)
  }
}
