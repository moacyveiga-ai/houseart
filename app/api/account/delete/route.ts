import { NextResponse } from 'next/server'
import { COOKIE_NAME, requireAuth } from '@/lib/auth'
import { requestContext } from '@/lib/audit'
import { openNegotiations, requestAccountDeletion } from '@/lib/accounts/deletion-server'
import { deletionBlocker } from '@/lib/accounts/deletion-core'
import { artworkErrorResponse } from '@/app/api/artworks/_http'

export const dynamic = 'force-dynamic'

/** What still blocks the deletion (the sheet shows it before asking for EXCLUIR). */
export async function GET() {
  try { const u = await requireAuth(); return NextResponse.json({ ok: true, blocker: deletionBlocker(await openNegotiations(u.id)) }, { headers: { 'cache-control': 'no-store' } }) } catch (e) { return artworkErrorResponse(e) }
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
