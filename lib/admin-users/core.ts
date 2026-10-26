// Admin › Usuários e contas — pure rules: the filters, the row the desk reads, what the desk may
// do with each account (block, staff profile, password link, team invite). The audit item
// (docs/audit-ux-2026-10-25/web-app.md §5) asked for search, profiles, block, resend invite,
// reset password and change role.
import { canManageAdmin, hasTotalScope, profileLevel, STAFF_PROFILES, type Profile } from '@/lib/auth/profiles'

export const USER_FILTERS = ['all', 'staff', 'members', 'collectors', 'blocked', 'deletion', 'unverified'] as const
export type UserFilter = (typeof USER_FILTERS)[number]
export const USER_FILTER_LABELS: Record<UserFilter, string> = {
  all: 'Todos', staff: 'Equipe', members: 'Artistas e galerias', collectors: 'Colecionadores', blocked: 'Bloqueados', deletion: 'Exclusão pedida', unverified: 'E-mail não confirmado',
}
export const filterKey = (raw: string | undefined): UserFilter => (USER_FILTERS as readonly string[]).includes(raw ?? '') ? (raw as UserFilter) : 'all'

export const LOGIN_PROFILE_LABELS: Record<string, string> = {
  admin: 'Admin', manager: 'Gestor', operator: 'Operador', finance: 'Financeiro', member: 'Membro', appraiser: 'Avaliador', collector: 'Colecionador', institution: 'Instituição',
}
export const PROFILE_KIND_LABELS: Record<string, string> = { ARTIST: 'Artista', GALLERY: 'Galeria', ADVISOR: 'Consultor', COLLECTOR: 'Colecionador', APPRAISER: 'Avaliador', STAFF: 'Equipe' }
export const MEMBER_KIND_LABELS: Record<string, string> = { ARTIST: 'artista', GALLERY_STAFF: 'equipe de galeria', ADVISOR: 'consultor', COLLECTOR: 'colecionador' }
export const MEMBER_STATUS_LABELS: Record<string, string> = { PENDING: 'em análise', ACTIVE: 'ativo', REFUSED: 'recusado', INACTIVE: 'inativo' }
export const KYC_LABELS: Record<string, string> = { APPROVED: 'KYC aprovado', PENDING: 'KYC pendente', REJECTED: 'KYC reprovado', EXPIRED: 'KYC vencido' }

/** The staff profiles the desk may assign, with the label of the screen. */
export const STAFF_PROFILE_OPTIONS: { value: Profile; label: string }[] = STAFF_PROFILES.map((p) => ({ value: p, label: LOGIN_PROFILE_LABELS[p] }))

export type AccountState = 'ACTIVE' | 'BLOCKED' | 'DELETION'
export const ACCOUNT_STATE_LABELS: Record<AccountState, string> = { ACTIVE: 'Ativa', BLOCKED: 'Bloqueada', DELETION: 'Exclusão pedida' }

export interface AdminUserRow {
  id: number; name: string; email: string; profile: string; profileLabel: string
  kinds: string[]; active: boolean; state: AccountState
  emailVerified: boolean; phoneVerified: boolean; hasPassword: boolean; socialLogins: string[]
  member: { kind: string; status: string; tenant: string; role: string | null } | null
  kyc: string | null
  pendingInvite: { id: number; gallery: string; role: string; expiresAt: string } | null
  lastLoginAt: string | null; createdAt: string
  /** What the viewer may do with this row (decided on the server, never in the screen). */
  can: { block: boolean; profile: boolean; reset: boolean; invite: boolean }
}

export const accountStateOf = (u: { active: boolean; deletionRequestedAt: string | Date | null }): AccountState => (!u.active ? 'BLOCKED' : u.deletionRequestedAt ? 'DELETION' : 'ACTIVE')

export function matchesFilter(r: AdminUserRow, f: UserFilter): boolean {
  switch (f) {
    case 'staff': return hasTotalScope(r.profile)
    case 'members': return r.profile === 'member' || r.kinds.some((k) => k === 'ARTIST' || k === 'GALLERY' || k === 'ADVISOR')
    case 'collectors': return r.profile === 'collector' || r.kinds.includes('COLLECTOR')
    case 'blocked': return !r.active
    case 'deletion': return r.state === 'DELETION'
    case 'unverified': return !r.emailVerified
    default: return true
  }
}

/** Search: name or e-mail contains the term (case-insensitive); an `#id` or a number opens that id. */
export function parseQuery(raw: string | undefined): { text: string; id: number | null } {
  const text = (raw ?? '').trim().slice(0, 120)
  const m = /^#?(\d{1,9})$/.exec(text)
  return { text, id: m ? Number(m[1]) : null }
}

export interface Actor { id: number; profile: string }
export interface Target { id: number; profile: string; active: boolean }

/** Only a higher level touches an account; the admin touches everyone but never themself. */
export const outranks = (actor: Actor, target: Target) => actor.id !== target.id && (canManageAdmin(actor.profile) || profileLevel(actor.profile) > profileLevel(target.profile))

/** Block/unblock: by rank; the last active admin is never blocked (the server counts). */
export const canBlock = (actor: Actor, target: Target, activeAdmins: number) => outranks(actor, target) && !(target.active && target.profile === 'admin' && activeAdmins <= 1)

/** The staff profile is changed by the admin only, between staff profiles, never on themself; the last admin keeps the admin profile. */
export function canSetProfile(actor: Actor, target: Target, next: string, activeAdmins: number): boolean {
  if (!canManageAdmin(actor.profile) || actor.id === target.id) return false
  if (!hasTotalScope(target.profile) || !(STAFF_PROFILES as readonly string[]).includes(next)) return false
  if (target.profile === 'admin' && next !== 'admin' && target.active && activeAdmins <= 1) return false
  return true
}

/** A password link goes to an active account with an e-mail (blind to the person: the same flow as "Esqueci minha senha"). */
export const canSendReset = (actor: Actor, target: Target) => target.active && outranks(actor, target)

export function kpisOf(rows: AdminUserRow[]) {
  return {
    total: rows.length,
    staff: rows.filter((r) => hasTotalScope(r.profile)).length,
    blocked: rows.filter((r) => !r.active).length,
    deletion: rows.filter((r) => r.state === 'DELETION').length,
    pendingMembers: rows.filter((r) => r.member?.status === 'PENDING').length,
  }
}
