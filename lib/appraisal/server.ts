// Appraisal — I/O. The request (holder or member) opens the queue item and
// the APPRAISAL_SIGNED order; the appraiser reads the dossier with suggested
// comparables and the reference range, and "Assinar e emitir laudo" writes
// the ISSUED Appraisal: signed content hash (JWS), PDF in the vault, public
// verification by HA-L code. The estimate of the wizard's step 5 is the same
// pure core over the same comparables.
import 'server-only'
import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { flagOn } from '@/lib/flags'
import { audit } from '@/lib/audit'
import { ArtworkError } from '@/lib/artworks/server'
import { CONDITION_GRADE_LABELS, formatDimensions } from '@/lib/artworks/domain'
import { canView, memberOfScope, tenantOfScope, type Scope } from '@/lib/scope/core'
import { totalScope } from '@/lib/scope/context'
import { notify } from '@/lib/notifications/server'
import { placeOrder } from '@/lib/orders/server'
import { signJws, sha256OfBytes } from '@/lib/certificates/signing'
import { savePrivateFile } from '@/lib/storage/private-vault'
import { publicBaseUrl } from '@/lib/public-url'
import { appraisalHash, type AppraisalContent } from './core'
import { estimateFromComparables, validRange, type Estimate } from './estimate-core'
import { APPRAISAL_DUE_DAYS, appraisalCode, isPurpose, PURPOSE_LABELS, SOURCE_LABELS, type AppraisalPurpose, type ComparableSource } from './domain'
import { renderAppraisalPdf } from './pdf'

export interface Comparable { id: number | null; label: string; dimensions: string | null; priceCents: bigint; soldOn: Date; source: ComparableSource }

/** Registered sales of the artist: catalog rows + platform deals/transfers (mirrored live, never duplicated). */
export async function comparablesOf(artistId: number, exceptArtworkId: number | null = null): Promise<Comparable[]> {
  const rows = await prisma.appraisalComparable.findMany({ where: { artistId }, orderBy: { soldOn: 'desc' }, take: 20 })
  const deals = await prisma.deal.findMany({ where: { phase: 'COMPLETED', artwork: { artistId, ...(exceptArtworkId ? { id: { not: exceptArtworkId } } : {}) } }, include: { artwork: true }, orderBy: { completedAt: 'desc' }, take: 20 })
  const transfers = await prisma.ownershipTransfer.findMany({ where: { status: 'COMPLETED', priceSealed: false, priceCents: { not: null }, dealId: null, artwork: { artistId, ...(exceptArtworkId ? { id: { not: exceptArtworkId } } : {}) } }, include: { artwork: true }, orderBy: { completedAt: 'desc' }, take: 20 })
  const out: Comparable[] = rows.map((r) => ({ id: r.id, label: r.label, dimensions: r.dimensions, priceCents: r.priceCents, soldOn: r.soldOn, source: r.source as ComparableSource }))
  for (const d of deals) out.push({ id: null, label: `${d.artwork.title}${d.artwork.year ? `, ${d.artwork.year}` : ''}`, dimensions: formatDimensions(d.artwork), priceCents: d.amountCents, soldOn: d.completedAt ?? d.createdAt, source: 'HOUSEART' })
  for (const t of transfers) out.push({ id: null, label: `${t.artwork.title}${t.artwork.year ? `, ${t.artwork.year}` : ''}`, dimensions: formatDimensions(t.artwork), priceCents: t.priceCents!, soldOn: t.completedAt ?? t.createdAt, source: 'HOUSEART' })
  return out.sort((a, b) => b.soldOn.getTime() - a.soldOn.getTime())
}

/** Step 5 of the wizard: estimate for an artwork the scope reaches (null without comparables). */
export async function estimateForArtwork(scope: Scope, artworkId: number): Promise<(Estimate & { comparables: number }) | null> {
  const a = await prisma.artwork.findUnique({ where: { id: artworkId }, select: { memberId: true, tenantId: true, artistId: true } })
  if (!a || !canView(scope, a)) throw new ArtworkError('NOT_FOUND', 'Obra não encontrada.', 404)
  const comps = await totalScope('appraisal:estimate', () => comparablesOf(a.artistId, artworkId))
  const e = estimateFromComparables(comps.map((c) => c.priceCents))
  return e ? { ...e, comparables: comps.length } : null
}

/** "Pedir laudo" (holder from the wallet, or member for an own artwork). */
export async function requestAppraisal(actor: { userId: number; name: string; scope: Scope | null }, i: { artworkId: number; purpose: string; requesterLabel: string }) {
  if (!flagOn('FLAG_APPRAISAL')) throw new ArtworkError('OFF', 'Laudos não estão ligados.', 404)
  if (!isPurpose(i.purpose)) throw new ArtworkError('BAD_PURPOSE', 'Finalidade inválida.', 400)
  const a = await prisma.artwork.findUnique({ where: { id: i.artworkId }, select: { id: true, memberId: true, tenantId: true, title: true } })
  if (!a) throw new ArtworkError('NOT_FOUND', 'Obra não encontrada.', 404)
  const holds = await prisma.certificateVersion.count({ where: { holderUserId: actor.userId, status: 'ACTIVE', certificate: { artworkId: a.id } } })
  const reaches = actor.scope ? canView(actor.scope, a) : false
  if (!holds && !reaches) throw new ArtworkError('NOT_FOUND', 'Obra não encontrada.', 404)
  const open = await prisma.appraisalRequest.count({ where: { artworkId: a.id, status: { in: ['QUEUED', 'IN_PROGRESS'] } } })
  if (open) throw new ArtworkError('OPEN_REQUEST', 'Já existe um laudo em andamento para esta obra.', 409)
  const dueOn = new Date(Date.now() + APPRAISAL_DUE_DAYS * 86_400_000)
  const tenantId = actor.scope ? tenantOfScope(actor.scope) : null
  const memberId = actor.scope ? memberOfScope(actor.scope) : null
  const req = await prisma.appraisalRequest.create({ data: { artworkId: a.id, tenantId: reaches ? a.tenantId ?? tenantId : null, memberId: reaches ? a.memberId : memberId, requestedByUserId: actor.userId, requesterLabel: i.requesterLabel.slice(0, 40), purpose: i.purpose, dueOn } })
  const order = await placeOrder({ serviceCode: 'APPRAISAL_SIGNED', payerKind: 'REQUESTER', userId: actor.userId, tenantId: reaches ? a.tenantId : null, memberId: reaches ? a.memberId : null, artworkId: a.id, appraisalRequestId: req.id })
  if (order) await prisma.appraisalRequest.update({ where: { id: req.id }, data: { orderId: order.id } })
  void audit.event({ entity: 'appraisal_request', entityId: req.id, action: 'create', userId: actor.userId, after: { purpose: i.purpose } })
  return { id: req.id, dueOn, orderCode: order?.code ?? null }
}

// ── the appraiser's desk ─────────────────────────────────────────────────
export interface QueueItem { id: number; title: string; who: string; dueOn: string; status: string; overdue: boolean }

export async function appraisalQueue(now = new Date()): Promise<QueueItem[]> {
  return totalScope('appraisal:queue', async () => {
    const rows = await prisma.appraisalRequest.findMany({ where: { status: { in: ['QUEUED', 'IN_PROGRESS'] } }, include: { artwork: { include: { artist: true } } }, orderBy: { dueOn: 'asc' }, take: 100 })
    return rows.map((r) => ({ id: r.id, title: `${r.artwork.title}${r.artwork.year ? `, ${r.artwork.year}` : ''} · ${r.artwork.artist.name}`, who: `${r.requesterLabel} · ${PURPOSE_LABELS[r.purpose as AppraisalPurpose] ?? r.purpose}`, dueOn: r.dueOn.toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' }), status: r.status, overdue: r.dueOn < now }))
  })
}

export interface Dossier {
  request: { id: number; status: string; purpose: string; purposeLabel: string; who: string; dueOn: string }
  artwork: { id: number; publicId: string | null; title: string; year: number | null; artist: string; technique: string | null; dimensions: string; cover: string | null; sheet: string }
  provenanceLine: string
  comparables: (Omit<Comparable, 'soldOn' | 'priceCents'> & { soldOn: string; priceCents: string; sourceLabel: string })[]
  estimate: { minCents: string; suggestedCents: string; maxCents: string; count: number } | null
  issued: { code: string; minCents: string; suggestedCents: string; maxCents: string; issuedAt: string } | null
}

export async function appraisalDossier(requestId: number): Promise<Dossier | null> {
  return totalScope('appraisal:dossier', async () => {
    const r = await prisma.appraisalRequest.findUnique({ where: { id: requestId }, include: { artwork: { include: { artist: true, media: { where: { kind: 'FRONT_COLOR_CARD' }, take: 1 }, certificate: { include: { _count: { select: { events: true } } } } } }, appraisal: true } })
    if (!r) return null
    const a = r.artwork
    const marker = await prisma.physicalMarker.findFirst({ where: { artworkId: a.id, status: 'LINKED' } })
    const comps = await comparablesOf(a.artistId, a.id)
    const e = estimateFromComparables(comps.map((c) => c.priceCents))
    const events = a.certificate?._count.events ?? 0
    const condition = a.conditionGrade ? CONDITION_GRADE_LABELS[a.conditionGrade as keyof typeof CONDITION_GRADE_LABELS].toLowerCase() : 'não informado'
    return {
      request: { id: r.id, status: r.status, purpose: r.purpose, purposeLabel: PURPOSE_LABELS[r.purpose as AppraisalPurpose] ?? r.purpose, who: r.requesterLabel, dueOn: r.dueOn.toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' }) },
      artwork: { id: a.id, publicId: a.publicId, title: a.title, year: a.year, artist: a.artist.name, technique: a.technique, dimensions: formatDimensions(a), cover: a.media[0]?.publicUrl ?? null, sheet: [a.technique, formatDimensions(a), a.year ? String(a.year) : null].filter(Boolean).join(' · ') },
      provenanceLine: `Proveniência: ${events} evento${events === 1 ? '' : 's'} · condition report ${condition} · etiqueta ${marker ? 'íntegra' : 'não vinculada'}`,
      comparables: comps.map((c) => ({ ...c, priceCents: c.priceCents.toString(), soldOn: c.soldOn.toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' }), sourceLabel: SOURCE_LABELS[c.source] })),
      estimate: e ? { minCents: e.minCents.toString(), suggestedCents: e.suggestedCents.toString(), maxCents: e.maxCents.toString(), count: e.count } : null,
      issued: r.appraisal && r.appraisal.status === 'ISSUED' ? { code: r.appraisal.verificationCode, minCents: r.appraisal.minCents.toString(), suggestedCents: r.appraisal.suggestedCents.toString(), maxCents: r.appraisal.maxCents.toString(), issuedAt: r.appraisal.issuedAt!.toISOString() } : null,
    }
  })
}

/** "Assinar e emitir laudo": one ISSUED per request; the content hash is signed by the platform key on behalf of the appraiser. */
export async function issueAppraisal(appraiser: { userId: number; name: string }, requestId: number, i: { minCents: bigint; suggestedCents: bigint; maxCents: bigint; methodology: string; comparableIds?: number[] }) {
  if (!flagOn('FLAG_APPRAISAL')) throw new ArtworkError('OFF', 'Laudos não estão ligados.', 404)
  const bad = validRange(i)
  if (bad) throw new ArtworkError('BAD_RANGE', bad, 400)
  const methodology = i.methodology.trim()
  if (methodology.length < 20) throw new ArtworkError('BAD_METHOD', 'Descreva a metodologia (mínimo 20 caracteres).', 400)
  return totalScope('appraisal:issue', async () => {
    const r = await prisma.appraisalRequest.findUnique({ where: { id: requestId }, include: { artwork: { include: { artist: true } }, appraisal: true } })
    if (!r) throw new ArtworkError('NOT_FOUND', 'Pedido não encontrado.', 404)
    if (r.status === 'ISSUED' || r.appraisal) throw new ArtworkError('ALREADY_ISSUED', 'Este laudo já foi emitido.', 409)
    if (r.status === 'CANCELLED') throw new ArtworkError('CANCELLED', 'Pedido cancelado.', 409)
    const all = await comparablesOf(r.artwork.artistId, r.artworkId)
    const chosen = i.comparableIds?.length ? all.filter((c) => c.id !== null && i.comparableIds!.includes(c.id)) : all
    const now = new Date()
    const code = await uniqueCode(now.getUTCFullYear())
    const content: AppraisalContent = {
      code, artwork: { publicId: r.artwork.publicId, title: r.artwork.title, year: r.artwork.year, artist: r.artwork.artist.name, technique: r.artwork.technique, dimensions: formatDimensions(r.artwork) },
      purpose: r.purpose, range: { minCents: i.minCents.toString(), suggestedCents: i.suggestedCents.toString(), maxCents: i.maxCents.toString() },
      comparables: chosen.map((c) => ({ label: c.label, dimensions: c.dimensions, priceCents: c.priceCents.toString(), soldOn: c.soldOn.toISOString(), source: c.source })),
      methodology, appraiser: { userId: appraiser.userId, name: appraiser.name }, issuedAt: now.toISOString(),
    }
    const contentHash = appraisalHash(content)
    const jws = signJws({ typ: 'appraisal', code, contentHash, signedBy: appraiser.userId, at: now.toISOString() })
    const verifyUrl = `${publicBaseUrl()}/verify/${code}`
    const pdf = await renderAppraisalPdf({ code, title: r.artwork.title, year: r.artwork.year, artist: r.artwork.artist.name, technique: r.artwork.technique, dimensions: formatDimensions(r.artwork), purpose: PURPOSE_LABELS[r.purpose as AppraisalPurpose] ?? r.purpose, minCents: i.minCents, suggestedCents: i.suggestedCents, maxCents: i.maxCents, comparables: chosen, methodology, appraiserName: appraiser.name, issuedAt: now, contentHash, verifyUrl })
    const pdfRef = await savePrivateFile({ buffer: Buffer.from(pdf), contentType: 'application/pdf', prefix: `appraisals/${r.id}` })
    const pdfHash = sha256OfBytes(pdf)
    const appraisal = await prisma.$transaction(async (tx) => {
      const g = await tx.appraisalRequest.updateMany({ where: { id: r.id, status: { in: ['QUEUED', 'IN_PROGRESS'] } }, data: { status: 'ISSUED', assignedAppraiserId: appraiser.userId } })
      if (g.count === 0) throw new ArtworkError('ALREADY_ISSUED', 'Este laudo acabou de ser emitido.', 409)
      await tx.appraisal.updateMany({ where: { artworkId: r.artworkId, status: 'ISSUED' }, data: { status: 'SUPERSEDED' } })
      const previous = await tx.appraisal.count({ where: { artworkId: r.artworkId } })
      return tx.appraisal.create({ data: { requestId: r.id, artworkId: r.artworkId, appraiserUserId: appraiser.userId, version: previous + 1, minCents: i.minCents, suggestedCents: i.suggestedCents, maxCents: i.maxCents, methodology, comparablesJson: JSON.stringify(content.comparables), contentHash, signatureJson: JSON.stringify({ appraiserJws: jws }), verificationCode: code, pdfRef, pdfHash, signedAt: now, issuedAt: now, status: 'ISSUED' } })
    })
    const requester = await prisma.user.findUnique({ where: { id: r.requestedByUserId }, select: { email: true } })
    await notify({ userId: r.requestedByUserId, email: requester?.email, kind: 'appraisal.issued', title: `Laudo emitido · ${r.artwork.title}`, body: `Código ${code} · verifique em ${verifyUrl}`, href: '/wallet', emailSubject: 'Seu laudo de opinião de valor foi emitido' })
    void audit.event({ entity: 'appraisal', entityId: appraisal.id, action: 'issue', userId: appraiser.userId, userName: appraiser.name, after: { code, contentHash, pdfHash } })
    return { id: appraisal.id, code, contentHash, pdfHash }
  })
}

async function uniqueCode(year: number): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = appraisalCode(year, (n) => [...randomBytes(n)])
    if (!(await prisma.appraisal.findUnique({ where: { verificationCode: code } }))) return code
  }
  throw new ArtworkError('CODE', 'Não foi possível gerar o código do laudo.', 500)
}

/** Public verification by HA-L code: what confirms the paper, never the requester nor the comparables' owners. */
export interface PublicAppraisal { code: string; status: string; artwork: { title: string; year: number | null; artist: string; technique: string | null; dimensions: string; publicId: string | null }; purpose: string; minCents: string; suggestedCents: string; maxCents: string; appraiser: string; issuedAt: string; contentHash: string; pdfHash: string | null }

export async function publicAppraisal(code: string): Promise<PublicAppraisal | null> {
  return totalScope('appraisal:public', async () => {
    const a = await prisma.appraisal.findUnique({ where: { verificationCode: code }, include: { request: { include: { artwork: { include: { artist: true } } } } } })
    if (!a || !a.issuedAt) return null
    const u = await prisma.user.findUnique({ where: { id: a.appraiserUserId }, select: { name: true } })
    const w = a.request.artwork
    return { code: a.verificationCode, status: a.status, artwork: { title: w.title, year: w.year, artist: w.artist.name, technique: w.technique, dimensions: formatDimensions(w), publicId: w.publicId }, purpose: PURPOSE_LABELS[a.request.purpose as AppraisalPurpose] ?? a.request.purpose, minCents: a.minCents.toString(), suggestedCents: a.suggestedCents.toString(), maxCents: a.maxCents.toString(), appraiser: u?.name ?? 'Avaliador credenciado', issuedAt: a.issuedAt.toISOString(), contentHash: a.contentHash, pdfHash: a.pdfHash }
  })
}

/** The requester (or the holder) downloads the PDF by the private-files door. */
export async function appraisalPdfFor(userId: number, scope: Scope | null, appraisalId: number): Promise<{ pdfRef: string; name: string } | null> {
  const a = await prisma.appraisal.findUnique({ where: { id: appraisalId }, include: { request: { include: { artwork: { select: { memberId: true, tenantId: true } } } } } })
  if (!a || !a.pdfRef) return null
  const ok = a.request.requestedByUserId === userId || a.appraiserUserId === userId || (scope ? canView(scope, a.request.artwork) : false)
  return ok ? { pdfRef: a.pdfRef, name: `laudo-${a.verificationCode}.pdf` } : null
}
