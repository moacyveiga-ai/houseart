// The collector as owner and seller (decision of 2026-10-22): registering an
// own artwork (with its acquisition), selling a held one from the wallet and
// ordering services for it. The member is born by lib/tenant/member-server.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/audit'
import { ensureCollectorMember } from '@/lib/tenant/member-server'
import { createDraft, getArtwork, patchArtwork, ArtworkError } from '@/lib/artworks/server'
import { scopeOfUser, type Scope } from '@/lib/scope/core'
import { ACQUISITION_KINDS, type AcquisitionKind } from '@/lib/artworks/domain'
import { listArtworkForSale } from '@/lib/offers/server'
import { catalog, placeOrder } from '@/lib/orders/server'
import { sellerDeals, type DealView } from '@/lib/deals/server'
import { withScope } from '@/lib/scope/context'

export { ensureCollectorMember }

// ── the collector's own artworks ─────────────────────────────────────────

export interface RegisterOwnArtworkInput { title?: string; artistId?: number | null; artistName?: string | null; acquisitionKind: AcquisitionKind; acquisitionYear?: number | null; acquisitionFrom?: string | null; acquisitionNote?: string | null; acquisitionPriceCents?: bigint | null }

/** "Cadastrar obra" of the collector: the member is born if needed; the draft carries the acquisition; the wizard does the rest. */
export async function registerOwnArtwork(userId: number, i: RegisterOwnArtworkInput): Promise<{ id: number; scope: Scope }> {
  if (!ACQUISITION_KINDS.includes(i.acquisitionKind)) throw new ArtworkError('BAD_ORIGIN', 'Diga como a obra chegou até você.', 422)
  if (!i.artistId && !i.artistName?.trim()) throw new ArtworkError('NO_ARTIST', 'Informe o artista da obra.', 422)
  const { memberId, tenantId } = await ensureCollectorMember(userId)
  const scope = scopeOfUser({ profile: 'collector', memberId, tenantId, tenantRole: 'ADMIN' }, () => false)
  const a = await createDraft(scope, { title: i.title, artistId: i.artistId ?? null, artistName: i.artistName ?? null })
  await patchArtwork(scope, a.id, { acquisitionKind: i.acquisitionKind, acquisitionYear: i.acquisitionYear ?? null, acquisitionFrom: i.acquisitionFrom ?? null, acquisitionNote: i.acquisitionNote ?? null, acquisitionPriceCents: i.acquisitionPriceCents ?? null })
  return { id: a.id, scope }
}

/** A draft of "Cadastrar obra" the collector resumes (/wallet/register?draft=<id>): theirs, still DRAFT, registered as an own artwork. */
export async function collectorDraft(userId: number, artworkId: number) {
  const scope = await collectorScope(userId)
  if (!scope) return null
  const a = await withScope(scope, 'collector:draft', () => getArtwork(scope, artworkId))
  if (!a || a.status !== 'DRAFT' || !a.acquisitionKind) return null
  return a
}

export interface CollectorDraftRow { id: number; title: string; artist: string; cover: string | null; status: string; href: string | null }

/**
 * "Em cadastro" of Minha coleção: the collector's own artworks without a deed yet — a DRAFT resumes
 * the register, one sent to certification only shows its state (the deed arrives when it is issued).
 */
export async function collectorDrafts(userId: number): Promise<CollectorDraftRow[]> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { memberId: true, member: { select: { kind: true } } } })
  if (!u?.memberId || u.member?.kind !== 'COLLECTOR') return []
  const scope = await collectorScope(userId)
  if (!scope) return []
  const rows = await withScope(scope, 'collector:drafts', () => prisma.artwork.findMany({
    where: { memberId: u.memberId!, status: { in: ['DRAFT', 'IN_CERTIFICATION'] }, acquisitionKind: { not: null } },
    select: { id: true, title: true, status: true, artist: { select: { name: true } }, media: { where: { kind: 'FRONT_COLOR_CARD' }, select: { publicUrl: true }, take: 1 } },
    orderBy: { updatedAt: 'desc' }, take: 50,
  }))
  return rows.map((r) => ({ id: r.id, title: r.title, artist: r.artist.name, cover: r.media[0]?.publicUrl ?? null, status: r.status, href: r.status === 'DRAFT' ? `/wallet/register?draft=${r.id}` : null }))
}

/** The scope of the collector's own member (null until they own or register something). */
export async function collectorScope(userId: number): Promise<Scope | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { memberId: true, tenantId: true } })
  if (!u?.memberId) return null
  return scopeOfUser({ profile: 'collector', memberId: u.memberId, tenantId: u.tenantId, tenantRole: 'ADMIN' }, () => false)
}

/**
 * "Vendas · Em andamento" of the collector: the deals where their OWN collector
 * member is the seller (secondary market). Empty while they own nothing; a
 * user whose member is not a collector (artist, gallery) sells from the panel.
 */
export async function collectorSales(userId: number): Promise<DealView[]> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { member: { select: { kind: true } } } })
  if (u?.member?.kind !== 'COLLECTOR') return []
  const scope = await collectorScope(userId)
  if (!scope) return []
  return withScope(scope, 'collector:sales', () => sellerDeals(scope))
}

/** "Vender" from the wallet: the artwork must be the holder's (its member) and authenticated. */
export async function sellOwnArtwork(userId: number, artworkId: number, m: { listPriceCents: bigint; reservePriceCents: bigint; autoNegotiatorOn: boolean; autoAcceptMinBps: number; fixedPrice: boolean }) {
  const scope = await collectorScope(userId)
  if (!scope) throw new ArtworkError('NOT_OWNER', 'Esta obra ainda não está em seu nome.', 403)
  return listArtworkForSale(scope, artworkId, m, { userId })
}

/** Catalog entries a collector can order for one artwork (App Colecionador › Serviços para uma obra). */
export const ARTWORK_SERVICE_CODES = ['CERTIFICATION', 'APPRAISAL_SIGNED', 'PROVENANCE_CHECK', 'APPRAISAL_FORENSIC', 'COLLECTION_INSURANCE', 'TRANSIT_INSURANCE', 'SHIPPING', 'PARTNER_SERVICE'] as const
export type ArtworkServiceCode = (typeof ARTWORK_SERVICE_CODES)[number]

export async function artworkServices(): Promise<{ code: string; name: string; description: string; priceCents: bigint; unit: string }[]> {
  const rows = await catalog()
  return rows.filter((r) => (ARTWORK_SERVICE_CODES as readonly string[]).includes(r.code)).map((r) => ({ code: r.code, name: r.name, description: r.description ?? '', priceCents: r.priceCents, unit: r.unit }))
}

/** Orders a service for an artwork the person holds (certificate) or registered as theirs. */
export async function orderArtworkService(userId: number, artworkId: number, code: string): Promise<{ id: number; code: string; amountCents: bigint } | { quote: true }> {
  if (!(ARTWORK_SERVICE_CODES as readonly string[]).includes(code)) throw new ArtworkError('BAD_SERVICE', 'Serviço não disponível para obras.', 422)
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { memberId: true, tenantId: true } })
  const owns = await prisma.artwork.findFirst({ where: { id: artworkId, OR: [{ memberId: u.memberId ?? -1 }, { certificate: { versions: { some: { holderUserId: userId, status: 'ACTIVE' } } } }] }, select: { id: true, title: true } })
  if (!owns) throw new ArtworkError('NOT_OWNER', 'Esta obra não está em seu nome.', 404)
  const item = (await catalog()).find((r) => r.code === code)
  if (!item) throw new ArtworkError('BAD_SERVICE', 'Serviço não disponível.', 422)
  if (item.unit === 'QUOTE' || item.priceCents === 0n) {
    // A quote: no charge now; the desk reaches out (a notification to the staff is the follow-up).
    void audit.event({ entity: 'artwork', entityId: artworkId, action: 'service_quote', userId, after: { code } })
    return { quote: true }
  }
  const o = await placeOrder({ serviceCode: code as ArtworkServiceCode, payerKind: 'REQUESTER', userId, memberId: u.memberId, tenantId: u.tenantId, artworkId, description: `${item.name} · ${owns.title}` })
  if (!o) throw new ArtworkError('ORDERS_OFF', 'Pedidos desligados nesta instalação.', 503)
  return { id: o.id, code: o.code, amountCents: o.amountCents }
}
