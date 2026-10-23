// Who of a gallery team may act as seller (Phase 6 roles): Admin does everything,
// Vendas answers offers and manages the listing, Acervo only registers and
// certifies. Artists, advisors and collectors (no team) are never restricted here.
import 'server-only'
import { prisma } from '@/lib/prisma'
import type { Scope } from '@/lib/scope/core'
import { ArtworkError } from '@/lib/artworks/server'
import type { SellerRole } from './seller-role-core'

export type { SellerRole } from './seller-role-core'
export { OFFER_ROLES, LISTING_ROLES, RULES_ROLES } from './seller-role-core'

/** The effective team role of the person behind the scope, or null when the scope is not a gallery team member. */
export async function galleryRoleOf(scope: Scope): Promise<SellerRole | null> {
  if (scope.kind !== 'tenant' || !scope.memberId) return null
  const m = await prisma.member.findUnique({ where: { id: scope.memberId }, select: { kind: true, role: true, user: { select: { tenantRole: true } } } })
  if (!m || m.kind !== 'GALLERY_STAFF') return null
  if (m.role === 'ADMIN' || m.user?.tenantRole === 'ADMIN') return 'ADMIN'
  return m.role === 'INVENTORY' ? 'INVENTORY' : 'SALES'
}

/** Throws 403 when a gallery team member's role is not in `allowed`. */
export async function requireSellerRole(scope: Scope, allowed: readonly SellerRole[], message: string): Promise<void> {
  const role = await galleryRoleOf(scope)
  if (role && !allowed.includes(role)) throw new ArtworkError('FORBIDDEN', message, 403)
}
