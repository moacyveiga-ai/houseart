// Admin › Catálogo: one update per call — `kind` plan | service, `id`, and the fields. Admin and manager.
import { NextResponse } from 'next/server'
import { requireAuth, hasTotalScope } from '@/lib/auth'
import { requestContext } from '@/lib/audit'
import { canEditCatalog } from '@/lib/admin-catalog/core'
import { updatePlan, updateService } from '@/lib/admin-catalog/server'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const u = await requireAuth()
    if (!hasTotalScope(u) || !canEditCatalog(u)) return NextResponse.json({ error: 'Só admin e gestor editam o catálogo.' }, { status: 403 })
    const body = (await req.json().catch(() => ({}))) as { kind?: unknown; id?: unknown }
    const id = idParam(String(body.id ?? ''))
    if (!id) return NextResponse.json({ error: 'Item não encontrado.' }, { status: 404 })
    const actor = { userId: u.id, name: u.name, ...requestContext(req) }
    // the server parses: the row decides which limit keys exist and whether the service may be "under quote"
    if (body.kind === 'plan') return NextResponse.json({ ok: true, ...(await updatePlan(id, body, actor)) })
    if (body.kind === 'service') return NextResponse.json({ ok: true, ...(await updateService(id, body, actor)) })
    return NextResponse.json({ error: 'Tipo desconhecido.' }, { status: 400 })
  } catch (e) { return artworkErrorResponse(e) }
}
