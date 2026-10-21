// The collector account behind a buyer e-mail: found or created (active,
// without password — enters by code), with the COLLECTOR profile.
import 'server-only'
import { prisma } from '@/lib/prisma'

export async function ensureCollectorUser(email: string, name: string, cpfDigits: string | null = null): Promise<{ id: number; email: string }> {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } })
  if (existing) {
    await prisma.userProfile.upsert({ where: { userId_kind: { userId: existing.id, kind: 'COLLECTOR' } }, create: { userId: existing.id, kind: 'COLLECTOR' }, update: {} })
    return existing
  }
  const u = await prisma.user.create({ data: { email, name, cpf: cpfDigits, profile: 'collector', active: true, profiles: { create: { kind: 'COLLECTOR', isDefault: true } } }, select: { id: true, email: true } })
  return u
}
