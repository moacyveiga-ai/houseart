import { NextResponse } from 'next/server'
import { flagGate } from '@/app/api/_flags'
import { appraisalDossier, assignAppraiser, cancelRequest, setDueDay, takeRequest } from '@/lib/appraisal/server'
import { requestContext } from '@/lib/audit'
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

/**
 * The desk's actions on a request, one per call: `take` (an appraiser holds an open request),
 * `assign` (team: `appraiserUserId`, or null to free it), `due` (team: `dueDay` yyyy-mm-dd),
 * `cancel` (team: `note` required). Issuing stays in /issue.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ requestId: string }> }) {
  const gate = flagGate('FLAG_APPRAISAL'); if (gate) return gate
  try {
    const u = await requireAppraiser()
    const id = idParam((await ctx.params).requestId)
    if (!id) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })
    const body = (await req.json().catch(() => ({}))) as { action?: unknown; appraiserUserId?: unknown; dueDay?: unknown; note?: unknown }
    const actor = { userId: u.id, profile: u.profile, name: u.name, ...requestContext(req) }
    switch (body.action) {
      case 'take': return json({ ok: true, ...(await takeRequest(id, actor)) })
      case 'assign': {
        const who = body.appraiserUserId === null ? null : Number(body.appraiserUserId)
        if (who !== null && !(Number.isInteger(who) && who > 0 && who < 1e9)) return NextResponse.json({ error: 'Escolha um avaliador.' }, { status: 422 })
        return json({ ok: true, ...(await assignAppraiser(id, who, actor)) })
      }
      case 'due': return json({ ok: true, ...(await setDueDay(id, body.dueDay, actor)) })
      case 'cancel': return json({ ok: true, ...(await cancelRequest(id, body.note, actor)) })
      default: return NextResponse.json({ error: 'Ação desconhecida.' }, { status: 400 })
    }
  } catch (e) { return artworkErrorResponse(e) }
}
