import { NextResponse } from 'next/server'
import { requirePanel } from '@/lib/auth/panel'
import { estimateForArtwork } from '@/lib/appraisal/server'
import { estimateLine, shortBRL } from '@/lib/appraisal/estimate-core'
import { artworkErrorResponse, idParam, json } from '../../_http'

/** Step 5 of the wizard: the reference range, or `{ estimate: null }` without comparables. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { scope } = await requirePanel()
    const id = idParam((await ctx.params).id)
    if (!id) return NextResponse.json({ error: 'Obra não encontrada.' }, { status: 404 })
    const e = await estimateForArtwork(scope, id)
    return json({ estimate: e ? { ...e, minLabel: shortBRL(e.minCents), suggestedLabel: shortBRL(e.suggestedCents), maxLabel: shortBRL(e.maxCents), line: estimateLine(e) } : null })
  } catch (e) { return artworkErrorResponse(e) }
}
