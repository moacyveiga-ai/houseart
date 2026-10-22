import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { sellOwnArtwork } from '@/lib/collectors/server'
import { artworkErrorResponse, idParam, json } from '@/app/api/artworks/_http'

const cents = (v: unknown): bigint | null => (typeof v === 'string' && /^\d{1,15}$/.test(v) ? BigInt(v) : typeof v === 'number' && Number.isInteger(v) && v >= 0 ? BigInt(v) : null)

/** "Vender uma obra" from the wallet: list price, floor and negotiator — the mandate of the collector. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireAuth()
    const id = idParam((await ctx.params).id); if (!id) return NextResponse.json({ error: 'Obra não encontrada.' }, { status: 404 })
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const listPriceCents = cents(b.listPriceCents), reservePriceCents = cents(b.reservePriceCents)
    if (listPriceCents == null || reservePriceCents == null) return NextResponse.json({ error: 'Informe o preço e o mínimo que aceita.' }, { status: 400 })
    await sellOwnArtwork(u.id, id, { listPriceCents, reservePriceCents, autoNegotiatorOn: b.autoNegotiatorOn === true, autoAcceptMinBps: typeof b.autoAcceptMinBps === 'number' ? b.autoAcceptMinBps : 10000, fixedPrice: b.fixedPrice === true })
    return json({ ok: true, href: `/artworks/${id}/listing` })
  } catch (e) { return artworkErrorResponse(e) }
}
