import { NextResponse } from 'next/server'
import { z } from 'zod'
import { invite, teamOf } from '@/lib/gallery/team-server'
import { artworkErrorResponse } from '@/app/api/artworks/_http'
import { gallerySession, isResponse } from '../_http'

export async function GET() {
  const s = await gallerySession(); if (isResponse(s)) return s
  return NextResponse.json({ ok: true, people: await teamOf(s.scope, s.user.id) }, { headers: { 'cache-control': 'no-store' } })
}

/** Invite by e-mail (blind when the e-mail is already on the team). */
export async function POST(req: Request) {
  const s = await gallerySession(); if (isResponse(s)) return s
  const parsed = z.object({ email: z.string().max(254), role: z.string().max(20) }).safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 })
  try {
    const r = await invite(s.scope, parsed.data.email, parsed.data.role, { userId: s.user.id, name: s.user.name })
    if (!r.ok) return NextResponse.json(r, { status: 400 })
    return NextResponse.json({ ok: true, people: await teamOf(s.scope, s.user.id) })
  } catch (e) { return artworkErrorResponse(e) }
}
