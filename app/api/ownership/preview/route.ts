import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { royaltyPreview } from '@/lib/ownership/server'
import { artworkErrorResponse, json } from '@/app/api/artworks/_http'

/** "Direito de sequência: R$ 275 (5% da valorização de R$ 5.500) será repassado a …" */
export async function GET(req: Request) {
  try {
    const u = await requireAuth()
    const sp = new URL(req.url).searchParams
    const artworkId = Number(sp.get('artworkId')), price = sp.get('priceCents')
    if (!Number.isInteger(artworkId) || !price) return NextResponse.json({ error: 'Parâmetros.' }, { status: 400 })
    return json(await royaltyPreview(u.id, artworkId, BigInt(price)))
  } catch (e) { return artworkErrorResponse(e) }
}
