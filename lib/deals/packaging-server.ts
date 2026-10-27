// "Registrar embalagem e condition report" (audit galeria §4): the seller records the condition of the
// packed work (a note and up to six photos) before the carrier picks it up. The photos stay in the
// private vault; both sides of the deal see them through /api/deals/[id]/packaging/photos/[photoId].
import 'server-only'
import sharp from 'sharp'
import { prisma } from '@/lib/prisma'
import { canView, type Scope } from '@/lib/scope/core'
import { ArtworkError } from '@/lib/artworks/server'
import { audit } from '@/lib/audit'
import { notify } from '@/lib/notifications/server'
import { contentTypeOf } from '@/lib/storage/content-type'
import { deleteVaultFile, savePrivateFile } from '@/lib/storage/private-vault'
import { CONTENT_IMAGE_MAX_SIDE, contentImageVerdict } from '@/lib/public-content/editor-core'
import type { DealPhase } from './domain'
import { canRecordPackaging, conditionReportOf, PACKAGING_MAX_PHOTOS, packagingPhotoUrl } from './packaging-core'

/** a 10 MB PNG can decode to hundreds of MB: anything above 40 MP is refused before decoding */
const PHOTO_MAX_PIXELS = 40_000_000

/** one writer per deal's packaging at a time: the six-photo cap and the "last photo stays" rule hold under concurrent requests */
const lockKey = (dealId: number) => `deal-packaging:${dealId}`

/** a vault file whose row never landed (or was removed) is a client's photo: best-effort cleanup, never fatal */
function dropFile(ref: string): void {
  deleteVaultFile(ref).catch((e: unknown) => console.error('[packaging] arquivo do cofre não apagado:', (e as Error)?.name ?? 'erro'))
}

async function sellerPackingDeal(scope: Scope, dealId: number) {
  const d = await prisma.deal.findUnique({ where: { id: dealId }, select: { id: true, phase: true, exceptionStatus: true, memberId: true, tenantId: true, buyerUserId: true, code: true, packedAt: true } })
  if (!d || !canView(scope, d)) throw new ArtworkError('NOT_FOUND', 'Negócio não encontrado.', 404)
  if (!canRecordPackaging(d.phase as DealPhase, d.exceptionStatus)) throw new ArtworkError('WRONG_PHASE', 'A embalagem é registrada entre o pagamento em garantia e o envio.', 409)
  return d
}

export async function addPackagingPhoto(scope: Scope, dealId: number, bytes: Buffer, actorUserId: number): Promise<{ id: number; url: string }> {
  await sellerPackingDeal(scope, dealId)
  if ((await prisma.dealPackagingPhoto.count({ where: { dealId } })) >= PACKAGING_MAX_PHOTOS) throw new ArtworkError('TOO_MANY_PHOTOS', `Até ${PACKAGING_MAX_PHOTOS} fotos da embalagem.`, 409)
  const v = contentImageVerdict(contentTypeOf(bytes.subarray(0, 32), null), bytes.length)
  if (!v.ok) throw new ArtworkError('INVALID_FILE', v.error, v.status)
  let out: Buffer
  try {
    out = await sharp(bytes, { failOn: 'error', limitInputPixels: PHOTO_MAX_PIXELS }).rotate()
      .resize({ width: CONTENT_IMAGE_MAX_SIDE, height: CONTENT_IMAGE_MAX_SIDE, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' }).jpeg({ quality: 85 }).toBuffer()
  } catch { throw new ArtworkError('INVALID_FILE', 'Imagem ilegível.', 415) }
  const fileRef = await savePrivateFile({ buffer: out, contentType: 'image/jpeg', prefix: `deals/${dealId}/packaging` })
  let row: { id: number }
  try {
    // the phase and the cap are checked again under the lock, where the row is written
    row = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey(dealId)}))`
      const d = await tx.deal.findUnique({ where: { id: dealId }, select: { phase: true, exceptionStatus: true } })
      if (!d || !canRecordPackaging(d.phase as DealPhase, d.exceptionStatus)) throw new ArtworkError('WRONG_PHASE', 'A embalagem é registrada entre o pagamento em garantia e o envio.', 409)
      if ((await tx.dealPackagingPhoto.count({ where: { dealId } })) >= PACKAGING_MAX_PHOTOS) throw new ArtworkError('TOO_MANY_PHOTOS', `Até ${PACKAGING_MAX_PHOTOS} fotos da embalagem.`, 409)
      return tx.dealPackagingPhoto.create({ data: { dealId, fileRef }, select: { id: true } })
    })
  } catch (e) { dropFile(fileRef); throw e }
  void audit.event({ entity: 'deal', entityId: dealId, action: 'packaging_photo_added', userId: actorUserId, after: { photoId: row.id } })
  return { id: row.id, url: packagingPhotoUrl(dealId, row.id) }
}

export async function removePackagingPhoto(scope: Scope, dealId: number, photoId: number, actorUserId: number): Promise<void> {
  await sellerPackingDeal(scope, dealId)
  const fileRef = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey(dealId)}))`
    const d = await tx.deal.findUnique({ where: { id: dealId }, select: { packedAt: true } })
    const photo = await tx.dealPackagingPhoto.findFirst({ where: { id: photoId, dealId }, select: { fileRef: true } })
    if (!photo) throw new ArtworkError('NOT_FOUND', 'Foto não encontrada.', 404)
    // a recorded packaging keeps at least one photo (the buyer was told there are photos)
    if (d?.packedAt && (await tx.dealPackagingPhoto.count({ where: { dealId } })) <= 1) throw new ArtworkError('LAST_PHOTO', 'A embalagem registrada mantém ao menos uma foto.', 409)
    await tx.dealPackagingPhoto.delete({ where: { id: photoId } })
    return photo.fileRef
  })
  dropFile(fileRef)
  void audit.event({ entity: 'deal', entityId: dealId, action: 'packaging_photo_removed', userId: actorUserId, after: { photoId } })
}

/** "Embalagem registrada": the condition note (with at least one photo), dated; the buyer is told. */
export async function recordPackaging(scope: Scope, dealId: number, raw: unknown, actorUserId: number): Promise<void> {
  const d = await sellerPackingDeal(scope, dealId)
  const report = conditionReportOf(raw)
  if (!report.ok) throw new ArtworkError('INVALID_REPORT', report.error, 400)
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey(dealId)}))`
    if ((await tx.dealPackagingPhoto.count({ where: { dealId } })) === 0) throw new ArtworkError('NO_PHOTOS', 'Adicione ao menos uma foto da obra embalada.', 400)
    await tx.deal.update({ where: { id: dealId }, data: { conditionReport: report.text, packedAt: d.packedAt ?? new Date() } })
  })
  void audit.event({ entity: 'deal', entityId: dealId, action: d.packedAt ? 'packaging_updated' : 'packaging_recorded', userId: actorUserId, after: { length: report.text.length } })
  if (!d.packedAt) {
    const buyer = await prisma.user.findUnique({ where: { id: d.buyerUserId }, select: { email: true } })
    await notify({ userId: d.buyerUserId, email: buyer?.email, kind: 'deal.packed', title: `Obra embalada · ${d.code}`, body: 'O vendedor registrou a embalagem e o estado da obra. Veja as fotos em Compras.', href: '/purchases', emailSubject: 'Sua obra foi embalada' })
  }
}

/** The vault ref of a packaging photo, for either side of the deal (the route decided the side). */
export async function packagingPhotoRef(dealId: number, photoId: number): Promise<string | null> {
  const p = await prisma.dealPackagingPhoto.findFirst({ where: { id: photoId, dealId }, select: { fileRef: true } })
  return p?.fileRef ?? null
}
