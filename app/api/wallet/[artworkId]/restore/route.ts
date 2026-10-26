import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { recordRestoration } from '@/lib/collector-wallet/server'
import { parseRestorationInput } from '@/lib/collector-wallet/restore-core'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'
import { diaNoFuso } from '@/lib/timezone'
import { requestContext } from '@/lib/audit'

export async function POST(req: Request, ctx: { params: Promise<{ artworkId: string }> }) {
  try {
    const u = await requireAuth()
    const id = idParam((await ctx.params).artworkId)
    if (!id) return NextResponse.json({ error: 'Obra não encontrada.' }, { status: 404 })
    const parsed = parseRestorationInput(await req.json().catch(() => ({})), diaNoFuso(new Date()) ?? new Date().toISOString().slice(0, 10))
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 422 })
    const r = await recordRestoration(u.id, id, parsed.value, requestContext(req))
    return NextResponse.json({ ok: true, seq: r.seq })
  } catch (e) { return artworkErrorResponse(e) }
}
