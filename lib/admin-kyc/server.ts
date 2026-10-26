// Admin › KYC — I/O: every identity verification (newest first) with the person and the transfers
// waiting on it, and the three decisions: approve (a year, the waiting transfers unblocked),
// reject (the waiting transfers refused) and revalidate (the approval expires now). The document
// hash never leaves the server: the row says only whether a document was read.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { totalScope } from '@/lib/scope/context'
import { audit } from '@/lib/audit'
import { ArtworkError } from '@/lib/artworks/server'
import { APPROVAL_DAYS, canApprove, canReject, canRevalidate, DECISION_NOTE_MAX, kpisOf, KYC_STATE_LABELS, PROVIDER_LABELS, stateOf, type Actor, type AdminKycRow } from './core'

const TAKE = 300

export async function adminKyc(actor: Actor): Promise<{ rows: AdminKycRow[]; kpis: ReturnType<typeof kpisOf> }> {
  return totalScope('admin:kyc', async () => {
    const now = new Date()
    const rows = await prisma.kycVerification.findMany({ orderBy: { id: 'desc' }, take: TAKE, select: { id: true, userId: true, provider: true, status: true, documentHash: true, biometricScoreBps: true, pepHit: true, verifiedAt: true, expiresAt: true, createdAt: true } })
    const userIds = [...new Set(rows.map((r) => r.userId))]
    const [users, waiting] = await Promise.all([
      prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true, profile: true } }),
      prisma.ownershipTransfer.groupBy({ by: ['toUserId'], where: { toUserId: { in: userIds }, status: 'KYC_PENDING' }, _count: { _all: true } }),
    ])
    const userOf = new Map(users.map((u) => [u.id, u]))
    const waitingOf = new Map(waiting.map((w) => [w.toUserId as number, w._count._all]))
    const seen = new Set<number>()
    const out = rows.map((r) => {
      const latest = !seen.has(r.userId); seen.add(r.userId)
      const u = userOf.get(r.userId)
      const state = stateOf(r, now)
      const row = { state, latest }
      return {
        id: r.id, userId: r.userId, name: u?.name ?? `conta ${r.userId}`, email: u?.email ?? '', profile: u?.profile ?? '',
        provider: r.provider, providerLabel: PROVIDER_LABELS[r.provider] ?? r.provider, state, stateLabel: KYC_STATE_LABELS[state],
        scoreBps: r.biometricScoreBps, pepHit: r.pepHit, hasDocument: !!r.documentHash,
        createdAt: r.createdAt.toISOString(), verifiedAt: r.verifiedAt?.toISOString() ?? null, expiresAt: r.expiresAt?.toISOString() ?? null,
        waitingTransfers: waitingOf.get(r.userId) ?? 0, latest,
        can: { approve: canApprove(actor, row), reject: canReject(actor, row), revalidate: canRevalidate(actor, row) },
      }
    })
    return { rows: out, kpis: kpisOf(out) }
  })
}

type Ctx = Actor & { userId: number; name: string; ip?: string; userAgent?: string }
const noteOf = (raw: unknown) => (typeof raw === 'string' ? raw.trim().slice(0, DECISION_NOTE_MAX) : '')

async function rowOf(id: number) {
  const r = await prisma.kycVerification.findUnique({ where: { id }, select: { id: true, userId: true, status: true, expiresAt: true } })
  if (!r) throw new ArtworkError('NOT_FOUND', 'Verificação não encontrada.', 404)
  const newer = await prisma.kycVerification.findFirst({ where: { userId: r.userId, id: { gt: r.id } }, select: { id: true } })
  return { ...r, state: stateOf(r, new Date()), latest: !newer }
}

/** Approves for APPROVAL_DAYS; the transfers waiting on this buyer's identity are unblocked (the buyer signs on the next visit). */
export async function approveKyc(id: number, rawNote: unknown, actor: Ctx): Promise<{ state: 'APPROVED'; expiresAt: string; unblocked: number }> {
  return totalScope('admin:kyc:approve', async () => {
    const r = await rowOf(id)
    if (!canApprove(actor, r)) throw new ArtworkError('FORBIDDEN', r.latest ? 'Só admin e gestor decidem a identidade, e uma aprovação vigente não se aprova de novo.' : 'Esta verificação é histórico: decida a mais recente da pessoa.', 403)
    const expiresAt = new Date(Date.now() + APPROVAL_DAYS * 86_400_000)
    const w = await prisma.kycVerification.updateMany({ where: { id, status: r.status }, data: { status: 'APPROVED', verifiedAt: new Date(), expiresAt } })
    if (w.count === 0) throw new ArtworkError('CHANGED', 'A verificação acabou de mudar.', 409)
    const t = await prisma.ownershipTransfer.updateMany({ where: { toUserId: r.userId, status: 'KYC_PENDING' }, data: { kycStatus: 'APPROVED' } })
    void audit.event({ entity: 'kyc_verification', entityId: id, action: 'approve', userId: actor.userId, userName: actor.name, ip: actor.ip, userAgent: actor.userAgent, before: { status: r.status }, after: { status: 'APPROVED', note: noteOf(rawNote) || undefined, unblockedTransfers: t.count } })
    return { state: 'APPROVED', expiresAt: expiresAt.toISOString(), unblocked: t.count }
  })
}

/** Rejects (a note is required: the person will ask why); the transfers waiting on this buyer read REJECTED. */
export async function rejectKyc(id: number, rawNote: unknown, actor: Ctx): Promise<{ state: 'REJECTED'; refused: number }> {
  const note = noteOf(rawNote)
  if (!note) throw new ArtworkError('NOTE', 'Diga o motivo da reprovação.', 422)
  return totalScope('admin:kyc:reject', async () => {
    const r = await rowOf(id)
    if (!canReject(actor, r)) throw new ArtworkError('FORBIDDEN', r.latest ? 'Só admin e gestor decidem a identidade; esta já está reprovada.' : 'Esta verificação é histórico: decida a mais recente da pessoa.', 403)
    const w = await prisma.kycVerification.updateMany({ where: { id, status: r.status }, data: { status: 'REJECTED', expiresAt: null } })
    if (w.count === 0) throw new ArtworkError('CHANGED', 'A verificação acabou de mudar.', 409)
    const t = await prisma.ownershipTransfer.updateMany({ where: { toUserId: r.userId, status: 'KYC_PENDING' }, data: { kycStatus: 'REJECTED' } })
    void audit.event({ entity: 'kyc_verification', entityId: id, action: 'reject', userId: actor.userId, userName: actor.name, ip: actor.ip, userAgent: actor.userAgent, before: { status: r.status }, after: { status: 'REJECTED', note, refusedTransfers: t.count } })
    return { state: 'REJECTED', refused: t.count }
  })
}

/** The approval expires now: the next transfer asks the person to verify again. */
export async function revalidateKyc(id: number, rawNote: unknown, actor: Ctx): Promise<{ state: 'EXPIRED' }> {
  return totalScope('admin:kyc:revalidate', async () => {
    const r = await rowOf(id)
    if (!canRevalidate(actor, r)) throw new ArtworkError('FORBIDDEN', 'Só uma aprovação vigente, a mais recente da pessoa, pede nova verificação.', 403)
    const w = await prisma.kycVerification.updateMany({ where: { id, status: 'APPROVED' }, data: { expiresAt: new Date() } })
    if (w.count === 0) throw new ArtworkError('CHANGED', 'A verificação acabou de mudar.', 409)
    void audit.event({ entity: 'kyc_verification', entityId: id, action: 'revalidate', userId: actor.userId, userName: actor.name, ip: actor.ip, userAgent: actor.userAgent, before: { expiresAt: r.expiresAt?.toISOString() ?? null }, after: { expiresAt: 'now', note: noteOf(rawNote) || undefined } })
    return { state: 'EXPIRED' }
  })
}
