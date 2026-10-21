// The event chain of a certificate — the ONLY writer of CertificateEvent.
// Serialized per certificate by an advisory lock so `seq` and `prevHash`
// never fork.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { chainHash } from './core'

export type EventKind = 'CREATED' | 'CERTIFIED' | 'LISTED' | 'TRANSFERRED' | 'LOANED' | 'RESTORED' | 'STOLEN' | 'DISPUTED' | 'INSURED'

export async function recordEvent(artworkId: number, kind: EventKind, payload: Record<string, unknown>, actorUserId: number | null) {
  return prisma.$transaction(async (tx) => {
    const cert = await tx.certificate.upsert({ where: { artworkId }, create: { artworkId }, update: {} })
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${cert.id})`
    const last = await tx.certificateEvent.findFirst({ where: { certificateId: cert.id }, orderBy: { seq: 'desc' } })
    const seq = (last?.seq ?? 0) + 1
    const body = { kind, seq, ...payload, at: new Date().toISOString() }
    const hash = chainHash(last?.hash ?? null, body)
    return tx.certificateEvent.create({ data: { certificateId: cert.id, seq, kind, payloadJson: JSON.stringify(body), hash, prevHash: last?.hash ?? null, actorUserId } })
  })
}
