import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePanel } from '@/lib/auth/panel'
import { changeListPrice, listingOf, setAcceptsOffers, setPaused } from '@/lib/gallery/listing-server'
import { artworkErrorResponse, idParam, json } from '../../_http'

// the price-drop notice to the people who saved the work runs after the response
export const maxDuration = 60

type Ctx = { params: Promise<{ id: string }> }
const schema = z.object({ listPriceCents: z.union([z.number(), z.string()]).optional(), acceptsOffers: z.boolean().optional(), paused: z.boolean().optional() })

/** "Gestão do anúncio": stats + price / accepts offers / pause. */
export async function GET(_req: Request, ctx: Ctx) {
  try {
    const { scope } = await requirePanel()
    const id = idParam((await ctx.params).id); if (!id) return NextResponse.json({ error: 'Obra não encontrada.' }, { status: 404 })
    const v = await listingOf(scope, id)
    return v ? json({ listing: v }) : NextResponse.json({ error: 'A obra não está à venda.' }, { status: 404 })
  } catch (e) { return artworkErrorResponse(e) }
}

export async function PATCH(req: Request, ctx: Ctx) {
  try {
    const { scope, user } = await requirePanel()
    const id = idParam((await ctx.params).id); if (!id) return NextResponse.json({ error: 'Obra não encontrada.' }, { status: 404 })
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
    const actor = { userId: user.id }
    let v = await listingOf(scope, id)
    // pause first: a price cut sent together with a pause tells nobody about a work going off the marketplace
    if (parsed.data.paused !== undefined) v = await setPaused(scope, id, parsed.data.paused, actor)
    if (parsed.data.listPriceCents !== undefined) v = await changeListPrice(scope, id, BigInt(Math.round(Number(String(parsed.data.listPriceCents).replace(/[^\d.]/g, '')))), actor)
    if (parsed.data.acceptsOffers !== undefined) v = await setAcceptsOffers(scope, id, parsed.data.acceptsOffers, actor)
    return v ? json({ listing: v }) : NextResponse.json({ error: 'A obra não está à venda.' }, { status: 404 })
  } catch (e) { return artworkErrorResponse(e) }
}
