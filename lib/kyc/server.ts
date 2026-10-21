// KYC provider door. `KYC_PROVIDER=mock` approves on the spot (the MVP);
// `didit` is the J item. Never stores the document, only the hash.
import 'server-only'
import { prisma } from '@/lib/prisma'

export async function verifyIdentity(userId: number, documentHash: string | null): Promise<'APPROVED' | 'PENDING' | 'REJECTED'> {
  const provider = process.env.KYC_PROVIDER ?? 'mock'
  if (provider !== 'mock') {
    await prisma.kycVerification.create({ data: { userId, provider, status: 'PENDING', documentHash } })
    return 'PENDING'
  }
  await prisma.kycVerification.create({ data: { userId, provider: 'mock', status: 'APPROVED', documentHash, biometricScoreBps: 9900, verifiedAt: new Date(), expiresAt: new Date(Date.now() + 365 * 86_400_000) } })
  return 'APPROVED'
}

export async function hasValidKyc(userId: number): Promise<boolean> {
  const k = await prisma.kycVerification.findFirst({ where: { userId, status: 'APPROVED', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } })
  return !!k
}
