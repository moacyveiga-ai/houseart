// Physical markers — I/O. Batches and shipping are staff work (total scope);
// orders and linking are the member's (scoped by the artwork's owner).
import 'server-only'
import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { catalogPriceCents, placeOrder } from '@/lib/orders/server'
import { canView, memberFilter, memberOfScope, tenantOfScope, type Scope } from '@/lib/scope/core'
import { totalScope } from '@/lib/scope/context'
import { audit } from '@/lib/audit'
import { keyedHash } from '@/lib/crypto/cipher'
import { ArtworkError } from '@/lib/artworks/server'
import { isPublicId, MARKER_KIT_MAX, MARKER_KIT_MIN, publicIdOf, UID_RE, type ReadPurpose } from './domain'
import { mockSunMessage, verifySun } from './sun-core'
import { markerMasterKey } from './tap-server'
import { recordEvent } from '@/lib/certificate-events/server'
import { openReviewItem } from '@/lib/admin-review/server'

const masterKey = markerMasterKey

// ── staff: batches ────────────────────────────────────────────────────────
export async function createBatch(opt: { code: string; quantity: number; destination: string; tenantId?: number | null; uids?: string[] }, actor: { userId: number; name: string }) {
  return totalScope('markers:createBatch', async () => {
    if (!/^\d{4}-\d{2}(-[A-Za-z0-9]+)?$/.test(opt.code)) throw new ArtworkError('BAD_CODE', 'Código do lote: AAAA-MM.', 400)
    if (!Number.isInteger(opt.quantity) || opt.quantity < 1 || opt.quantity > 100_000) throw new ArtworkError('BAD_QUANTITY', 'Quantidade inválida.', 400)
    const uids = (opt.uids && opt.uids.length ? opt.uids.map((u) => u.toLowerCase()) : Array.from({ length: opt.quantity }, () => '04' + randomBytes(6).toString('hex')))
    if (uids.some((u) => !UID_RE.test(u))) throw new ArtworkError('BAD_UID', 'UID inválido no CSV (7 bytes hex).', 400)
    if (uids.length !== opt.quantity) throw new ArtworkError('BAD_QUANTITY', 'A quantidade não bate com os UIDs.', 400)
    const batch = await prisma.$transaction(async (tx) => {
      const b = await tx.markerBatch.create({ data: { code: opt.code, quantity: opt.quantity, destination: opt.destination, tenantId: opt.tenantId ?? null } })
      await tx.physicalMarker.createMany({ data: uids.map((uid) => ({ batchId: b.id, uid, keyRef: `div:${b.code}:${uid.slice(0, 4)}` })), skipDuplicates: true })
      return b
    })
    void audit.create({ entity: 'marker_batch', entityId: batch.id, after: { code: batch.code, quantity: batch.quantity }, userId: actor.userId, userName: actor.name })
    return batch
  })
}

export async function adminMarkersView(query: string | null) {
  return totalScope('markers:admin', async () => {
    const [stock, linked, shipped, removedToday, batches] = await Promise.all([
      prisma.physicalMarker.count({ where: { status: 'STOCK' } }),
      prisma.physicalMarker.count({ where: { status: 'LINKED' } }),
      prisma.physicalMarker.count({ where: { status: 'SHIPPED' } }),
      prisma.markerRead.count({ where: { tamperFlag: true, createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } } }),
      prisma.markerBatch.findMany({ orderBy: { code: 'desc' }, take: 50, include: { _count: { select: { markers: { where: { status: 'LINKED' } } } } } }),
    ])
    const q = query?.trim()
    const found = q
      ? UID_RE.test(q)
        ? await prisma.physicalMarker.findUnique({ where: { uid: q.toLowerCase() }, include: { batch: true } })
        : isPublicId(q.toUpperCase())
          ? await prisma.physicalMarker.findFirst({ where: { artworkId: (await prisma.artwork.findUnique({ where: { publicId: q.toUpperCase() }, select: { id: true } }))?.id ?? -1 }, include: { batch: true } })
          : null
      : null
    return {
      kpis: { stock, linked, removedToday, newBatches: batches.filter((b) => b.status === 'NEW').length, linkedShare: linked + shipped ? Math.round((linked / (linked + shipped)) * 1000) / 10 : null },
      batches: batches.map((b) => ({ id: b.id, code: b.code, quantity: b.quantity, destination: b.destination, linked: b._count.markers, status: b.status })),
      found: found ? { uid: found.uid, status: found.status, artworkId: found.artworkId, batch: found.batch.code, readCounter: found.readCounter } : null,
    }
  })
}

/** Staff marks an order as shipped: reserves N STOCK markers of the batch to the order. */
export async function shipOrder(orderId: number, batchId: number, actor: { userId: number; name: string }) {
  return totalScope('markers:shipOrder', async () => {
    const order = await prisma.markerOrder.findUnique({ where: { id: orderId } })
    if (!order || order.status !== 'REQUESTED') throw new ArtworkError('NOT_FOUND', 'Pedido não encontrado ou já enviado.', 404)
    const markers = await prisma.physicalMarker.findMany({ where: { batchId, status: 'STOCK' }, take: order.quantity, select: { id: true } })
    if (markers.length < order.quantity) throw new ArtworkError('NO_STOCK', 'Estoque insuficiente no lote.', 409)
    await prisma.$transaction(async (tx) => {
      const r = await tx.physicalMarker.updateMany({ where: { id: { in: markers.map((m) => m.id) }, status: 'STOCK' }, data: { status: 'SHIPPED', orderId } })
      if (r.count !== order.quantity) throw new ArtworkError('NO_STOCK', 'Estoque mudou durante o envio.', 409)
      await tx.markerOrder.update({ where: { id: orderId }, data: { status: 'SHIPPED', shippedAt: new Date() } })
      const left = await tx.physicalMarker.count({ where: { batchId, status: 'STOCK' } })
      await tx.markerBatch.update({ where: { id: batchId }, data: { status: left === 0 ? 'EXHAUSTED' : 'IN_USE' } })
    })
    void audit.event({ entity: 'marker_order', entityId: orderId, action: 'ship', userId: actor.userId, userName: actor.name, after: { batchId } })
  })
}

export async function listOrdersForStaff() {
  return totalScope('markers:orders', async () => {
    const orders = await prisma.markerOrder.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
    const members = await prisma.member.findMany({ where: { id: { in: [...new Set(orders.map((o) => o.memberId))] } }, select: { id: true, displayName: true, tenant: { select: { name: true, kind: true } } } })
    const byId = new Map(members.map((m) => [m.id, m]))
    return orders.map((o) => {
      const m = byId.get(o.memberId)
      // who asked: the member, and the gallery when the account is a gallery
      const who = m ? (m.tenant.kind === 'GALLERY' && m.tenant.name !== m.displayName ? `${m.displayName} · ${m.tenant.name}` : m.displayName) : 'Conta removida'
      return { ...o, who }
    })
  })
}

// ── member: orders ────────────────────────────────────────────────────────
export async function requestMarkers(scope: Scope, quantity: number) {
  const memberId = memberOfScope(scope)
  const tenantId = tenantOfScope(scope)
  if (!memberId || !tenantId) throw new ArtworkError('NO_MEMBER', 'Só membros pedem etiquetas.', 403)
  if (!Number.isInteger(quantity) || quantity < MARKER_KIT_MIN || quantity > MARKER_KIT_MAX) throw new ArtworkError('BAD_QUANTITY', 'Quantidade inválida.', 400)
  // the price is the catalog's TAG_KIT (Admin › Catálogo), read ONCE: the kit row and the charge carry the same number, and a switched-off kit refuses before anything is written
  const unitPriceCents = await catalogPriceCents('TAG_KIT')
  if (unitPriceCents === null || unitPriceCents <= 0n) throw new ArtworkError('SERVICE_OFF', 'O pedido de etiquetas está indisponível no momento.', 409)
  const order = await prisma.markerOrder.create({ data: { tenantId, memberId, quantity, unitPriceCents } })
  await placeOrder({ serviceCode: 'TAG_KIT', payerKind: 'ARTIST', quantity, tenantId, memberId, amountCents: unitPriceCents * BigInt(quantity), description: `Kit de etiquetas NFC × ${quantity}` })
  void audit.create({ entity: 'marker_order', entityId: order.id, after: { quantity, memberId } })
  return order
}

/** The member marks the kit as received (the design's "Chegam pelo correio"); staff may too. */
export async function confirmDelivery(scope: Scope, orderId: number) {
  const order = await prisma.markerOrder.findUnique({ where: { id: orderId } })
  if (!order || !canView(scope, { memberId: order.memberId, tenantId: order.tenantId })) throw new ArtworkError('NOT_FOUND', 'Pedido não encontrado.', 404)
  if (order.status !== 'SHIPPED') throw new ArtworkError('NOT_SHIPPED', 'O pedido ainda não foi enviado.', 409)
  await prisma.markerOrder.updateMany({ where: { id: orderId, status: 'SHIPPED' }, data: { status: 'DELIVERED', deliveredAt: new Date() } })
}

export async function ordersOf(scope: Scope) {
  return prisma.markerOrder.findMany({ where: { ...memberFilter(scope) }, orderBy: { createdAt: 'desc' } })
}

/** Markers the member can link: SHIPPED/DELIVERED to one of their orders and still unlinked. */
export async function availableMarkers(scope: Scope): Promise<number> {
  const orders = await ordersOf(scope)
  if (orders.length === 0) return 0
  return prisma.physicalMarker.count({ where: { orderId: { in: orders.map((o) => o.id) }, status: 'SHIPPED' } })
}

// ── linking (the app's tap) ───────────────────────────────────────────────
/** Dev/CI only (MARKER_VENDOR=mock outside production): a simulated tap = a valid SUN message for the uid. */
export function simulatedSun(uid: string, env: NodeJS.ProcessEnv = process.env): { uid: string; ctr: number; cmac: string } | null {
  if ((env.MARKER_VENDOR ?? 'mock') !== 'mock' || env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production') return null
  return mockSunMessage(uid, Math.floor(Date.now() / 1000) % 0xffffff)
}

export async function linkMarker(scope: Scope, opt: { uid: string; ctr: number; cmac: string; artworkId: number }, actor: { userId: number }) {
  const artwork = await prisma.artwork.findUnique({ where: { id: opt.artworkId }, select: { id: true, memberId: true, tenantId: true, status: true, publicId: true, year: true } })
  if (!artwork || !canView(scope, artwork)) throw new ArtworkError('NOT_FOUND', 'Obra não encontrada.', 404)
  if (artwork.status !== 'IN_CERTIFICATION') throw new ArtworkError('NOT_IN_CERTIFICATION', 'A obra precisa estar em certificação.', 409)
  if (artwork.publicId) throw new ArtworkError('ALREADY_LINKED', 'A obra já tem etiqueta.', 409)
  const marker = await prisma.physicalMarker.findUnique({ where: { uid: opt.uid.toLowerCase() } })
  if (!marker) throw new ArtworkError('UNKNOWN_MARKER', 'Etiqueta desconhecida.', 404)
  if (marker.status !== 'SHIPPED') throw new ArtworkError('MARKER_UNAVAILABLE', 'Esta etiqueta não está disponível para vinculação.', 409)
  const order = marker.orderId ? await prisma.markerOrder.findUnique({ where: { id: marker.orderId } }) : null
  if (!order || !canView(scope, { memberId: order.memberId, tenantId: order.tenantId })) throw new ArtworkError('MARKER_UNAVAILABLE', 'Esta etiqueta não é do seu kit.', 409)
  const verdict = verifySun({ master: masterKey(), uid: marker.uid, counter: opt.ctr, cmac: opt.cmac, lastCounter: marker.readCounter })
  await prisma.markerRead.create({ data: { markerId: marker.id, counter: opt.ctr, cmacValid: verdict.ok, purpose: 'LINK', userId: actor.userId } })
  if (!verdict.ok) throw new ArtworkError('BAD_READ', `Leitura inválida (${verdict.reason}).`, 422)
  const publicId = publicIdOf(artwork.year && artwork.year > 1900 ? new Date().getUTCFullYear() : new Date().getUTCFullYear(), randomBytes(5))
  let certificateId: number | null = null
  await prisma.$transaction(async (tx) => {
    const r = await tx.physicalMarker.updateMany({ where: { id: marker.id, status: 'SHIPPED' }, data: { status: 'LINKED', artworkId: artwork.id, linkedAt: new Date(), linkedByUserId: actor.userId, readCounter: opt.ctr, lastReadAt: new Date() } })
    if (r.count === 0) throw new ArtworkError('MARKER_UNAVAILABLE', 'A etiqueta acabou de ser usada.', 409)
    await tx.artwork.update({ where: { id: artwork.id }, data: { publicId } })
    const c = await tx.certificate.upsert({ where: { artworkId: artwork.id }, create: { artworkId: artwork.id, publicId, stage: 3 }, update: { publicId, stage: 3 } })
    certificateId = c.id
    if (order.status === 'SHIPPED') await tx.markerOrder.update({ where: { id: order.id }, data: { status: 'DELIVERED', deliveredAt: new Date() } })
  })
  await recordEvent(artwork.id, 'CREATED', { publicId, markerUid: marker.uid }, actor.userId)
  void audit.event({ entity: 'artwork', entityId: artwork.id, action: 'marker_linked', userId: actor.userId, after: { publicId } })
  return { publicId, certificateId }
}

// ── public read (the verification page) ──────────────────────────────────
export type PublicRead = { authenticated: boolean; tamper: boolean; reason?: string }

export async function recordPublicRead(publicId: string, sun: { uid?: string; ctr?: number; cmac?: string; tt?: boolean } | null, ipHash: string | null, purpose: ReadPurpose = 'VERIFY'): Promise<PublicRead> {
  return totalScope('markers:publicRead', async () => {
    if (!sun?.uid) return { authenticated: false, tamper: false, reason: 'NO_SUN' }
    const marker = await prisma.physicalMarker.findUnique({ where: { uid: sun.uid.toLowerCase() } })
    const artwork = marker?.artworkId ? await prisma.artwork.findUnique({ where: { id: marker.artworkId }, select: { publicId: true, id: true, tenantId: true } }) : null
    if (!marker || !artwork || artwork.publicId !== publicId) return { authenticated: false, tamper: false, reason: 'MARKER_MISMATCH' }
    const verdict = verifySun({ master: masterKey(), uid: marker.uid, counter: sun.ctr ?? -1, cmac: sun.cmac ?? '', lastCounter: marker.readCounter })
    const tamper = !!sun.tt
    await prisma.markerRead.create({ data: { markerId: marker.id, counter: sun.ctr ?? 0, cmacValid: verdict.ok, tamperFlag: tamper, ipHash, purpose } })
    if (verdict.ok) await prisma.physicalMarker.update({ where: { id: marker.id }, data: { readCounter: sun.ctr ?? marker.readCounter, lastReadAt: new Date() } })
    if (tamper && marker.status === 'LINKED') {
      await prisma.physicalMarker.update({ where: { id: marker.id }, data: { status: 'REMOVED' } })
      await openReviewItem({ kind: 'MARKER_REMOVED', artworkId: artwork.id, tenantId: artwork.tenantId, reason: 'Leitura indicou violação do chip' })
    }
    return { authenticated: verdict.ok, tamper, reason: verdict.ok ? undefined : verdict.reason }
  })
}

export function ipHashOf(ip: string | null): string | null {
  return ip && ip !== 'no-ip' ? keyedHash('ip', ip) : null
}
