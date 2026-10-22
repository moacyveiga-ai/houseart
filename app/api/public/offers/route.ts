import { NextResponse } from 'next/server'
import { z } from 'zod'
import { startPublicOffer } from '@/lib/offers/server'
import { consumeOrAllow, rateLimitResponse } from '@/lib/rate-limit'
import { rawIpFromHeaders } from '@/lib/http/ip'
import { getSession } from '@/lib/auth'

const schema = z.object({ publicId: z.string().min(10).max(20), buyerName: z.string().trim().min(3).max(120), buyerEmail: z.string().max(254), buyerDocument: z.string().min(11).max(20), buyerCity: z.string().max(80).optional(), offeredCents: z.union([z.number(), z.string()]), message: z.string().max(500).optional(), validityHours: z.number().int().optional(), guaranteeMethod: z.string().max(30).optional(), paymentMethodId: z.number().int().optional(), deliveryCep: z.string().max(12).optional() })

/** Public proposal: starts with an OTP to the buyer's e-mail (blind response). */
export async function POST(req: Request) {
  const ip = rawIpFromHeaders(req.headers)
  const brake = await consumeOrAllow({ key: `offer:ip:${ip}`, limit: 10, windowMs: 3_600_000 })
  if (!brake.allowed) return rateLimitResponse(brake)
  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Dados incompletos.' }, { status: 400 })
  const session = await getSession().catch(() => null)
  const offeredCents = BigInt(Math.round(Number(String(parsed.data.offeredCents).replace(/[^\d.]/g, ''))))
  const r = await startPublicOffer({ ...parsed.data, offeredCents, buyerUserId: session?.id ?? null, publicId: parsed.data.publicId.toUpperCase() })
  if (!r.ok) return NextResponse.json(r, { status: 400 })
  // A verified logged buyer skips the OTP: the page link comes back at once (token handed ONCE).
  if (r.confirmed) return NextResponse.json({ ok: true, code: r.code, confirmed: true, token: r.retractionToken, href: `/e/offer/${r.code}` }, { headers: { 'cache-control': 'no-store' } })
  return NextResponse.json({ ok: true, code: r.code, confirmed: false, message: 'Enviamos um código para o seu e-mail.' })
}
