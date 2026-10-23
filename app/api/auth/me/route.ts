import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { scopeOfSession } from '@/lib/auth/panel'
import { galleryRoleOf } from '@/lib/offers/seller-role-server'

export async function GET() {
  const u = await getSession()
  if (!u) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  // The effective gallery team role (ADMIN · SALES · INVENTORY), null outside a gallery team:
  // the apps hide what the role cannot do (the server refuses it anyway).
  const teamRole = await galleryRoleOf(scopeOfSession(u))
  return NextResponse.json({ id: u.id, name: u.name, email: u.email, profile: u.profile, activeProfileKind: u.activeProfileKind, memberId: u.memberId, tenantId: u.tenantId, teamRole })
}
