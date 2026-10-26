import { NextResponse } from 'next/server'
import { requireStaff } from '@/lib/auth'
import { decideReviewItem, ReviewDecisionError } from '@/lib/admin-review/server'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireStaff()
    const id = idParam((await ctx.params).id)
    const body = await req.json().catch(() => ({})) as { decision?: string; note?: string }
    if (!id || (body.decision !== 'APPROVED' && body.decision !== 'REJECTED')) return NextResponse.json({ error: 'Decisão inválida.' }, { status: 400 })
    const item = await decideReviewItem(id, body.decision, { userId: user.id, name: user.name }, typeof body.note === 'string' ? body.note : null)
    if (!item) return NextResponse.json({ error: 'Este item já foi decidido por outra pessoa. Atualize a página.' }, { status: 409 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    if (e instanceof ReviewDecisionError) return NextResponse.json({ error: e.message }, { status: 400 })
    return artworkErrorResponse(e)
  }
}
