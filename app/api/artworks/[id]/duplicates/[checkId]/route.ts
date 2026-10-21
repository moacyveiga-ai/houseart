import { NextResponse } from 'next/server'
import { requirePanel } from '@/lib/auth/panel'
import { decideDuplicate } from '@/lib/artworks/server'
import { artworkErrorResponse, idParam } from '../../../_http'

export async function POST(req: Request, ctx: { params: Promise<{ id: string; checkId: string }> }) {
  try {
    const { scope, user } = await requirePanel()
    const p = await ctx.params
    const id = idParam(p.id), checkId = idParam(p.checkId)
    if (!id || !checkId) return NextResponse.json({ error: 'Verificação não encontrada.' }, { status: 404 })
    const body = await req.json().catch(() => ({})) as { decision?: string }
    if (body.decision !== 'DIFFERENT' && body.decision !== 'SAME') return NextResponse.json({ error: 'Decisão inválida.' }, { status: 400 })
    await decideDuplicate(scope, id, checkId, body.decision, user.id)
    return NextResponse.json({ ok: true })
  } catch (e) { return artworkErrorResponse(e) }
}
