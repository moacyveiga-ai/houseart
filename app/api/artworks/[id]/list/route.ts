import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePanel } from '@/lib/auth/panel'
import { listArtworkForSale } from '@/lib/offers/server'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'

const cents = z.union([z.number(), z.string()]).transform((v) => BigInt(Math.round(Number(String(v).replace(/[^\d.]/g, '')))))
const schema = z.object({ listPriceCents: cents, reservePriceCents: cents, autoNegotiatorOn: z.boolean().default(false), autoAcceptMinBps: z.number().int().default(9200), fixedPrice: z.boolean().default(false) })

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { scope, user } = await requirePanel()
    const id = idParam((await ctx.params).id)
    if (!id) return NextResponse.json({ error: 'Obra não encontrada.' }, { status: 404 })
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 })
    await listArtworkForSale(scope, id, parsed.data, { userId: user.id })
    return NextResponse.json({ ok: true })
  } catch (e) { return artworkErrorResponse(e) }
}
