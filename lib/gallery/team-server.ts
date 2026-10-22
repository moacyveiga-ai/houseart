// Gallery team — I/O. Members of the tenant (users with a GALLERY_STAFF member)
// and pending invites. Invite by e-mail with a 7-day token (sha256 at rest);
// accepting attaches the logged user to the gallery tenant.
import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { tenantOfScope, type Scope } from '@/lib/scope/core'
import { ArtworkError } from '@/lib/artworks/server'
import { normalizeEmail } from '@/lib/auth/credential'
import { sendEmail } from '@/lib/email/send'
import { afterResponse } from '@/lib/after'
import { publicBaseUrl } from '@/lib/public-url'
import { audit } from '@/lib/audit'
import { uniqueSlug } from '@/lib/tenant/slug'
import { INVITE_TTL_DAYS, TEAM_ROLES, TEAM_ROLE_LABELS, type TeamRole } from './domain'

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex')

export interface TeamPerson { kind: 'MEMBER' | 'INVITE'; id: number; name: string; email: string | null; role: TeamRole; roleLabel: string; sub: string; isSelf: boolean }

async function requireTenantAdmin(scope: Scope): Promise<number> {
  if (scope.kind !== 'tenant' && scope.kind !== 'total') throw new ArtworkError('FORBIDDEN', 'Só o administrador da galeria gere a equipe.', 403)
  const tenantId = tenantOfScope(scope)
  if (!tenantId) throw new ArtworkError('NO_TENANT', 'Galeria não encontrada.', 404)
  if (scope.kind === 'tenant' && scope.memberId) {
    // Sales and inventory staff see the gallery but do not manage the team.
    const m = await prisma.member.findUnique({ where: { id: scope.memberId }, select: { role: true, user: { select: { tenantRole: true } } } })
    if (m && m.role !== 'ADMIN' && m.user?.tenantRole !== 'ADMIN') throw new ArtworkError('FORBIDDEN', 'Só o administrador da galeria gere a equipe.', 403)
  }
  return tenantId
}

export async function teamOf(scope: Scope, selfUserId: number): Promise<TeamPerson[]> {
  const tenantId = tenantOfScope(scope)
  if (!tenantId) return []
  const members = await prisma.member.findMany({ where: { tenantId, kind: 'GALLERY_STAFF', status: 'ACTIVE' }, include: { user: { select: { id: true, name: true, email: true, tenantRole: true } } }, orderBy: { id: 'asc' } })
  const invites = await prisma.teamInvite.findMany({ where: { tenantId, status: 'PENDING', expiresAt: { gt: new Date() } }, orderBy: { id: 'asc' } })
  const people: TeamPerson[] = members.map((m) => {
    const role = ((m.role && (TEAM_ROLES as readonly string[]).includes(m.role) ? m.role : m.user?.tenantRole === 'ADMIN' ? 'ADMIN' : 'SALES') as TeamRole)
    return { kind: 'MEMBER' as const, id: m.id, name: m.user?.name ?? m.displayName, email: m.user?.email ?? null, role, roleLabel: TEAM_ROLE_LABELS[role].name, sub: TEAM_ROLE_LABELS[role].sub, isSelf: m.user?.id === selfUserId }
  })
  for (const i of invites) {
    const days = Math.max(0, Math.floor((Date.now() - i.createdAt.getTime()) / 86_400_000))
    people.push({ kind: 'INVITE', id: i.id, name: i.email, email: i.email, role: i.role as TeamRole, roleLabel: 'Pendente', sub: `Convite enviado ${days === 0 ? 'hoje' : `há ${days} dia${days === 1 ? '' : 's'}`}`, isSelf: false })
  }
  return people
}

/** Invites by e-mail. Blind on an e-mail that already belongs to the team (no second row, no error). */
export async function invite(scope: Scope, rawEmail: string, role: string, actor: { userId: number; name: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const tenantId = await requireTenantAdmin(scope)
  const email = normalizeEmail(rawEmail)
  if (!email) return { ok: false, error: 'Informe um e-mail válido.' }
  if (!(TEAM_ROLES as readonly string[]).includes(role)) return { ok: false, error: 'Papel inválido.' }
  const already = await prisma.member.findFirst({ where: { tenantId, kind: 'GALLERY_STAFF', status: 'ACTIVE', user: { email } }, select: { id: true } })
  if (already) return { ok: true }
  await prisma.teamInvite.updateMany({ where: { tenantId, email, status: 'PENDING' }, data: { status: 'REVOKED' } })
  const token = randomBytes(24).toString('base64url')
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } })
  await prisma.teamInvite.create({ data: { tenantId, email, role, tokenHash: sha256(token), invitedByUserId: actor.userId, expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000) } })
  const link = `${publicBaseUrl()}/team/accept?token=${encodeURIComponent(token)}`
  afterResponse('team: invite e-mail', () => sendEmail({ to: email, subject: `${actor.name} convidou você para a equipe de ${tenant.name} na HouseArt`, text: `Você foi convidado(a) para a equipe de ${tenant.name} na HouseArt, com o papel ${TEAM_ROLE_LABELS[role as TeamRole].name}. Entre (ou crie sua conta com este e-mail) e abra o link em até ${INVITE_TTL_DAYS} dias: ${link}`, redactedPreview: 'convite de equipe' }))
  void audit.event({ entity: 'team_invite', entityId: tenantId, action: 'invite', userId: actor.userId, after: { role } })
  return { ok: true }
}

export async function revokeInvite(scope: Scope, inviteId: number): Promise<boolean> {
  const tenantId = await requireTenantAdmin(scope)
  const r = await prisma.teamInvite.updateMany({ where: { id: inviteId, tenantId, status: 'PENDING' }, data: { status: 'REVOKED' } })
  return r.count > 0
}

export async function setRole(scope: Scope, memberId: number, role: string, actor: { userId: number }): Promise<boolean> {
  const tenantId = await requireTenantAdmin(scope)
  if (!(TEAM_ROLES as readonly string[]).includes(role)) return false
  const m = await prisma.member.findFirst({ where: { id: memberId, tenantId, kind: 'GALLERY_STAFF' }, include: { user: { select: { id: true } } } })
  if (!m) return false
  if (m.user?.id === actor.userId && role !== 'ADMIN') throw new ArtworkError('SELF_DEMOTE', 'Você não pode tirar o próprio papel de admin.', 409)
  await prisma.$transaction([
    prisma.member.update({ where: { id: m.id }, data: { role } }),
    ...(m.user ? [prisma.user.update({ where: { id: m.user.id }, data: { tenantRole: role === 'ADMIN' ? 'ADMIN' : 'MEMBER' } })] : []),
  ])
  void audit.event({ entity: 'member', entityId: m.id, action: 'set_role', userId: actor.userId, after: { role } })
  return true
}

export async function removeFromTeam(scope: Scope, memberId: number, actor: { userId: number }): Promise<boolean> {
  const tenantId = await requireTenantAdmin(scope)
  const m = await prisma.member.findFirst({ where: { id: memberId, tenantId, kind: 'GALLERY_STAFF', status: 'ACTIVE' }, include: { user: { select: { id: true } } } })
  if (!m) return false
  if (m.user?.id === actor.userId) throw new ArtworkError('SELF_REMOVE', 'Você não pode se remover da própria galeria.', 409)
  await prisma.$transaction([
    prisma.member.update({ where: { id: m.id }, data: { status: 'INACTIVE' } }),
    ...(m.user ? [prisma.user.update({ where: { id: m.user.id }, data: { tenantId: null, tenantRole: null, memberId: null } })] : []),
  ])
  void audit.event({ entity: 'member', entityId: m.id, action: 'remove_from_team', userId: actor.userId })
  return true
}

/** What the invite page shows before accepting (never the token back). */
export async function inviteByToken(token: string): Promise<{ galleryName: string; role: TeamRole; email: string } | null> {
  const i = await prisma.teamInvite.findUnique({ where: { tokenHash: sha256(token) } })
  if (!i || i.status !== 'PENDING' || i.expiresAt < new Date()) return null
  const t = await prisma.tenant.findUnique({ where: { id: i.tenantId }, select: { name: true } })
  return t ? { galleryName: t.name, role: i.role as TeamRole, email: i.email } : null
}

/**
 * The logged user accepts: the invite e-mail must be the account's; the user
 * joins the gallery tenant as GALLERY_STAFF with the role. A user who already
 * sells under another tenant with artworks is refused (one portfolio each).
 */
export async function acceptInvite(token: string, user: { id: number; email: string; name: string }): Promise<{ ok: true; tenantId: number } | { ok: false; error: string }> {
  const i = await prisma.teamInvite.findUnique({ where: { tokenHash: sha256(token) } })
  if (!i || i.status !== 'PENDING' || i.expiresAt < new Date()) return { ok: false, error: 'Convite inválido ou expirado. Peça um novo convite.' }
  if (normalizeEmail(user.email) !== i.email) return { ok: false, error: 'Este convite é para outro e-mail. Entre com a conta convidada.' }
  const u = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { member: { include: { _count: { select: { artworks: true } } } } } })
  if (u.member && u.member.tenantId !== i.tenantId && u.member._count.artworks > 0) return { ok: false, error: 'Sua conta já vende por outra galeria ou ateliê com obras cadastradas.' }
  const tenantRole = i.role === 'ADMIN' ? 'ADMIN' : 'MEMBER'
  await prisma.$transaction(async (tx) => {
    const r = await tx.teamInvite.updateMany({ where: { id: i.id, status: 'PENDING' }, data: { status: 'ACCEPTED', acceptedAt: new Date() } })
    if (r.count === 0) throw new ArtworkError('CHANGED', 'O convite acabou de ser usado.', 409)
    let memberId = u.member?.id ?? null
    if (u.member) {
      await tx.member.update({ where: { id: u.member.id }, data: { tenantId: i.tenantId, kind: 'GALLERY_STAFF', role: i.role, status: 'ACTIVE' } })
    } else {
      const slug = await uniqueSlug(user.name, async (s) => !!(await tx.member.findUnique({ where: { slug: s }, select: { id: true } })))
      memberId = (await tx.member.create({ data: { userId: user.id, tenantId: i.tenantId, kind: 'GALLERY_STAFF', role: i.role, displayName: user.name, slug, status: 'ACTIVE' } })).id
    }
    await tx.user.update({ where: { id: user.id }, data: { tenantId: i.tenantId, tenantRole, memberId, profile: 'member' } })
    await tx.userProfile.upsert({ where: { userId_kind: { userId: user.id, kind: 'GALLERY' } }, create: { userId: user.id, kind: 'GALLERY' }, update: {} })
  })
  void audit.event({ entity: 'team_invite', entityId: i.id, action: 'accept', userId: user.id })
  return { ok: true, tenantId: i.tenantId }
}
