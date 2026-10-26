// Admin › KYC: one decision per call — approve | reject (note required) | revalidate. Admin and manager.
import { NextResponse } from 'next/server'
import { requireAuth, hasTotalScope } from '@/lib/auth'
import { requestContext } from '@/lib/audit'
import { canDecideKyc } from '@/lib/admin-kyc/core'
import { approveKyc, rejectKyc, revalidateKyc } from '@/lib/admin-kyc/server'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireAuth()
    if (!hasTotalScope(u) || !canDecideKyc(u)) return NextResponse.json({ error: 'Só admin e gestor decidem a identidade.' }, { status: 403 })
    const id = idParam((await ctx.params).id)
    if (!id) return NextResponse.json({ error: 'Verificação não encontrada.' }, { status: 404 })
    const body = (await req.json().catch(() => ({}))) as { action?: unknown; note?: unknown }
    const actor = { profile: u.profile, userId: u.id, name: u.name, ...requestContext(req) }
    switch (body.action) {
      case 'approve': return NextResponse.json({ ok: true, ...(await approveKyc(id, body.note, actor)) })
      case 'reject': return NextResponse.json({ ok: true, ...(await rejectKyc(id, body.note, actor)) })
      case 'revalidate': return NextResponse.json({ ok: true, ...(await revalidateKyc(id, body.note, actor)) })
      default: return NextResponse.json({ error: 'Ação desconhecida.' }, { status: 400 })
    }
  } catch (e) { return artworkErrorResponse(e) }
}
