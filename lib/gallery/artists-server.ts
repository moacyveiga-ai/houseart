// Represented artists — I/O. The gallery's artists are `Artist` rows of the
// tenant (or members of it); the contract (kind, share, validity) is the
// ArtistContract. Adding an artist creates the Artist under the tenant; an
// invite e-mail tells the artist to create the account (no linking yet).
import 'server-only'
import { prisma } from '@/lib/prisma'
import { tenantOfScope, type Scope } from '@/lib/scope/core'
import { ArtworkError } from '@/lib/artworks/server'
import { normalizeEmail } from '@/lib/auth/credential'
import { sendEmail } from '@/lib/email/send'
import { afterResponse } from '@/lib/after'
import { publicBaseUrl } from '@/lib/public-url'
import { audit } from '@/lib/audit'
import { uniqueSlug } from '@/lib/tenant/slug'
import { CONTRACT_KINDS, CONTRACT_KIND_LABELS, type ContractKind } from './domain'

export interface RepresentedArtist { id: number; name: string; slug: string; works: number; forSale: number; contract: { kind: ContractKind; kindLabel: string; galleryBps: number; validUntil: string | null } | null; hasAccount: boolean; sub: string }

function requireTenant(scope: Scope): number {
  const tenantId = tenantOfScope(scope)
  if (!tenantId) throw new ArtworkError('NO_TENANT', 'Galeria não encontrada.', 404)
  return tenantId
}

export async function representedArtists(scope: Scope): Promise<RepresentedArtist[]> {
  const tenantId = requireTenant(scope)
  const rows = await prisma.artist.findMany({ where: { OR: [{ tenantId }, { member: { tenantId } }] }, include: { member: { select: { userId: true } }, _count: { select: { artworks: true } } }, orderBy: { name: 'asc' } })
  const contracts = await prisma.artistContract.findMany({ where: { tenantId, status: 'ACTIVE' } })
  const forSale = await prisma.artwork.groupBy({ by: ['artistId'], where: { tenantId, artistId: { in: rows.map((r) => r.id) }, status: 'LISTED' }, _count: { _all: true } })
  const forSaleOf = new Map(forSale.map((g) => [g.artistId, g._count._all]))
  return rows.map((a) => {
    const c = contracts.find((x) => x.artistId === a.id) ?? null
    const kind = (c?.kind ?? 'REPRESENTED') as ContractKind
    const until = c?.validUntil ? c.validUntil.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' }) : null
    const n = a._count.artworks
    return {
      id: a.id, name: a.name, slug: a.slug, works: n, forSale: forSaleOf.get(a.id) ?? 0,
      contract: c ? { kind, kindLabel: CONTRACT_KIND_LABELS[kind], galleryBps: c.galleryBps, validUntil: c.validUntil?.toISOString().slice(0, 10) ?? null } : null,
      hasAccount: !!a.member?.userId,
      sub: `${n} ${n === 1 ? 'obra' : 'obras'} no acervo${c ? ` · ${kind === 'CONSIGNMENT' ? 'consignação' : 'contrato'}${until ? ` até ${until}` : ''}` : ' · sem contrato registrado'}`,
    }
  })
}

export async function addArtist(scope: Scope, input: { name: string; kind?: string; galleryBps?: number; validUntil?: string | null; inviteEmail?: string | null }, actor: { userId: number; name: string }): Promise<{ ok: true; id: number } | { ok: false; error: string }> {
  const tenantId = requireTenant(scope)
  const name = input.name.trim().slice(0, 120)
  if (name.length < 2) return { ok: false, error: 'Informe o nome do artista.' }
  const kind = input.kind && (CONTRACT_KINDS as readonly string[]).includes(input.kind) ? input.kind : 'REPRESENTED'
  const bps = input.galleryBps ?? 5000
  if (!Number.isInteger(bps) || bps < 0 || bps > 10000) return { ok: false, error: 'A divisão fica entre 0 e 100 %.' }
  const validUntil = input.validUntil ? new Date(`${input.validUntil}T12:00:00Z`) : null
  if (validUntil && Number.isNaN(validUntil.getTime())) return { ok: false, error: 'Data de validade inválida.' }
  const slug = await uniqueSlug(name, async (s) => !!(await prisma.artist.findUnique({ where: { slug: s }, select: { id: true } })))
  const artist = await prisma.$transaction(async (tx) => {
    const a = await tx.artist.create({ data: { tenantId, name, slug } })
    await tx.artistContract.create({ data: { tenantId, artistId: a.id, kind, galleryBps: bps, validUntil } })
    return a
  })
  const email = input.inviteEmail ? normalizeEmail(input.inviteEmail) : null
  if (email) {
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true } })
    afterResponse('artists: invite e-mail', () => sendEmail({ to: email, subject: `${tenant.name} cadastrou você como artista na HouseArt`, text: `${actor.name}, de ${tenant.name}, cadastrou suas obras na HouseArt. Crie sua conta de artista com este e-mail para assinar os certificados digitalmente: ${publicBaseUrl()}/signup`, redactedPreview: 'convite de artista' }))
  }
  void audit.event({ entity: 'artist', entityId: artist.id, action: 'represent', userId: actor.userId, after: { kind, galleryBps: bps } })
  return { ok: true, id: artist.id }
}

export async function updateContract(scope: Scope, artistId: number, input: { kind?: string; galleryBps?: number; validUntil?: string | null }, actor: { userId: number }): Promise<boolean> {
  const tenantId = requireTenant(scope)
  const a = await prisma.artist.findFirst({ where: { id: artistId, OR: [{ tenantId }, { member: { tenantId } }] }, select: { id: true } })
  if (!a) return false
  const kind = input.kind && (CONTRACT_KINDS as readonly string[]).includes(input.kind) ? input.kind : undefined
  if (input.galleryBps !== undefined && (!Number.isInteger(input.galleryBps) || input.galleryBps < 0 || input.galleryBps > 10000)) throw new ArtworkError('BAD_SPLIT', 'A divisão fica entre 0 e 100 %.', 400)
  const validUntil = input.validUntil === undefined ? undefined : input.validUntil ? new Date(`${input.validUntil}T12:00:00Z`) : null
  await prisma.artistContract.upsert({ where: { tenantId_artistId: { tenantId, artistId } }, create: { tenantId, artistId, kind: kind ?? 'REPRESENTED', galleryBps: input.galleryBps ?? 5000, validUntil: validUntil ?? null }, update: { ...(kind ? { kind } : {}), ...(input.galleryBps !== undefined ? { galleryBps: input.galleryBps } : {}), ...(validUntil !== undefined ? { validUntil } : {}), status: 'ACTIVE' } })
  void audit.event({ entity: 'artist', entityId: artistId, action: 'contract', userId: actor.userId, after: input })
  return true
}

/** Ends the representation; the Artist row stays when it has artworks (history), is deleted when empty and unclaimed. */
export async function endRepresentation(scope: Scope, artistId: number, actor: { userId: number }): Promise<boolean> {
  const tenantId = requireTenant(scope)
  const a = await prisma.artist.findFirst({ where: { id: artistId, tenantId }, include: { _count: { select: { artworks: true } }, member: { select: { id: true } } } })
  if (!a) return false
  await prisma.artistContract.updateMany({ where: { tenantId, artistId }, data: { status: 'ENDED' } })
  if (a._count.artworks === 0 && !a.member) await prisma.artist.delete({ where: { id: artistId } })
  void audit.event({ entity: 'artist', entityId: artistId, action: 'end_representation', userId: actor.userId })
  return true
}
