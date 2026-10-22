// The member behind a login, born on demand (decision 2026-10-22: a
// collector becomes a COLLECTOR member of a PERSON tenant the first time an
// artwork is theirs), and the ownership move after a completed transfer.
// Lives in lib/tenant so that deals and ownership can import it without a
// cycle through lib/offers.
import 'server-only'
import type { Prisma } from '@/app/generated/prisma/client'
import { prisma } from '@/lib/prisma'
import { ensureTenant } from './ensure'
import { uniqueSlug } from './slug'
import { audit } from '@/lib/audit'

type Tx = Prisma.TransactionClient

/** The member that answers for the user's artworks: the existing one, or a COLLECTOR member born now. Idempotent. */
export async function ensureMemberForUser(tx: Tx, userId: number): Promise<{ memberId: number; tenantId: number; created: boolean }> {
  const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, memberId: true, tenantId: true, cpf: true, member: { select: { id: true, tenantId: true } } } })
  if (u.member) return { memberId: u.member.id, tenantId: u.member.tenantId, created: false }
  const tenant = await ensureTenant(tx, { kind: 'PERSON', name: u.name })
  const slug = await uniqueSlug(u.name, async (s) => !!(await tx.member.findUnique({ where: { slug: s }, select: { id: true } })))
  const m = await tx.member.create({ data: { userId: u.id, tenantId: tenant.id, kind: 'COLLECTOR', displayName: u.name, slug, status: 'ACTIVE' } })
  await tx.user.update({ where: { id: u.id }, data: { memberId: m.id, tenantId: tenant.id, tenantRole: u.tenantId ? undefined : 'ADMIN' } })
  return { memberId: m.id, tenantId: tenant.id, created: true }
}

export async function ensureCollectorMember(userId: number): Promise<{ memberId: number; tenantId: number }> {
  const r = await prisma.$transaction((tx) => ensureMemberForUser(tx, userId))
  if (r.created) void audit.event({ entity: 'member', entityId: r.memberId, action: 'create', userId, after: { kind: 'COLLECTOR' } })
  return r
}

/**
 * After a completed transfer the artwork belongs to the new holder: it moves to
 * their member (born now when the holder is a plain collector), leaves the sale
 * (AUTHENTICATED, no mandate) and is marked secondary market. Runs inside the
 * caller's transaction.
 */
export async function moveArtworkToHolder(tx: Tx, artworkId: number, holderUserId: number): Promise<{ memberId: number }> {
  const { memberId } = await ensureMemberForUser(tx, holderUserId)
  await tx.artwork.update({ where: { id: artworkId }, data: { memberId, status: 'AUTHENTICATED', market: 'SECONDARY', listingPausedAt: null, saleMode: null } })
  await tx.mandate.updateMany({ where: { artworkId, status: 'ACTIVE' }, data: { status: 'CLOSED' } })
  return { memberId }
}

