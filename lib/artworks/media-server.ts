// Media upload: the ORIGINAL goes whole to the private vault (fingerprint),
// the public derivative (≤ 2048 px, JPEG) goes to the public store, pHash and
// a blur verdict are computed on the server. The front photo triggers the
// duplicate check.
import 'server-only'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { prisma } from '@/lib/prisma'
import { canView, type Scope } from '@/lib/scope/core'
import { savePrivateFile, deleteVaultFile } from '@/lib/storage/private-vault'
import { savePublicFile } from '@/lib/storage/blob'
import { dHash } from '@/lib/duplicate-detection/phash-core'
import { checkDuplicates } from '@/lib/duplicate-detection/server'
import { flagOn } from '@/lib/flags'
import { ArtworkError } from './server'
import { DERIVATIVE_MAX_SIDE, qualityOf, validateMediaBytes, type IntakeVerdict } from './media-core'
import type { MediaKind } from './domain'

export async function uploadMedia(scope: Scope, artworkId: number, kind: MediaKind, file: { bytes: Buffer; declaredType: string | null }) {
  const a = await prisma.artwork.findUnique({ where: { id: artworkId }, select: { memberId: true, tenantId: true, status: true } })
  if (!a || !canView(scope, a)) throw new ArtworkError('NOT_FOUND', 'Obra não encontrada.', 404)
  if (!['DRAFT', 'IN_CERTIFICATION'].includes(a.status)) throw new ArtworkError('LOCKED', 'A mídia da obra está congelada.', 409)
  const verdict: IntakeVerdict = validateMediaBytes(file.bytes.subarray(0, 32), file.declaredType, file.bytes.length)
  if (!verdict.ok) throw new ArtworkError('INVALID_FILE', verdict.error, 415)

  const image = sharp(file.bytes, { failOn: 'none' }).rotate()
  const meta = await image.metadata()
  if (!meta.width || !meta.height) throw new ArtworkError('INVALID_FILE', 'Imagem ilegível.', 415)
  const derivative = await image.clone().resize({ width: DERIVATIVE_MAX_SIDE, height: DERIVATIVE_MAX_SIDE, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer()
  const small = await image.clone().grayscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer()
  const pHash = dHash(new Uint8Array(small))
  const thumb = await image.clone().grayscale().resize(64, 64, { fit: 'fill' }).raw().toBuffer()
  const quality = qualityOf(new Uint8Array(thumb), 64, 64)
  const sha256 = createHash('sha256').update(file.bytes).digest('hex')

  const masterRef = await savePrivateFile({ buffer: file.bytes, contentType: verdict.contentType, prefix: `artworks/${artworkId}` })
  const publicUrl = await savePublicFile({ buffer: derivative, contentType: 'image/jpeg', prefix: `artworks/${artworkId}` })

  const previous = await prisma.artworkMedia.findUnique({ where: { artworkId_kind: { artworkId, kind } } })
  const media = await prisma.artworkMedia.upsert({
    where: { artworkId_kind: { artworkId, kind } },
    create: { artworkId, kind, masterRef, publicUrl, sha256, pHash, width: meta.width, height: meta.height, quality, sortOrder: 0 },
    update: { masterRef, publicUrl, sha256, pHash, width: meta.width, height: meta.height, quality },
  })
  if (previous) await deleteVaultFile(previous.masterRef).catch(() => {})
  if (kind === 'FRONT_COLOR_CARD') {
    await prisma.artwork.update({ where: { id: artworkId }, data: { coverMediaId: media.id } })
  }
  const duplicates = kind === 'FRONT_COLOR_CARD' && flagOn('FLAG_DUPLICATE_DETECTION') ? await checkDuplicates(artworkId, pHash) : []
  return { media, duplicates }
}

export async function deleteMedia(scope: Scope, artworkId: number, mediaId: number) {
  const m = await prisma.artworkMedia.findUnique({ where: { id: mediaId }, include: { artwork: { select: { id: true, memberId: true, tenantId: true, status: true } } } })
  if (!m || m.artworkId !== artworkId || !canView(scope, m.artwork)) throw new ArtworkError('NOT_FOUND', 'Mídia não encontrada.', 404)
  if (!['DRAFT', 'IN_CERTIFICATION'].includes(m.artwork.status)) throw new ArtworkError('LOCKED', 'A mídia da obra está congelada.', 409)
  await prisma.artworkMedia.delete({ where: { id: mediaId } })
  await deleteVaultFile(m.masterRef).catch(() => {})
}
