// Perfil › Dados pessoais (audit colecionador §16): "Sobre você" and the profile photo. Kept out of
// lib/accounts so the contact filter (lib/messaging) and the image check (lib/public-content) do
// not close an import cycle through lib/auth.
import sharp from 'sharp'
import { prisma } from '@/lib/prisma'
import { contentTypeOf } from '@/lib/storage/content-type'
import { deletePublicFile, savePublicFile } from '@/lib/storage/blob'
import { contentImageVerdict } from '@/lib/public-content/editor-core'
import { AVATAR_SIDE, cleanAbout } from './core'

/** Saves "Sobre você" in the preferences JSON (empty clears it). */
export async function setAbout(userId: number, raw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const a = cleanAbout(raw)
  if (!a.ok) return a
  const u = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { preferencesJson: true } })
  let prefs: Record<string, unknown> = {}
  try { prefs = JSON.parse(u.preferencesJson) as Record<string, unknown> } catch { prefs = {} }
  await prisma.user.update({ where: { id: userId }, data: { preferencesJson: JSON.stringify({ ...prefs, about: a.value }) } })
  return { ok: true }
}

export class AvatarError extends Error {
  constructor(public status: number, message: string) { super(message) }
}

/**
 * The profile photo: the bytes are checked (JPEG, PNG or WebP, 10 MB), re-encoded as a 512 px square
 * JPEG without EXIF/GPS (refused above 40 MP before decoding) and kept as a public derivative —
 * it is the face beside the person's name. The previous file is deleted after the new one is saved.
 */
export async function setAvatar(userId: number, bytes: Buffer): Promise<string> {
  const v = contentImageVerdict(contentTypeOf(bytes.subarray(0, 32), null), bytes.length)
  if (!v.ok) throw new AvatarError(v.status, v.error)
  let out: Buffer
  try {
    out = await sharp(bytes, { failOn: 'error', limitInputPixels: 40_000_000 }).rotate()
      .resize({ width: AVATAR_SIDE, height: AVATAR_SIDE, fit: 'cover', position: 'attention' })
      .flatten({ background: '#ffffff' }).jpeg({ quality: 85 }).toBuffer()
  } catch { throw new AvatarError(415, 'Imagem ilegível.') }
  const url = await savePublicFile({ buffer: out, contentType: 'image/jpeg', prefix: 'content/avatars' })
  const before = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { avatarUrl: true } })
  await prisma.user.update({ where: { id: userId }, data: { avatarUrl: url } })
  if (before.avatarUrl && before.avatarUrl !== url) await deletePublicFile(before.avatarUrl)
  return url
}

/** "Remover": the column is cleared and the file deleted (it is a photo of the person). */
export async function clearAvatar(userId: number): Promise<void> {
  const before = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { avatarUrl: true } })
  await prisma.user.update({ where: { id: userId }, data: { avatarUrl: null } })
  if (before.avatarUrl) await deletePublicFile(before.avatarUrl)
}
