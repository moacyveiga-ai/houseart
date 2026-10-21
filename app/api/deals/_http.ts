import { NextResponse } from 'next/server'
import { requireAuth, type SessionUser } from '@/lib/auth'
import { requirePanel } from '@/lib/auth/panel'
import { flagGate } from '@/app/api/_flags'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'

export { artworkErrorResponse, idParam }

/** A deal route: 404 without FLAG_DEALS, then the session (buyer or seller). */
export async function dealContext(ctx: { params: Promise<{ id: string }> }): Promise<{ gate: NextResponse } | { gate: null; id: number; user: SessionUser; scope: Awaited<ReturnType<typeof requirePanel>>['scope'] | null }> {
  const gate = flagGate('FLAG_DEALS')
  if (gate) return { gate }
  const id = idParam((await ctx.params).id)
  if (!id) return { gate: NextResponse.json({ error: 'Negócio não encontrado.' }, { status: 404 }) }
  const user = await requireAuth()
  const scope = user.profile === 'collector' ? null : (await requirePanel()).scope
  return { gate: null, id, user, scope }
}
