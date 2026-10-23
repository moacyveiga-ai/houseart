import { NextResponse } from 'next/server'
import { requirePanel } from '@/lib/auth/panel'
import { AuthError } from '@/lib/auth'
import { requireSellerRole, RULES_ROLES } from '@/lib/offers/seller-role-server'
import { artworkErrorResponse } from '@/app/api/artworks/_http'

export { artworkErrorResponse }

/**
 * The Connect routes: a panel session with a seller member; in a gallery team only
 * the ADMIN connects the gallery's account (the same list as the offer rules). The
 * account belongs to the logged member — for a gallery, the admin's member, which
 * the payout resolves for the GALLERY line of every deal of the tenant.
 */
export async function connectMember(): Promise<{ memberId: number } | NextResponse> {
  try {
    const { user, scope } = await requirePanel()
    if (!user.memberId) return NextResponse.json({ ok: false, error: 'Só membros que vendem conectam uma conta Stripe.' }, { status: 403 })
    await requireSellerRole(scope, RULES_ROLES, 'Só o administrador da galeria conecta a conta Stripe.')
    return { memberId: user.memberId }
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ ok: false, error: e.message }, { status: e.status ?? 401 })
    return artworkErrorResponse(e)
  }
}
export const isResponse = (v: unknown): v is NextResponse => v instanceof NextResponse
