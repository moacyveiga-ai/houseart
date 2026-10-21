import { NextResponse } from 'next/server'
import { requirePanel } from '@/lib/auth/panel'
import { moveOpportunity } from '@/lib/crm/server'
import { STAGES } from '@/lib/crm/core'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { scope } = await requirePanel()
    const id = idParam((await ctx.params).id)
    const body = await req.json().catch(() => ({})) as { stage?: string; outcome?: 'WON' | 'LOST' | null }
    if (!id || !body.stage || !(STAGES as readonly string[]).includes(body.stage)) return NextResponse.json({ error: 'Etapa inválida.' }, { status: 400 })
    await moveOpportunity(scope, id, body.stage as (typeof STAGES)[number], body.outcome ?? null)
    return NextResponse.json({ ok: true })
  } catch (e) { return artworkErrorResponse(e) }
}
