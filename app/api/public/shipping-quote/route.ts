import { NextResponse } from 'next/server'
import { quoteForArtwork } from '@/lib/offers/server'
import { publicArtwork } from '@/lib/marketplace/public-server'

/** GET ?publicId=&cep=&priceCents= → the frozen-quote preview (cheapest carrier + transit insurance). */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const publicId = (sp.get('publicId') ?? '').toUpperCase()
  const cep = sp.get('cep') ?? ''
  const a = publicId ? await publicArtwork(publicId) : null
  if (!a) return NextResponse.json({ ok: false, error: 'Obra não encontrada.' }, { status: 404 })
  const price = BigInt(Math.max(0, Math.round(Number(sp.get('priceCents') ?? a.priceCents ?? 0))))
  const q = await quoteForArtwork({ publicId }, cep, price)
  return NextResponse.json({ ok: true, cep: q.cep, shippingCents: q.shippingCents.toString(), insuranceCents: q.insuranceCents.toString() }, { headers: { 'cache-control': 'no-store' } })
}
