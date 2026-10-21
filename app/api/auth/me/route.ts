import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function GET() {
  const u = await getSession()
  if (!u) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  return NextResponse.json({ id: u.id, name: u.name, email: u.email, profile: u.profile, activeProfileKind: u.activeProfileKind, memberId: u.memberId, tenantId: u.tenantId })
}
