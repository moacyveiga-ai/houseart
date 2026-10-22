import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { heldArtworks } from '@/lib/ownership/server'
import { sellEstimate } from '@/components/collector/seller-core'
import { artworkErrorResponse, idParam, json } from '@/app/api/artworks/_http'

export const dynamic = 'force-dynamic'

/**
 * "Revise o anúncio" of the mobile app (App Colecionador › Vender uma obra): the
 * estimate of the web SellSheet (`sellEstimate`: 8 % the buyer pays on top, 4 %
 * the seller leaves, the resale royalty of 5 % over the appreciation against the
 * registered value), computed here so the app never does the money math.
 * `?listPriceCents=` is the asked price. Only an artwork the person holds; any
 * other is 404.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireAuth()
    const id = idParam((await ctx.params).id)
    const raw = new URL(req.url).searchParams.get('listPriceCents') ?? ''
    if (!/^\d{1,15}$/.test(raw)) return NextResponse.json({ error: 'Informe o preço pedido.' }, { status: 400 })
    const held = id ? (await heldArtworks(u.id)).find((v) => v.certificate.artwork.id === id) : null
    if (!held) return NextResponse.json({ error: 'Obra não encontrada.' }, { status: 404 })
    const registered = held.certificate.artwork.listPriceCents ?? null
    return json({ ok: true, estimate: sellEstimate(BigInt(raw), registered), registeredCents: registered }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) { return artworkErrorResponse(e) }
}
