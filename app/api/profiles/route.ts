import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { errorResponse } from '@/lib/auth/route'
import { PROFILE_KINDS } from '@/lib/profiles/core'
import { profilesOf, switchProfile } from '@/lib/profiles/server'
import { homeOf } from '@/lib/profiles/nav'

export async function GET() {
  try {
    const user = await requireAuth()
    return NextResponse.json({ active: user.activeProfileKind, profiles: await profilesOf(user) })
  } catch (e) { return errorResponse(e) }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth()
    const body = await req.json().catch(() => ({})) as { kind?: string }
    const kind = String(body.kind ?? '')
    if (!(PROFILE_KINDS as readonly string[]).includes(kind)) return NextResponse.json({ error: 'Perfil inválido.' }, { status: 400 })
    const r = await switchProfile(user, kind as (typeof PROFILE_KINDS)[number])
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 403 })
    return NextResponse.json({ ok: true, home: homeOf(r.nav) })
  } catch (e) { return errorResponse(e) }
}
