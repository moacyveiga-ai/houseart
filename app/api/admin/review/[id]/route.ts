import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/auth'
import { decideReviewItem } from '@/lib/admin-review/server'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireStaff()
    const id = idParam((await ctx.params).id)
    const body = await req.json().catch(() => ({})) as { decision?: string }
    if (!id || (body.decision !== 'APPROVED' && body.decision !== 'REJECTED')) return NextResponse.json({ error: 'Decisão inválida.' }, { status: 400 })
    const item = await decideReviewItem(id, body.decision, { userId: user.id, name: user.name })
    if (!item) return NextResponse.json({ error: 'Item não encontrado ou já decidido.' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (e) { return artworkErrorResponse(e) }
}
