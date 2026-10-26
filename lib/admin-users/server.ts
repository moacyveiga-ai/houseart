// Admin › Usuários e contas — I/O: the accounts of the house for the desk, and the four actions:
// block/unblock (sessions closed), staff profile, password link (the same blind flow as "Esqueci
// minha senha") and a fresh team invite. Everything audited on entity `user`; never a password,
// never a token in the audit.
import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { audit } from '@/lib/audit'
import { destroyAllSessions } from '@/lib/auth'
import { startPasswordReset } from '@/lib/auth/access-code-server'
import { ArtworkError } from '@/lib/artworks/server'
import { sendEmail } from '@/lib/email/send'
import { afterResponse } from '@/lib/after'
import { publicBaseUrl } from '@/lib/public-url'
import { INVITE_TTL_DAYS, TEAM_ROLE_LABELS, type TeamRole } from '@/lib/gallery/domain'
import { accountStateOf, canBlock, canChangeProfile, canSendReset, canSetProfile, LOGIN_PROFILE_LABELS, outranks, parseQuery, type Actor, type AdminUserRow } from './core'

const TAKE = 200
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

type Db = Pick<typeof prisma, 'user'>
const activeAdminCount = (db: Db = prisma) => db.user.count({ where: { profile: 'admin', active: true } })
/** One key for every write that can change the number of active admins: the count and the write happen under it. */
const ADMIN_GUARD_LOCK = 7_431_001

export async function adminUsers(actor: Actor, rawQuery: string | undefined): Promise<AdminUserRow[]> {
  const q = parseQuery(rawQuery)
  return totalScope('admin:users', async () => {
    const where = q.id !== null ? { id: q.id } : q.text ? { OR: [{ name: { contains: q.text, mode: 'insensitive' as const } }, { email: { contains: q.text, mode: 'insensitive' as const } }] } : {}
    const users = await prisma.user.findMany({
      where, orderBy: { createdAt: 'desc' }, take: TAKE,
      select: {
        id: true, name: true, email: true, profile: true, active: true, deletionRequestedAt: true, emailVerifiedAt: true, phoneVerifiedAt: true, passwordHash: true, lastLoginAt: true, createdAt: true,
        profiles: { select: { kind: true }, orderBy: { id: 'asc' } }, identities: { select: { provider: true } },
        member: { select: { kind: true, status: true, role: true, tenant: { select: { name: true } } } },
      },
    })
    const ids = users.map((u) => u.id)
    const emails = users.map((u) => u.email)
    const [kycs, invites, admins] = await Promise.all([
      prisma.kycVerification.findMany({ where: { userId: { in: ids } }, orderBy: { id: 'desc' }, select: { userId: true, status: true, expiresAt: true } }),
      prisma.teamInvite.findMany({ where: { email: { in: emails }, status: 'PENDING' }, orderBy: { id: 'desc' }, select: { id: true, email: true, role: true, expiresAt: true, tenantId: true } }),
      activeAdminCount(),
    ])
    const tenantNames = new Map((await prisma.tenant.findMany({ where: { id: { in: [...new Set(invites.map((i) => i.tenantId))] } }, select: { id: true, name: true } })).map((t) => [t.id, t.name]))
    const kycOf = new Map<number, string>()
    for (const k of kycs) if (!kycOf.has(k.userId)) kycOf.set(k.userId, k.status === 'APPROVED' && k.expiresAt && k.expiresAt < new Date() ? 'EXPIRED' : k.status)
    const inviteOf = new Map<string, (typeof invites)[number]>()
    for (const i of invites) if (!inviteOf.has(i.email)) inviteOf.set(i.email, i)
    return users.map((u) => {
      const target = { id: u.id, profile: u.profile, active: u.active, deletionRequested: !!u.deletionRequestedAt }
      const inv = inviteOf.get(u.email) ?? null
      return {
        id: u.id, name: u.name, email: u.email, profile: u.profile, profileLabel: LOGIN_PROFILE_LABELS[u.profile] ?? u.profile,
        kinds: u.profiles.map((p) => p.kind), active: u.active, state: accountStateOf(u),
        emailVerified: !!u.emailVerifiedAt, phoneVerified: !!u.phoneVerifiedAt, hasPassword: !!u.passwordHash, socialLogins: u.identities.map((i) => i.provider),
        member: u.member ? { kind: u.member.kind, status: u.member.status, tenant: u.member.tenant.name, role: u.member.role } : null,
        kyc: kycOf.get(u.id) ?? null,
        pendingInvite: inv ? { id: inv.id, gallery: tenantNames.get(inv.tenantId) ?? 'galeria', role: inv.role, expiresAt: inv.expiresAt.toISOString() } : null,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null, createdAt: u.createdAt.toISOString(),
        can: { block: canBlock(actor, target, admins), profile: canChangeProfile(actor, target, admins), reset: canSendReset(actor, target), invite: !!inv && outranks(actor, target) },
      }
    })
  })
}

type Ctx = Actor & { name: string; ip?: string; userAgent?: string }
const act = (actor: Ctx, entityId: number, action: string, before: unknown, after: unknown) => void audit.event({ entity: 'user', entityId, action, userId: actor.id, userName: actor.name, ip: actor.ip, userAgent: actor.userAgent, before, after })

async function targetOf(id: number, db: Db = prisma) {
  const u = await db.user.findUnique({ where: { id }, select: { id: true, profile: true, active: true, email: true, name: true, deletionRequestedAt: true } })
  if (!u) throw new ArtworkError('NOT_FOUND', 'Conta não encontrada.', 404)
  return { ...u, deletionRequested: !!u.deletionRequestedAt }
}

/** Blocks (every session closed; the person cannot sign in) or unblocks an account. */
export async function setUserActive(id: number, active: boolean, actor: Ctx): Promise<{ active: boolean }> {
  return totalScope('admin:users:active', async () => {
    const u = await prisma.$transaction(async (tx) => {
      // the last-admin rule is a global invariant: count and write under one lock (two admins blocking each other at once)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADMIN_GUARD_LOCK})`
      const u = await targetOf(id, tx)
      if (!canBlock(actor, u, await activeAdminCount(tx))) throw new ArtworkError('FORBIDDEN', u.id === actor.id ? 'Você não bloqueia a própria conta.' : u.deletionRequested && !u.active ? 'A pessoa pediu a exclusão: a conta é encerrada pelo atendimento, não reaberta.' : u.profile === 'admin' ? 'O último admin ativo não pode ser bloqueado.' : 'Só um perfil acima deste muda a conta.', 403)
      if (u.active === active) return u
      const r = await tx.user.updateMany({ where: { id, active: !active }, data: { active } })
      if (r.count === 0) throw new ArtworkError('CHANGED', 'A conta acabou de mudar.', 409)
      return u
    })
    if (u.active === active) return { active }
    if (!active) await destroyAllSessions(id)
    act(actor, id, active ? 'unblock' : 'block', { active: !active }, { active })
    return { active }
  })
}

/** Changes the login profile of a staff account (admin only; the last admin keeps the profile). */
export async function setStaffProfile(id: number, next: unknown, actor: Ctx): Promise<{ profile: string }> {
  const profile = typeof next === 'string' ? next : ''
  return totalScope('admin:users:profile', async () => {
    const u = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${ADMIN_GUARD_LOCK})`
      const u = await targetOf(id, tx)
      if (!canSetProfile(actor, u, profile, await activeAdminCount(tx))) throw new ArtworkError('FORBIDDEN', 'Só o admin troca o papel de uma conta da equipe (nunca o próprio, e o último admin fica admin).', 403)
      if (u.profile === profile) return u
      const r = await tx.user.updateMany({ where: { id, profile: u.profile }, data: { profile } })
      if (r.count === 0) throw new ArtworkError('CHANGED', 'A conta acabou de mudar.', 409)
      return u
    })
    if (u.profile === profile) return { profile }
    await destroyAllSessions(id) // the new scope starts on the next sign-in
    act(actor, id, 'profile', { profile: u.profile }, { profile })
    return { profile }
  })
}

/** Sends the password link of "Esqueci minha senha" to the account (the e-mail says nothing about who asked). */
export async function sendPasswordLink(id: number, actor: Ctx): Promise<{ ok: true }> {
  return totalScope('admin:users:reset', async () => {
    const u = await targetOf(id)
    if (!canSendReset(actor, u)) throw new ArtworkError('FORBIDDEN', u.active ? 'Só um perfil acima deste envia o link.' : 'Conta bloqueada: desbloqueie antes de enviar o link.', 403)
    const r = await startPasswordReset(u.email)
    if (!r.ok) throw new ArtworkError('RESET', r.error, 422)
    act(actor, id, 'password_link', null, { sent: true })
    return { ok: true }
  })
}

/** A fresh token (the old link dies) and the invite e-mail again, for a pending team invite of this e-mail. */
export async function resendTeamInvite(id: number, actor: Ctx): Promise<{ ok: true; gallery: string }> {
  return totalScope('admin:users:invite', async () => {
    const u = await targetOf(id)
    if (!outranks(actor, u)) throw new ArtworkError('FORBIDDEN', 'Só um perfil acima deste reenvia o convite.', 403)
    const inv = await prisma.teamInvite.findFirst({ where: { email: u.email, status: 'PENDING' }, orderBy: { id: 'desc' }, select: { id: true, role: true, tenantId: true } })
    if (!inv) throw new ArtworkError('NO_INVITE', 'Esta conta não tem convite de equipe pendente.', 409)
    const gallery = (await prisma.tenant.findUnique({ where: { id: inv.tenantId }, select: { name: true } }))?.name ?? 'galeria'
    const token = randomBytes(24).toString('base64url')
    await prisma.teamInvite.update({ where: { id: inv.id }, data: { tokenHash: sha256(token), expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000) } })
    const link = `${publicBaseUrl()}/team/accept?token=${encodeURIComponent(token)}`
    const roleName = TEAM_ROLE_LABELS[inv.role as TeamRole]?.name ?? inv.role
    afterResponse('admin: team invite e-mail', () => sendEmail({ to: u.email, subject: `Seu convite para a equipe de ${gallery} na HouseArt`, text: `Reenviamos o seu convite para a equipe de ${gallery} na HouseArt, com o papel ${roleName}. Entre com este e-mail e abra o link em até ${INVITE_TTL_DAYS} dias: ${link}`, redactedPreview: 'convite de equipe (reenvio)' }))
    act(actor, id, 'invite_resent', null, { inviteId: inv.id })
    return { ok: true, gallery }
  })
}
