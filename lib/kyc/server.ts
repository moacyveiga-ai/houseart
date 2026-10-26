// KYC provider door. `KYC_PROVIDER=mock` approves on the spot (the MVP);
// `didit` is the J item. Never stores the document, only the hash.
// The desk's queue (/admin/kyc) decides over these rows: only the LATEST row of a person
// counts, so a rejection or a revalidation by the desk is never overridden by an older approval.
import 'server-only'
import { prisma } from '@/lib/prisma'

const latestOf = (userId: number) => prisma.kycVerification.findFirst({ where: { userId }, orderBy: { id: 'desc' }, select: { status: true, expiresAt: true } })

export async function verifyIdentity(userId: number, documentHash: string | null): Promise<'APPROVED' | 'PENDING' | 'REJECTED'> {
  // a verification the desk approved (or a valid one from before) is reused: no second row, no second provider call
  if (await hasValidKyc(userId)) return 'APPROVED'
  const provider = process.env.KYC_PROVIDER ?? 'mock'
  if (provider !== 'mock') {
    await prisma.kycVerification.create({ data: { userId, provider, status: 'PENDING', documentHash } })
    return 'PENDING'
  }
  // a person the desk rejected does not get an automatic approval back: a new row waits for the desk
  if ((await latestOf(userId))?.status === 'REJECTED') {
    await prisma.kycVerification.create({ data: { userId, provider: 'mock', status: 'PENDING', documentHash } })
    return 'PENDING'
  }
  await prisma.kycVerification.create({ data: { userId, provider: 'mock', status: 'APPROVED', documentHash, biometricScoreBps: 9900, verifiedAt: new Date(), expiresAt: new Date(Date.now() + 365 * 86_400_000) } })
  return 'APPROVED'
}

/** The latest verification of the person is an approval in force. */
export async function hasValidKyc(userId: number): Promise<boolean> {
  const k = await latestOf(userId)
  return !!k && k.status === 'APPROVED' && (!k.expiresAt || k.expiresAt > new Date())
}
