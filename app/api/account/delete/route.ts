import { NextResponse } from 'next/server'
import { COOKIE_NAME, requireAuth } from '@/lib/auth'
import { requestContext } from '@/lib/audit'
import { canSelfDelete, NOT_SELF_SERVICE_MESSAGE, openNegotiations, requestAccountDeletion } from '@/lib/accounts/deletion-server'
import { deletionBlocker } from '@/lib/accounts/deletion-core'
import { artworkErrorResponse } from '@/app/api/artworks/_http'

export const dynamic = 'force-dynamic'

/** What still blocks the deletion (the sheet shows it before asking for EXCLUIR), or that this account is closed by the desk. */
export async function GET() {
  try {
    const u = await requireAuth()
    const selfService = await canSelfDelete(u.id)
    const blocker = selfService ? deletionBlocker(await openNegotiations(u.id)) : null
    return NextResponse.json({ ok: true, selfService, blocker, message: selfService ? null : NOT_SELF_SERVICE_MESSAGE }, { headers: { 'cache-control': 'no-store' } })
  } catch (e) { return artworkErrorResponse(e) }
}

/** Excluir minha conta: closes the account at once (inactive, every session ended). */
export async function POST(req: Request) {
  try {
    const u = await requireAuth()
    const body = (await req.json().catch(() => ({}))) as { confirm?: unknown }
    await requestAccountDeletion(u.id, body.confirm, requestContext(req))
    const res = NextResponse.json({ ok: true })
    res.cookies.delete(COOKIE_NAME)
    return res
  } catch (e) { return artworkErrorResponse(e) }
}
