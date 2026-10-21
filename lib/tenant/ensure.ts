// A member is born WITH a tenant (ADR-010 port): PERSON for an artist or
// advisor, GALLERY for gallery staff. Idempotent; runs inside the caller's tx.
import type { Prisma } from '@/app/generated/prisma/client'
import { uniqueSlug } from './slug'

type Tx = Prisma.TransactionClient

export async function ensureTenant(tx: Tx, opt: { kind: 'PERSON' | 'GALLERY'; name: string; document?: string | null }): Promise<{ id: number }> {
  if (opt.document) {
    const existing = await tx.tenant.findUnique({ where: { document: opt.document }, select: { id: true } })
    if (existing) return existing
  }
  const slug = await uniqueSlug(opt.name, async (s) => !!(await tx.tenant.findUnique({ where: { slug: s }, select: { id: true } })))
  return tx.tenant.create({ data: { kind: opt.kind, name: opt.name, document: opt.document ?? null, slug }, select: { id: true } })
}
