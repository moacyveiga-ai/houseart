import { NextResponse } from 'next/server'
import { z } from 'zod'
import { removeFromTeam, setRole, teamOf } from '@/lib/gallery/team-server'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'
import { gallerySession, isResponse } from '../../_http'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: Request, ctx: Ctx) {
  const s = await gallerySession(); if (isResponse(s)) return s
  const id = idParam((await ctx.params).id); if (!id) return NextResponse.json({ ok: false }, { status: 404 })
  const parsed = z.object({ role: z.string().max(20) }).safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ ok: false, error: 'Dados inválidos.' }, { status: 400 })
  try {
    const ok = await setRole(s.scope, id, parsed.data.role, { userId: s.user.id })
    return NextResponse.json({ ok, people: await teamOf(s.scope, s.user.id) }, { status: ok ? 200 : 404 })
  } catch (e) { return artworkErrorResponse(e) }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const s = await gallerySession(); if (isResponse(s)) return s
  const id = idParam((await ctx.params).id); if (!id) return NextResponse.json({ ok: false }, { status: 404 })
  try {
    const ok = await removeFromTeam(s.scope, id, { userId: s.user.id })
    return NextResponse.json({ ok, people: await teamOf(s.scope, s.user.id) }, { status: ok ? 200 : 404 })
  } catch (e) { return artworkErrorResponse(e) }
}
