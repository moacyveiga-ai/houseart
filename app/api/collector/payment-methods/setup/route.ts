import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { createCardSetup } from '@/lib/stripe/door'
import { artworkErrorResponse } from '@/app/api/artworks/_http'

/** Test/live: opens a SetupIntent for the logged user; the card is typed in Stripe Elements, never sent here. */
export async function POST() {
  let u
  try { u = await requireAuth() } catch (e) { if (e instanceof AuthError) return NextResponse.json({ ok: false, error: 'Entre para continuar.' }, { status: 401 }); throw e }
  try { return NextResponse.json({ ok: true, ...(await createCardSetup(u.id)) }, { headers: { 'cache-control': 'no-store' } }) }
  catch (e) { return artworkErrorResponse(e) }
}
