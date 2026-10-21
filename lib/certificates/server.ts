// Certificate-deed — I/O: sign, issue, the member's certification view, the
// public verification projection, the daily anchor.
import 'server-only'
import { prisma } from '@/lib/prisma'
import { Prisma } from '@/app/generated/prisma/client'
import { canView, memberFilter, type Scope } from '@/lib/scope/core'
import { totalScope } from '@/lib/scope/context'
import { audit } from '@/lib/audit'
import { savePrivateFile } from '@/lib/storage/private-vault'
import { publicBaseUrl } from '@/lib/public-url'
import { formatDimensions } from '@/lib/artworks/domain'
import { ArtworkError } from '@/lib/artworks/server'
import { actionOf, stageOf } from '@/lib/physical-markers/domain'
import { ordersOf } from '@/lib/physical-markers/server'
import { chainValid, contentHashOf, EVENT_LABELS, holderLabel, merkleRoot, type CertificateContent, type EventKind } from './core'
import { recordEvent } from '@/lib/certificate-events/server'
import { renderCertificatePdf } from './pdf'
import { sha256OfBytes, signJws, timestamp } from './signing'

// ── the member's Certificação screen ─────────────────────────────────────
export async function certificationView(scope: Scope) {
  const [artworks, orders] = await Promise.all([
    prisma.artwork.findMany({
      where: { ...memberFilter(scope), status: { in: ['IN_CERTIFICATION', 'AUTHENTICATED', 'LISTED', 'IN_DEAL', 'SOLD'] } },
      select: { id: true, title: true, year: true, publicId: true, status: true, submittedAt: true, certificate: { select: { id: true, stage: true, status: true, signedAt: true, issuedAt: true } }, media: { where: { kind: 'FRONT_COLOR_CARD' }, select: { publicUrl: true }, take: 1 } },
      orderBy: { submittedAt: 'desc' },
    }),
    ordersOf(scope),
  ])
  const hasOrder = orders.length > 0
  const orderDelivered = orders.some((o) => o.status === 'DELIVERED' || o.status === 'SHIPPED')
  const items = artworks.map((a) => {
    const stage = stageOf({ submitted: true, hasOrder, orderDelivered, linked: !!a.publicId, signed: !!a.certificate?.signedAt, issued: !!a.certificate?.issuedAt })
    return { id: a.id, certificateId: a.certificate?.id ?? null, title: `${a.title}${a.year ? `, ${a.year}` : ''}`, publicId: a.publicId, cover: a.media[0]?.publicUrl ?? null, stage, ...actionOf(stage), status: a.status }
  })
  return { items, orders: orders.map((o) => ({ id: o.id, quantity: o.quantity, status: o.status, createdAt: o.createdAt })) }
}

async function certificateReachable(scope: Scope, certificateId: number) {
  const c = await prisma.certificate.findUnique({ where: { id: certificateId }, include: { artwork: { include: { artist: true, media: true, conditionRegions: true, member: { select: { displayName: true, tenantId: true } }, owners: true } } } })
  if (!c || !canView(scope, c.artwork)) throw new ArtworkError('NOT_FOUND', 'Certificado não encontrado.', 404)
  return c
}

function contentOf(c: Awaited<ReturnType<typeof certificateReachable>>, version: number): CertificateContent {
  const a = c.artwork
  const owner = a.owners[0]
  return {
    publicId: c.publicId ?? a.publicId ?? '',
    artwork: { title: a.title, year: a.year, technique: a.technique, materials: a.materials, dimensionsMm: { h: a.heightMm, w: a.widthMm, d: a.depthMm }, edition: a.edition, category: a.category },
    artist: { name: a.artist.name, slug: a.artist.slug },
    holder: { name: owner?.partyName ?? a.artist.name, documentMask: owner?.documentMask ?? null },
    media: a.media.map((m) => ({ kind: m.kind, sha256: m.sha256 })).sort((x, y) => x.kind.localeCompare(y.kind)),
    condition: { grade: a.conditionGrade, regions: a.conditionRegions.map((r) => ({ region: r.region, state: r.state, note: r.note })).sort((x, y) => x.region.localeCompare(y.region)) },
    issuedBy: 'HouseArt',
    version,
  }
}

/** "Assinar certificado" (HouseSign modal): issuer JWS + member evidence + timestamp → stage 4. */
export async function signCertificate(scope: Scope, certificateId: number, actor: { userId: number; name: string; ip?: string; userAgent?: string }) {
  const c = await certificateReachable(scope, certificateId)
  if (!c.publicId || !c.artwork.publicId) throw new ArtworkError('NOT_LINKED', 'Vincule a etiqueta antes de assinar.', 409)
  if (c.signedAt) throw new ArtworkError('ALREADY_SIGNED', 'O certificado já foi assinado.', 409)
  const content = contentOf(c, 1)
  const contentHash = contentHashOf(content)
  const now = new Date()
  const evidence = { signer: { userId: actor.userId, name: actor.name }, ip: actor.ip ?? null, userAgent: actor.userAgent ?? null, at: now.toISOString(), declaration: 'Declaro ser a autora/o autor desta obra.' }
  const jws = signJws({ typ: 'certificate', publicId: c.publicId, contentHash, version: 1, signedBy: actor.userId, at: now.toISOString() })
  const tst = timestamp(contentHash, now)
  const r = await prisma.certificate.updateMany({ where: { id: certificateId, signedAt: null }, data: { signedAt: now, signedByUserId: actor.userId, signatureJson: JSON.stringify({ issuerJws: jws, memberEvidence: evidence }), timestampTokenRef: tst.token, stage: 4 } })
  if (r.count === 0) throw new ArtworkError('ALREADY_SIGNED', 'O certificado acabou de ser assinado.', 409)
  void audit.event({ entity: 'certificate', entityId: certificateId, action: 'sign', userId: actor.userId, userName: actor.name, after: { contentHash } })
  return { contentHash, timestampAt: tst.time }
}

/** "Emitir": version 1 ACTIVE + CERTIFIED event + PDF; the artwork becomes AUTHENTICATED with the GREEN seal → stage 5. */
export async function issueCertificate(scope: Scope, certificateId: number, actor: { userId: number; name: string }) {
  const c = await certificateReachable(scope, certificateId)
  if (!c.signedAt || !c.signatureJson || !c.publicId) throw new ArtworkError('NOT_SIGNED', 'Assine o certificado antes de emitir.', 409)
  if (c.issuedAt) throw new ArtworkError('ALREADY_ISSUED', 'O certificado já foi emitido.', 409)
  const content = contentOf(c, 1)
  const contentHash = contentHashOf(content)
  const now = new Date()
  const verifyUrl = `${publicBaseUrl()}/verify/${c.publicId}`
  const pdf = await renderCertificatePdf({
    publicId: c.publicId, title: c.artwork.title, year: c.artwork.year, artist: c.artwork.artist.name, technique: c.artwork.technique,
    dimensions: formatDimensions(c.artwork), holderName: content.holder.name, holderMask: content.holder.documentMask, issuedAt: now, contentHash, verifyUrl,
    timestampLine: `mock · ${c.signedAt.toISOString()}`,
  })
  const pdfRef = await savePrivateFile({ buffer: Buffer.from(pdf), contentType: 'application/pdf', prefix: `certificates/${c.id}` })
  const pdfHash = sha256OfBytes(pdf)
  await prisma.$transaction(async (tx) => {
    const r = await tx.certificate.updateMany({ where: { id: certificateId, issuedAt: null }, data: { issuedAt: now, status: 'ACTIVE', stage: 5 } })
    if (r.count === 0) throw new ArtworkError('ALREADY_ISSUED', 'O certificado acabou de ser emitido.', 409)
    const version = await tx.certificateVersion.create({
      data: { certificateId, version: 1, holderName: content.holder.name, holderDocumentHash: c.artwork.owners[0]?.documentHash ?? null, holderDocumentMask: content.holder.documentMask, holderUserId: c.artwork.member ? actor.userId : null, contentJson: JSON.stringify(content), contentHash, prevHash: null, signaturesJson: c.signatureJson ?? '[]', timestampTokenRef: c.timestampTokenRef, issuedAt: now, pdfRef, pdfHash },
    })
    await tx.certificate.update({ where: { id: certificateId }, data: { currentVersionId: version.id } })
    await tx.artwork.update({ where: { id: c.artworkId }, data: { status: 'AUTHENTICATED', seal: 'GREEN', sealIssuedAt: now } })
  })
  await recordEvent(c.artworkId, 'CERTIFIED', { version: 1, contentHash, pdfHash }, actor.userId)
  void audit.event({ entity: 'certificate', entityId: certificateId, action: 'issue', userId: actor.userId, userName: actor.name, after: { contentHash, pdfHash } })
  return { publicId: c.publicId, contentHash, pdfHash }
}

/** Sign + issue for the member who wants one click; kept separate on purpose. */
export async function certificateOfArtwork(scope: Scope, artworkId: number) {
  const c = await prisma.certificate.findUnique({ where: { artworkId }, include: { artwork: { select: { memberId: true, tenantId: true } }, versions: { orderBy: { version: 'desc' }, take: 1 } } })
  if (!c || !canView(scope, c.artwork)) return null
  return c
}

// ── public verification ──────────────────────────────────────────────────
/** The three states of the public verification page (Verificação): what the
 *  certificate and the artwork say together. STOLEN wins over a contestation. */
export type VerificationVerdict = 'authenticated' | 'contested' | 'stolen'
export function verdictOf(certificateStatus: string, artworkStatus: string): VerificationVerdict {
  if (artworkStatus === 'STOLEN') return 'stolen'
  if (certificateStatus === 'CONTESTED' || artworkStatus === 'DISPUTED') return 'contested'
  return 'authenticated'
}

export interface PublicCertificate {
  publicId: string
  status: 'ACTIVE' | 'CONTESTED' | 'REVOKED' | 'PENDING'
  artworkStatus: string
  verdict: VerificationVerdict
  artwork: { title: string; year: number | null; technique: string | null; dimensions: string; category: string; edition: string | null; cover: string | null }
  artist: string
  artistSlug: string
  /** "(Salvador/BA, 1988)" — only what the public profile holds. */
  artistMeta: string | null
  holder: string | null
  issuedAt: string | null
  contentHash: string | null
  version: number | null
  chainValid: boolean
  /** TRANSFERRED events + 1: the holders since the issue. */
  holders: number
  /** When the artwork is LISTED with the green seal: the seller and the public price (null when on request). */
  sale: { seller: string; priceCents: string | null } | null
  /** Latest issued value opinion for the artwork, month and year only. */
  appraisalIssuedAt: string | null
  disputedAt: string | null
  stolenAt: string | null
  events: { seq: number; kind: string; label: string; at: string }[]
}

export async function publicCertificate(publicId: string): Promise<PublicCertificate | null> {
  return totalScope('certificates:public', async () => {
    const a = await prisma.artwork.findUnique({ where: { publicId }, include: { artist: { include: { profile: { select: { birthPlace: true } } } }, media: { where: { kind: 'FRONT_COLOR_CARD' }, take: 1 }, member: { select: { kind: true, displayName: true } }, certificate: { include: { versions: { where: { status: 'ACTIVE' }, orderBy: { version: 'desc' }, take: 1 }, events: { orderBy: { seq: 'asc' } } } } } })
    if (!a) return null
    const c = a.certificate
    const v = c?.versions[0] ?? null
    const status = !c || !c.issuedAt ? 'PENDING' : (c.status as 'ACTIVE' | 'CONTESTED' | 'REVOKED')
    const holderKind = a.member.kind === 'ARTIST' ? 'ARTIST' : a.member.kind === 'GALLERY_STAFF' ? 'GALLERY' : 'COLLECTOR'
    const events = c?.events ?? []
    const lastOf = (kind: string) => events.filter((e) => e.kind === kind).at(-1)?.occurredAt.toISOString() ?? null
    const appraisal = await prisma.appraisal.findFirst({ where: { artworkId: a.id, status: 'ISSUED' }, orderBy: { issuedAt: 'desc' }, select: { issuedAt: true } })
    const birth = [a.artist.profile?.birthPlace, a.artist.birthYear].filter(Boolean).join(', ')
    return {
      publicId,
      status,
      artworkStatus: a.status,
      verdict: verdictOf(status, a.status),
      artwork: { title: a.title, year: a.year, technique: a.technique, dimensions: formatDimensions(a), category: a.category, edition: a.edition, cover: a.media[0]?.publicUrl ?? null },
      artist: a.artist.name,
      artistSlug: a.artist.slug,
      artistMeta: birth ? `(${birth})` : null,
      holder: v ? holderLabel({ kind: holderKind, name: v.holderName, since: v.issuedAt }) : null,
      issuedAt: c?.issuedAt?.toISOString() ?? null,
      contentHash: v?.contentHash ?? null,
      version: v?.version ?? null,
      chainValid: c ? chainValid(c.events) : true,
      holders: events.filter((e) => e.kind === 'TRANSFERRED').length + 1,
      sale: a.status === 'LISTED' && a.seal === 'GREEN' ? { seller: a.member.kind === 'GALLERY_STAFF' ? a.member.displayName : 'Colecionador particular', priceCents: a.saleMode === 'ON_REQUEST' || a.listPriceCents == null ? null : a.listPriceCents.toString() } : null,
      appraisalIssuedAt: appraisal?.issuedAt?.toISOString() ?? null,
      disputedAt: lastOf('DISPUTED'),
      stolenAt: lastOf('STOLEN'),
      events: events.map((e) => ({ seq: e.seq, kind: e.kind, label: EVENT_LABELS[e.kind as EventKind] ?? e.kind, at: e.occurredAt.toISOString() })),
    }
  })
}

// ── public search (Verificar) ────────────────────────────────────────────
export interface CertificateSearchHit {
  publicId: string
  title: string
  year: number | null
  artist: string
  technique: string | null
  cover: string | null
  verdict: VerificationVerdict
}

/** Letters and digits only, no accents, lower case — the same rule on both sides of the comparison. */
export function normalizeSearch(t: string | null | undefined): string {
  return (t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

const searchable = (): Prisma.ArtworkWhereInput => ({ certificate: { isNot: null }, OR: [{ seal: 'GREEN' }, { status: { in: ['STOLEN', 'DISPUTED'] } }] })

/** The public search of Verificar: by certificate number (or marker serial), or by artist / title / year.
 *  Only artworks with a certificate and the green seal — or marked STOLEN/DISPUTED, which the public must see. */
export async function searchCertificates(q: { id?: string; artist?: string; title?: string; year?: string }, take = 20): Promise<CertificateSearchHit[]> {
  return totalScope('certificates:search', async () => {
    const select = ({ publicId: true, title: true, year: true, technique: true, status: true, artist: { select: { name: true } }, certificate: { select: { status: true } }, media: { where: { kind: 'FRONT_COLOR_CARD' }, select: { publicUrl: true }, take: 1 } }) satisfies Prisma.ArtworkSelect
    type Row = Prisma.ArtworkGetPayload<{ select: typeof select }>
    const hit = (r: Row): CertificateSearchHit => ({ publicId: r.publicId!, title: r.title, year: r.year, artist: r.artist.name, technique: r.technique, cover: r.media[0]?.publicUrl ?? null, verdict: verdictOf(r.certificate?.status ?? 'ACTIVE', r.status) })
    const byId = q.id !== undefined
    if (byId) {
      const needle = normalizeSearch(q.id)
      if (!needle) return []
      // the serial of the marker (7 bytes hex) also finds the artwork
      if (/^[0-9a-f]{14}$/.test(needle)) {
        const m = await prisma.physicalMarker.findUnique({ where: { uid: needle }, select: { artworkId: true } })
        if (m?.artworkId) {
          const r = await prisma.artwork.findFirst({ where: { id: m.artworkId, publicId: { not: null }, ...searchable() }, select })
          return r ? [hit(r)] : []
        }
      }
      const rows = await prisma.artwork.findMany({ where: { publicId: { not: null }, ...searchable() }, select, orderBy: { updatedAt: 'desc' }, take: 2000 })
      return rows.filter((r) => normalizeSearch(r.publicId).includes(needle)).slice(0, take).map(hit)
    }
    const artist = (q.artist ?? '').trim()
    const title = (q.title ?? '').trim()
    const year = /^\d{4}$/.test((q.year ?? '').trim()) ? Number((q.year ?? '').trim()) : null
    if (!artist && !title && year === null) return []
    const rows = await prisma.artwork.findMany({
      where: { publicId: { not: null }, ...searchable(), ...(artist ? { artist: { name: { contains: artist, mode: 'insensitive' } } } : {}), ...(title ? { title: { contains: title, mode: 'insensitive' } } : {}), ...(year !== null ? { year } : {}) },
      select, orderBy: [{ artist: { name: 'asc' } }, { year: 'desc' }], take,
    })
    return rows.map(hit)
  })
}

/** Public contestation: opens CONTESTATION in the review queue and marks the certificate CONTESTED. */
export async function contestCertificate(publicId: string, reason: string) {
  return totalScope('certificates:contest', async () => {
    const a = await prisma.artwork.findUnique({ where: { publicId }, select: { id: true, tenantId: true, certificate: { select: { id: true, status: true } } } })
    if (!a?.certificate || a.certificate.status !== 'ACTIVE') return false
    const { openReviewItem } = await import('@/lib/admin-review/server')
    await openReviewItem({ kind: 'CONTESTATION', artworkId: a.id, tenantId: a.tenantId, reason: reason.slice(0, 500) })
    await prisma.certificate.updateMany({ where: { id: a.certificate.id, status: 'ACTIVE' }, data: { status: 'CONTESTED' } })
    await recordEvent(a.id, 'DISPUTED', { reason: reason.slice(0, 200) }, null)
    return true
  })
}

// ── daily anchor (cron certificate-anchor) ───────────────────────────────
export async function anchorDay(day: string): Promise<{ day: string; eventCount: number; merkleRoot: string }> {
  const events = await prisma.certificateEvent.findMany({ where: { anchorDay: null, occurredAt: { lt: new Date(`${day}T03:00:00.000Z`) } }, orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }], take: 50_000 })
  const root = merkleRoot(events.map((e) => e.hash))
  await prisma.$transaction(async (tx) => {
    await tx.dailyAnchor.upsert({ where: { day }, create: { day, merkleRoot: root, network: process.env.ANCHOR_NETWORK?.toUpperCase() === 'OPENTIMESTAMPS' ? 'OPENTIMESTAMPS' : 'NONE', eventCount: events.length }, update: { merkleRoot: root, eventCount: events.length } })
    if (events.length) await tx.certificateEvent.updateMany({ where: { id: { in: events.map((e) => e.id) } }, data: { anchorDay: day } })
  })
  return { day, eventCount: events.length, merkleRoot: root }
}
