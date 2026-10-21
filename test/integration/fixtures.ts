// Scenario: gallery A (tenant GALLERY) with staff A1 (ADMIN) and advisor A2;
// autonomous artist B (tenant PERSON). One artwork per member.
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { truncateTables } from './db'

export interface Scenario {
  galleryTenantId: number
  a1: { userId: number; memberId: number; artworkId: number }
  a2: { userId: number; memberId: number; artworkId: number }
  b: { userId: number; memberId: number; artworkId: number; tenantId: number }
  staff: { userId: number }
}

export async function createScenario(): Promise<Scenario> {
  await truncateTables(['Tenant', 'User', 'Artist', 'AccessCode', 'AuditLog', 'rate_limit_bucket'])
  const pw = await hashPassword('senha-forte-1')
  const gallery = await prisma.tenant.create({ data: { kind: 'GALLERY', name: 'Galeria Ladeira', slug: 'galeria-ladeira' } })
  const artistOfGallery = await prisma.artist.create({ data: { tenantId: gallery.id, name: 'Tomás Rezende', slug: 'tomas-rezende' } })

  async function member(opt: { email: string; name: string; tenantId: number; kind: string; role: 'ADMIN' | 'MEMBER'; artist?: boolean; slug: string }) {
    const user = await prisma.user.create({ data: { email: opt.email, name: opt.name, passwordHash: pw, profile: 'member', active: true, profiles: { create: { kind: opt.kind === 'ARTIST' ? 'ARTIST' : opt.kind === 'ADVISOR' ? 'ADVISOR' : 'GALLERY', isDefault: true } } } })
    const m = await prisma.member.create({ data: { userId: user.id, tenantId: opt.tenantId, kind: opt.kind, displayName: opt.name, slug: opt.slug } })
    let artistId = artistOfGallery.id
    if (opt.artist) artistId = (await prisma.artist.create({ data: { memberId: m.id, tenantId: opt.tenantId, name: opt.name, slug: `${opt.slug}-artist` } })).id
    await prisma.user.update({ where: { id: user.id }, data: { memberId: m.id, tenantId: opt.tenantId, tenantRole: opt.role } })
    const artwork = await prisma.artwork.create({ data: { memberId: m.id, artistId, title: `Obra de ${opt.name}` } })
    return { userId: user.id, memberId: m.id, artworkId: artwork.id }
  }

  const a1 = await member({ email: 'a1@galeria.test', name: 'Ana Ladeira', tenantId: gallery.id, kind: 'GALLERY_STAFF', role: 'ADMIN', slug: 'ana' })
  const a2 = await member({ email: 'a2@galeria.test', name: 'Caio Consultor', tenantId: gallery.id, kind: 'ADVISOR', role: 'MEMBER', slug: 'caio' })
  const bTenant = await prisma.tenant.create({ data: { kind: 'PERSON', name: 'Joana Teixeira', slug: 'joana-teixeira' } })
  const b = await member({ email: 'b@artista.test', name: 'Joana Teixeira', tenantId: bTenant.id, kind: 'ARTIST', role: 'ADMIN', artist: true, slug: 'joana' })
  const staff = await prisma.user.create({ data: { email: 'staff@houseart.test', name: 'Equipe', passwordHash: pw, profile: 'admin', active: true } })
  return { galleryTenantId: gallery.id, a1, a2, b: { ...b, tenantId: bTenant.id }, staff: { userId: staff.id } }
}
