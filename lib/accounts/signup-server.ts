// Self-signup after the e-mail code (lib/auth/access-code-server). Creates, in
// ONE transaction: User (active), UserProfile, and — for artist/gallery/advisor
// — Tenant + Member (+ Artist for the artist). Approval by the house
// (`members:approve`) is the Phase 2 gate for certification, not for entering.
import { prisma } from '@/lib/prisma'
import { protectDocument } from '@/lib/crypto/cipher'
import { ensureTenant } from '@/lib/tenant/ensure'
import { uniqueSlug } from '@/lib/tenant/slug'
import { loginProfileOf, memberKindOf, type ProfileKindKey } from '@/lib/profiles/core'

export interface NewAccount {
  email: string
  name: string
  passwordHash: string
  profileKind: ProfileKindKey
  cpf?: string | null
}

export async function createMemberAccount(a: NewAccount) {
  const cpfDigits = a.cpf ? protectDocument(a.cpf) : null
  const memberKind = memberKindOf(a.profileKind)
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: a.email,
        name: a.name,
        cpf: a.cpf ? a.cpf.replace(/\D/g, '') : null,
        passwordHash: a.passwordHash,
        profile: loginProfileOf(a.profileKind),
        active: true,
        profiles: { create: { kind: a.profileKind, isDefault: true } },
      },
    })
    if (!memberKind) return user
    const tenant = await ensureTenant(tx, {
      kind: memberKind === 'GALLERY_STAFF' ? 'GALLERY' : 'PERSON',
      name: a.name,
      document: cpfDigits && memberKind !== 'GALLERY_STAFF' ? cpfDigits.hash.slice(0, 32) : null,
    })
    const slug = await uniqueSlug(a.name, async (s) => !!(await tx.member.findUnique({ where: { slug: s }, select: { id: true } })))
    const member = await tx.member.create({
      data: { userId: user.id, tenantId: tenant.id, kind: memberKind, displayName: a.name, slug, status: 'ACTIVE', approvedAt: null },
    })
    if (memberKind === 'ARTIST') {
      const artistSlug = await uniqueSlug(a.name, async (s) => !!(await tx.artist.findUnique({ where: { slug: s }, select: { id: true } })))
      await tx.artist.create({ data: { memberId: member.id, tenantId: tenant.id, name: a.name, slug: artistSlug } })
    }
    // The first login of a PERSON tenant is its ADMIN; gallery staff is ADMIN of a gallery it creates.
    return tx.user.update({ where: { id: user.id }, data: { memberId: member.id, tenantId: tenant.id, tenantRole: 'ADMIN' } })
  })
}
