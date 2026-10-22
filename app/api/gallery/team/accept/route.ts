import { NextResponse } from 'next/server'
import { requireAuth, AuthError } from '@/lib/auth'
import { acceptInvite, inviteByToken } from '@/lib/gallery/team-server'
import { artworkErrorResponse } from '@/app/api/artworks/_http'

/** GET ?token= → what the invite is (gallery, role, e-mail); POST {token} → the logged user joins. */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get('token') ?? ''
  const i = token ? await inviteByToken(token) : null
  if (!i) return NextResponse.json({ ok: false, error: 'Convite inválido ou expirado.' }, { status: 404 })
  return NextResponse.json({ ok: true, invite: i }, { headers: { 'cache-control': 'no-store' } })
}

export async function POST(req: Request) {
  let u
  try { u = await requireAuth() } catch (e) { if (e instanceof AuthError) return NextResponse.json({ ok: false, error: 'Entre para aceitar o convite.' }, { status: 401 }); throw e }
  const body = await req.json().catch(() => ({})) as { token?: string }
  try {
    const r = await acceptInvite(String(body.token ?? ''), { id: u.id, email: u.email, name: u.name })
    if (!r.ok) return NextResponse.json(r, { status: 400 })
    return NextResponse.json({ ok: true, href: '/profiles' })
  } catch (e) { return artworkErrorResponse(e) }
}
