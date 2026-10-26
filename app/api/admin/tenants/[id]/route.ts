// Admin › Galerias e contas: one action per call — plan (courtesy, `code` + `note`) | suspend (`note`) | reinstate. Admin and manager.
import { NextResponse } from 'next/server'
import { requireAuth, hasTotalScope } from '@/lib/auth'
import { requestContext } from '@/lib/audit'
import { canManageTenants } from '@/lib/admin-tenants/core'
import { grantPlan, setTenantStatus } from '@/lib/admin-tenants/server'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireAuth()
    if (!hasTotalScope(u) || !canManageTenants(u)) return NextResponse.json({ error: 'Só admin e gestor administram as contas.' }, { status: 403 })
    const id = idParam((await ctx.params).id)
    if (!id) return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 })
    const body = (await req.json().catch(() => ({}))) as { action?: unknown; code?: unknown; note?: unknown }
    const actor = { profile: u.profile, userId: u.id, name: u.name, ...requestContext(req) }
    switch (body.action) {
      case 'plan': return NextResponse.json({ ok: true, ...(await grantPlan(id, body.code, body.note, actor)) })
      case 'suspend': return NextResponse.json({ ok: true, ...(await setTenantStatus(id, 'SUSPENDED', body.note, actor)) })
      case 'reinstate': return NextResponse.json({ ok: true, ...(await setTenantStatus(id, 'ACTIVE', body.note, actor)) })
      default: return NextResponse.json({ error: 'Ação desconhecida.' }, { status: 400 })
    }
  } catch (e) { return artworkErrorResponse(e) }
}
