// Admin › Usuários e contas: one action per call — block | unblock | profile | reset | invite.
import { NextResponse } from 'next/server'
import { requireAuth, hasTotalScope } from '@/lib/auth'
import { requestContext } from '@/lib/audit'
import { resendTeamInvite, sendPasswordLink, setStaffProfile, setUserActive } from '@/lib/admin-users/server'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'

export const dynamic = 'force-dynamic'

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const u = await requireAuth()
    if (!hasTotalScope(u)) return NextResponse.json({ error: 'Só a equipe da HouseArt administra contas.' }, { status: 403 })
    const id = idParam((await ctx.params).id)
    if (!id) return NextResponse.json({ error: 'Conta não encontrada.' }, { status: 404 })
    const body = (await req.json().catch(() => ({}))) as { action?: unknown; profile?: unknown }
    const actor = { id: u.id, profile: u.profile, name: u.name, ...requestContext(req) }
    switch (body.action) {
      case 'block': return NextResponse.json({ ok: true, ...(await setUserActive(id, false, actor)) })
      case 'unblock': return NextResponse.json({ ok: true, ...(await setUserActive(id, true, actor)) })
      case 'profile': return NextResponse.json({ ok: true, ...(await setStaffProfile(id, body.profile, actor)) })
      case 'reset': return NextResponse.json(await sendPasswordLink(id, actor))
      case 'invite': return NextResponse.json(await resendTeamInvite(id, actor))
      default: return NextResponse.json({ error: 'Ação desconhecida.' }, { status: 400 })
    }
  } catch (e) { return artworkErrorResponse(e) }
}
