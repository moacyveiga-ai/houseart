import { NextResponse } from 'next/server'
import { requireAuth, type SessionUser } from '@/lib/auth'
import { requirePanel, scopeOfSession } from '@/lib/auth/panel'
import { enterScope } from '@/lib/scope/context'
import type { Scope } from '@/lib/scope/core'
import { sideOfDeal } from '@/lib/deals/server'
import { flagGate } from '@/app/api/_flags'
import { artworkErrorResponse, idParam } from '@/app/api/artworks/_http'

export { artworkErrorResponse, idParam }

/**
 * A deal route: 404 without FLAG_DEALS, then the session and the SIDE of this
 * deal — buyer or seller decided by the deal itself (a collector also sells, an
 * artist or a gallery also buys). Someone who is neither gets 404.
 */
export async function dealContext(ctx: { params: Promise<{ id: string }> }): Promise<{ gate: NextResponse } | { gate: null; id: number; user: SessionUser; scope: Scope | null; side: 'BUYER' | 'SELLER' }> {
  const gate = flagGate('FLAG_DEALS')
  if (gate) return { gate }
  const id = idParam((await ctx.params).id)
  if (!id) return { gate: NextResponse.json({ error: 'Negócio não encontrado.' }, { status: 404 }) }
  const user = await requireAuth()
  let scope: Scope | null
  if (user.profile === 'collector') {
    // a collector who owns works sells through their own member (secondary market)
    scope = user.memberId ? scopeOfSession(user) : null
    if (scope) enterScope(scope, 'dealContext')
  } else {
    scope = (await requirePanel()).scope
  }
  const side = await sideOfDeal(id, user.id, scope)
  if (!side) return { gate: NextResponse.json({ error: 'Negócio não encontrado.' }, { status: 404 }) }
  return { gate: null, id, user, scope, side }
}
