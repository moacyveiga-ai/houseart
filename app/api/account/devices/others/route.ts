import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { signOutOtherDevices } from '@/lib/auth/devices-server'
import { artworkErrorResponse } from '@/app/api/artworks/_http'

/** Perfil › Aparelhos conectados › "Sair de todos os outros". */
export async function POST() {
  try {
    const u = await requireAuth()
    return NextResponse.json({ ok: true, count: await signOutOtherDevices(u.id, u.sessionId) })
  } catch (e) { return artworkErrorResponse(e) }
}
