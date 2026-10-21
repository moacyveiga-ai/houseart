// Media intake — PURE rules: the slot, the size, the bytes.
import { contentTypeOf } from '@/lib/storage/content-type'
import { MEDIA_KINDS, type MediaKind } from './domain'

/** Master file ceiling (the original goes to the vault; the derivative is ≤ 2048 px). */
export const MAX_MASTER_BYTES = 50 * 1024 * 1024
export const DERIVATIVE_MAX_SIDE = 2048
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export type IntakeVerdict = { ok: true; contentType: string } | { ok: false; error: string }

export function validateMediaBytes(bytes: Uint8Array, declared: string | null | undefined, size: number): IntakeVerdict {
  if (size > MAX_MASTER_BYTES) return { ok: false, error: 'Arquivo acima de 50 MB.' }
  const type = contentTypeOf(bytes, declared)
  if (!(ACCEPTED_TYPES as readonly string[]).includes(type)) return { ok: false, error: 'Envie uma imagem JPEG, PNG ou WebP.' }
  return { ok: true, contentType: type }
}

export function isMediaKind(k: string): k is MediaKind {
  return (MEDIA_KINDS as readonly string[]).includes(k)
}

/** Blur heuristic: variance of the Laplacian over a small grayscale thumbnail. */
export function qualityOf(gray: Uint8Array | number[], width: number, height: number): 'GOOD' | 'BLURRY' {
  let sum = 0, sumSq = 0, n = 0
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - width] - gray[i + width]
      sum += lap; sumSq += lap * lap; n++
    }
  }
  if (n === 0) return 'BLURRY'
  const mean = sum / n
  const variance = sumSq / n - mean * mean
  return variance >= 40 ? 'GOOD' : 'BLURRY'
}
