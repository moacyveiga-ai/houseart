import { NextResponse } from 'next/server'
import { flagGate } from '@/app/api/_flags'
import { appraisalDossier } from '@/lib/appraisal/server'
import { artworkErrorResponse, idParam, json } from '@/app/api/artworks/_http'
import { requireAppraiser } from '../_guard'

export async function GET(_req: Request, ctx: { params: Promise<{ requestId: string }> }) {
  const gate = flagGate('FLAG_APPRAISAL'); if (gate) return gate
  try {
    await requireAppraiser()
    const id = idParam((await ctx.params).requestId)
    const d = id ? await appraisalDossier(id) : null
    if (!d) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
    return json(d)
  } catch (e) { return artworkErrorResponse(e) }
}
