// Artworks — I/O behind the scope. Every list spreads a lib/scope builder;
// every read by id passes `canView` (out of scope = 404, never 403).
import 'server-only'
import { prisma } from '@/lib/prisma'
import { canView, memberFilter, memberOfScope, tenantOfScope, type Scope } from '@/lib/scope/core'
import { audit } from '@/lib/audit'
import { openReviewItem } from '@/lib/admin-review/server'
import { ARTWORK_STATUSES, LIST_FILTERS, MEDIA_SLOTS, type ArtworkStatus } from './domain'
import type { ArtworkPatch } from './input'
import { submitProblems } from './state-machine'

export class ArtworkError extends Error {
  constructor(public code: string, message: string, public status = 400) { super(message) }
}

const SUMMARY_SELECT = {
  id: true, title: true, year: true, technique: true, heightMm: true, widthMm: true, depthMm: true, status: true, seal: true,
  listPriceCents: true, saleMode: true, publicId: true, updatedAt: true, createdAt: true, coverMediaId: true,
  artist: { select: { name: true } },
  media: { where: { kind: 'FRONT_COLOR_CARD' }, select: { publicUrl: true }, take: 1 },
} as const

export interface ArtworkSummary {
  id: number; title: string; year: number | null; technique: string | null; dimensions: { heightMm: number | null; widthMm: number | null; depthMm: number | null }
  status: ArtworkStatus; seal: string; listPriceCents: bigint | null; saleMode: string | null; publicId: string | null; artistName: string; coverUrl: string | null; updatedAt: Date
}

function toSummary(a: { id: number; title: string; year: number | null; technique: string | null; heightMm: number | null; widthMm: number | null; depthMm: number | null; status: string; seal: string; listPriceCents: bigint | null; saleMode: string | null; publicId: string | null; updatedAt: Date; artist: { name: string }; media: { publicUrl: string | null }[] }): ArtworkSummary {
  return {
    id: a.id, title: a.title, year: a.year, technique: a.technique,
    dimensions: { heightMm: a.heightMm, widthMm: a.widthMm, depthMm: a.depthMm },
    status: a.status as ArtworkStatus, seal: a.seal, listPriceCents: a.listPriceCents, saleMode: a.saleMode, publicId: a.publicId,
    artistName: a.artist.name, coverUrl: a.media[0]?.publicUrl ?? null, updatedAt: a.updatedAt,
  }
}

export async function listArtworks(scope: Scope, opt: { filter?: string; take?: number } = {}): Promise<{ items: ArtworkSummary[]; counts: Record<string, number> }> {
  const where = { ...memberFilter(scope) }
  const filter = LIST_FILTERS.find((f) => f.key === (opt.filter ?? 'all')) ?? LIST_FILTERS[0]
  const [rows, grouped] = await Promise.all([
    prisma.artwork.findMany({
      where: { ...where, ...(filter.statuses ? { status: { in: [...filter.statuses] } } : {}) },
      select: SUMMARY_SELECT, orderBy: { updatedAt: 'desc' }, take: opt.take ?? 200,
    }),
    prisma.artwork.groupBy({ by: ['status'], where, _count: { _all: true } }),
  ])
  const byStatus = new Map(grouped.map((g) => [g.status, g._count._all]))
  const counts: Record<string, number> = {}
  for (const f of LIST_FILTERS) counts[f.key] = f.statuses ? f.statuses.reduce((n, s) => n + (byStatus.get(s) ?? 0), 0) : [...byStatus.values()].reduce((a, b) => a + b, 0)
  return { items: rows.map(toSummary), counts }
}

/** Creates a DRAFT for the session's member (the gallery staff creates for an artist of the gallery). */
export async function createDraft(scope: Scope, opt: { artistId?: number | null; artistName?: string | null; title?: string } = {}) {
  const memberId = memberOfScope(scope)
  if (!memberId) throw new ArtworkError('NO_MEMBER', 'Só um membro (artista, galeria ou consultor) cadastra obras.', 403)
  const member = await prisma.member.findUnique({ where: { id: memberId }, include: { artist: true } })
  if (!member) throw new ArtworkError('NO_MEMBER', 'Membro não encontrado.', 403)
  let artistId = opt.artistId ?? member.artist?.id ?? null
  if (member.kind === 'COLLECTOR') {
    // A collector registers a work by any artist: an existing one by id, or a named one (born unverified in their tenant).
    if (artistId && !(await prisma.artist.findUnique({ where: { id: artistId }, select: { id: true } }))) throw new ArtworkError('ARTIST_NOT_FOUND', 'Artista não encontrado.', 404)
    const name = opt.artistName?.replace(/\s+/g, ' ').trim()
    if (!artistId && name) {
      const found = await prisma.artist.findFirst({ where: { name: { equals: name, mode: 'insensitive' } }, select: { id: true }, orderBy: { id: 'asc' } })
      artistId = found?.id ?? (await prisma.artist.create({ data: { tenantId: member.tenantId, name, slug: `artista-${member.tenantId}-${Date.now().toString(36)}` } })).id
    }
  } else if (artistId && !member.artist) {
    const artist = await prisma.artist.findFirst({ where: { id: artistId, OR: [{ tenantId: member.tenantId }, { member: { tenantId: member.tenantId } }] } })
    if (!artist) throw new ArtworkError('ARTIST_NOT_REACHABLE', 'Artista fora da sua galeria.', 404)
  }
  if (!artistId) {
    // A gallery without a chosen artist: a placeholder artist of the gallery that the sheet renames.
    const artist = await prisma.artist.create({ data: { tenantId: member.tenantId, name: 'Artista a informar', slug: `artista-${member.tenantId}-${Date.now().toString(36)}` } })
    artistId = artist.id
  }
  const artwork = await prisma.artwork.create({ data: { memberId, artistId, title: opt.title?.trim() || 'Nova obra', status: 'DRAFT' } })
  void audit.create({ entity: 'artwork', entityId: artwork.id, after: { id: artwork.id, title: artwork.title } })
  return artwork
}

/** "Nova obra" by the web page: a GET, so it must not pile up drafts — reopens the member's newest
 *  untouched draft (default title, no photo) before creating another. */
export async function openBlankDraft(scope: Scope) {
  const memberId = memberOfScope(scope)
  if (memberId) {
    // a collector's "Cadastrar obra" draft (it carries the origin) is never adopted by the artist wizard
    const blank = await prisma.artwork.findFirst({ where: { memberId, status: 'DRAFT', title: 'Nova obra', acquisitionKind: null, media: { none: {} } }, orderBy: { id: 'desc' } })
    if (blank) return blank
  }
  return createDraft(scope)
}

export async function getArtwork(scope: Scope, id: number) {
  const a = await prisma.artwork.findUnique({
    where: { id },
    include: {
      artist: { select: { id: true, name: true } },
      media: { orderBy: { sortOrder: 'asc' } },
      conditionRegions: true,
      historyItems: { orderBy: { sortOrder: 'asc' } },
      duplicateChecks: { where: { decision: 'PENDING' }, include: { candidate: { select: { id: true, title: true, year: true, publicId: true, memberId: true } } } },
      certificate: { select: { stage: true, status: true } },
    },
  })
  if (!a || !canView(scope, a)) return null
  return a
}

export async function patchArtwork(scope: Scope, id: number, patch: ArtworkPatch) {
  const current = await prisma.artwork.findUnique({ where: { id }, select: { id: true, memberId: true, tenantId: true, status: true } })
  if (!current || !canView(scope, current)) throw new ArtworkError('NOT_FOUND', 'Obra não encontrada.', 404)
  if (!['DRAFT', 'IN_CERTIFICATION', 'AUTHENTICATED'].includes(current.status)) throw new ArtworkError('LOCKED', 'A obra não pode mais ser editada neste estado.', 409)
  const { conditionRegions, historyItems, ...fields } = patch
  await prisma.$transaction(async (tx) => {
    const data = { ...fields, ...(fields.conditionGrade !== undefined ? { conditionAt: new Date() } : {}) }
    await tx.artwork.update({ where: { id }, data: { ...data, listPriceCents: fields.listPriceCents === undefined ? undefined : fields.listPriceCents === null ? null : BigInt(fields.listPriceCents) } })
    if (conditionRegions) {
      for (const r of conditionRegions) {
        await tx.artworkConditionRegion.upsert({ where: { artworkId_region: { artworkId: id, region: r.region } }, create: { artworkId: id, ...r }, update: { note: r.note, state: r.state } })
      }
    }
    if (historyItems) {
      await tx.artworkHistoryItem.deleteMany({ where: { artworkId: id } })
      if (historyItems.length) await tx.artworkHistoryItem.createMany({ data: historyItems.map((h, i) => ({ artworkId: id, ...h, sortOrder: i })) })
    }
  })
  return getArtwork(scope, id)
}

/** "Enviar para certificação": DRAFT → IN_CERTIFICATION and a Certificate shell at stage 0. */
export async function submitForCertification(scope: Scope, id: number, actor: { userId: number; name: string }) {
  const a = await getArtwork(scope, id)
  if (!a) throw new ArtworkError('NOT_FOUND', 'Obra não encontrada.', 404)
  if (a.status !== 'DRAFT') throw new ArtworkError('INVALID_TRANSITION', 'A obra já foi enviada.', 409)
  const problems = submitProblems({ title: a.title, artistId: a.artistId, technique: a.technique, mediaKinds: a.media.map((m) => m.kind) })
  if (problems.length) throw new ArtworkError('INCOMPLETE', problems.join(' '), 422)
  if (a.duplicateChecks.length) throw new ArtworkError('DUPLICATE_PENDING', 'Decida sobre a obra parecida antes de enviar.', 409)
  const updated = await prisma.artwork.updateMany({ where: { id, status: 'DRAFT' }, data: { status: 'IN_CERTIFICATION', seal: 'YELLOW', submittedAt: new Date(), conditionBy: a.conditionBy ?? actor.name } })
  if (updated.count === 0) throw new ArtworkError('INVALID_TRANSITION', 'A obra acabou de mudar.', 409)
  await prisma.certificate.upsert({ where: { artworkId: id }, create: { artworkId: id, stage: 0, status: 'DRAFT' }, update: {} })
  void audit.event({ entity: 'artwork', entityId: id, action: 'submit_for_certification', userId: actor.userId, userName: actor.name })
  // "Emissor novo": the first submission of an account goes to the house review (portfolio check).
  if (a.tenantId) {
    const earlier = await prisma.artwork.count({ where: { tenantId: a.tenantId, id: { not: id }, submittedAt: { not: null } } })
    if (earlier === 0) await openReviewItem({ kind: 'NEW_ISSUER', artworkId: id, tenantId: a.tenantId, reason: 'Primeiro envio desta conta · conferir portfólio' })
  }
  return getArtwork(scope, id)
}

export async function decideDuplicate(scope: Scope, artworkId: number, checkId: number, decision: 'DIFFERENT' | 'SAME', userId: number) {
  const a = await prisma.artwork.findUnique({ where: { id: artworkId }, select: { memberId: true, tenantId: true } })
  if (!a || !canView(scope, a)) throw new ArtworkError('NOT_FOUND', 'Obra não encontrada.', 404)
  const r = await prisma.duplicateCheck.updateMany({ where: { id: checkId, artworkId, decision: 'PENDING' }, data: { decision, decidedByUserId: userId, decidedAt: new Date() } })
  if (r.count === 0) throw new ArtworkError('NOT_FOUND', 'Verificação não encontrada.', 404)
  // "É a mesma obra": the duplicate registration is archived by its own owner.
  if (decision === 'SAME') await prisma.artwork.updateMany({ where: { id: artworkId, status: 'DRAFT' }, data: { status: 'ARCHIVED' } })
  // "São obras diferentes" against a work of ANOTHER account: the house confirms (audit 2026-10-25 —
  // the Duplicidade kind of the queue was never opened).
  if (decision === 'DIFFERENT') {
    const check = await prisma.duplicateCheck.findUnique({ where: { id: checkId }, select: { similarityBps: true, candidate: { select: { tenantId: true, title: true } } } })
    if (check && check.candidate.tenantId !== a.tenantId) {
      const pct = Math.round(check.similarityBps / 100)
      await openReviewItem({ kind: 'DUPLICATE', artworkId, tenantId: a.tenantId, refId: checkId, reason: `Imagem ${pct}% semelhante a “${check.candidate.title}”, de outra conta` })
    }
  }
}

export { ARTWORK_STATUSES, MEDIA_SLOTS, tenantOfScope }
