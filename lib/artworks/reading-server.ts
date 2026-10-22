// Assisted reading of the photos — I/O. `ARTWORK_READING_MODE=claude` with
// `ANTHROPIC_API_KEY` sends the front, signature and back derivatives to the
// model; any other mode is MOCK (no call, no suggestion — the screen says so).
// At most READING_MAX_PER_ARTWORK_PER_DAY calls per artwork; the suggestions
// never overwrite what the person typed (applyReading).
import 'server-only'
import sharp from 'sharp'
import { prisma } from '@/lib/prisma'
import { canView, type Scope } from '@/lib/scope/core'
import { consume } from '@/lib/rate-limit'
import { readVaultFile } from '@/lib/storage/private-vault'
import { audit } from '@/lib/audit'
import { ArtworkError } from './server'
import { applyReading, parseReading, READING_MAX_PER_ARTWORK_PER_DAY, READING_PHOTO_KINDS, READING_SYSTEM_PROMPT, readingToast, userPromptFor, type ReadingSuggestions } from './reading-core'

export type ReadingMode = 'claude' | 'mock'
export function readingMode(env: NodeJS.ProcessEnv = process.env): ReadingMode {
  return env.ARTWORK_READING_MODE?.trim() === 'claude' && !!env.ANTHROPIC_API_KEY ? 'claude' : 'mock'
}

const MODEL = 'claude-sonnet-5-5'
const MAX_SIDE = 1024

export interface ReadingResult { mode: ReadingMode; suggestions: ReadingSuggestions; applied: Record<string, unknown>; filled: string[]; toast: string }

/** Reads the photos and PATCHES the empty sheet fields. Returns what was filled for the screen to highlight. */
export async function readArtworkPhotos(scope: Scope, artworkId: number): Promise<ReadingResult> {
  const a = await prisma.artwork.findUnique({ where: { id: artworkId }, include: { media: { where: { kind: { in: [...READING_PHOTO_KINDS] } } } } })
  if (!a || !canView(scope, a)) throw new ArtworkError('NOT_FOUND', 'Obra não encontrada.', 404)
  if (!['DRAFT', 'IN_CERTIFICATION'].includes(a.status)) throw new ArtworkError('LOCKED', 'A ficha desta obra está congelada.', 409)
  const photos = READING_PHOTO_KINDS.map((k) => a.media.find((m) => m.kind === k)).filter((m): m is NonNullable<typeof m> => !!m)
  if (photos.length === 0) throw new ArtworkError('NO_PHOTOS', 'Envie ao menos a foto da frente para ler.', 422)
  const mode = readingMode()
  if (mode === 'mock') return { mode, suggestions: {}, applied: {}, filled: [], toast: 'Leitura automática desligada neste ambiente · preencha à mão' }
  const brake = await consume({ key: `reading:artwork:${artworkId}`, limit: READING_MAX_PER_ARTWORK_PER_DAY, windowMs: 24 * 3_600_000 })
  if (!brake.allowed) throw new ArtworkError('READING_LIMIT', 'Limite de leituras desta obra por hoje. Preencha à mão.', 429)

  const images = await Promise.all(photos.map(async (m) => {
    const master = await readVaultFile(m.masterRef)
    const jpeg = await sharp(master, { failOn: 'none' }).rotate().resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer()
    return { kind: m.kind, data: jpeg.toString('base64') }
  }))
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const msg = await client.messages.create({
    model: MODEL, max_tokens: 600, system: READING_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: [
      ...images.map((i) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: i.data } })),
      { type: 'text' as const, text: userPromptFor(images.map((i) => i.kind)) },
    ] }],
  })
  const text = msg.content.map((c) => (c.type === 'text' ? c.text : '')).join('\n')
  const suggestions = parseReading(text)
  const { patch, filled } = applyReading({ title: a.title, year: a.year, technique: a.technique, materials: a.materials, edition: a.edition, signatureLocation: a.signatureLocation }, suggestions)
  if (filled.length) await prisma.artwork.update({ where: { id: artworkId }, data: patch })
  void audit.event({ entity: 'artwork', entityId: artworkId, action: 'photo_reading', after: { filled, model: MODEL, photos: images.map((i) => i.kind) } })
  return { mode, suggestions, applied: patch, filled, toast: readingToast(suggestions, filled) }
}
