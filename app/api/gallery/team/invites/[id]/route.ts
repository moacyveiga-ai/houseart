import { NextResponse } from 'next/server'
import { revokeInvite, teamOf } from '@/lib/gallery/team-server'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'
import { gallerySession, isResponse } from '../../../_http'

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const s = await gallerySession(); if (isResponse(s)) return s
  const id = idParam((await ctx.params).id); if (!id) return NextResponse.json({ ok: false }, { status: 404 })
  try {
    const ok = await revokeInvite(s.scope, id)
    return NextResponse.json({ ok, people: await teamOf(s.scope, s.user.id) }, { status: ok ? 200 : 404 })
  } catch (e) { return artworkErrorResponse(e) }
}
