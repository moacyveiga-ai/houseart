import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { offersOfUser } from '@/lib/offers/server'

/** The logged buyer's proposals (Compras › Ofertas). BigInt as string. */
export async function GET() {
  try {
    const u = await requireAuth()
    const offers = await offersOfUser(u.id)
    return NextResponse.json({ ok: true, offers: JSON.parse(JSON.stringify(offers, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))) }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) { if (e instanceof AuthError) return NextResponse.json({ ok: false }, { status: 401 }); throw e }
}
