// Admin › Transferências: one action per call — resend (the buyer's invite) | cancel (`note`) | refund (retry the fee). Admin and manager.
import { NextResponse } from 'next/server'
import { requireAuth, hasTotalScope } from '@/lib/auth'
import { requestContext } from '@/lib/audit'
import { canManageTransfers } from '@/lib/admin-transfers/core'
import { cancelTransfer, resendInvite, retryFeeRefund } from '@/lib/admin-transfers/server'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireAuth()
    if (!hasTotalScope(u) || !canManageTransfers(u)) return NextResponse.json({ error: 'Só admin e gestor mexem nas transferências.' }, { status: 403 })
    const id = idParam((await ctx.params).id)
    if (!id) return NextResponse.json({ error: 'Transferência não encontrada.' }, { status: 404 })
    const body = (await req.json().catch(() => ({}))) as { action?: unknown; note?: unknown }
    const actor = { profile: u.profile, userId: u.id, name: u.name, ...requestContext(req) }
    switch (body.action) {
      case 'resend': return NextResponse.json(await resendInvite(id, actor))
      case 'cancel': return NextResponse.json({ ok: true, ...(await cancelTransfer(id, body.note, actor)) })
      case 'refund': return NextResponse.json({ ok: true, ...(await retryFeeRefund(id, actor)) })
      default: return NextResponse.json({ error: 'Ação desconhecida.' }, { status: 400 })
    }
  } catch (e) { return artworkErrorResponse(e) }
}
