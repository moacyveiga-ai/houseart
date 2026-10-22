// Assisted reading of the artwork photos (handoff: "Preencher com as fotos") — PURE.
// The model answers a strict JSON; this module builds the prompt, parses the
// answer defensively and decides which EMPTY fields the suggestions may fill.
// Nothing here calls a model.

export interface ReadingSuggestions {
  artistName?: string | null
  title?: string | null
  year?: number | null
  technique?: string | null
  materials?: string | null
  edition?: string | null
  signatureLocation?: string | null
  /** what the model read on the signature/back photos, for the toast ("Assinatura reconhecida: J. Teixeira, 2022") */
  signatureText?: string | null
  /** free notes the model wants the person to check */
  notes?: string | null
}

export const READING_FIELDS = ['artistName', 'title', 'year', 'technique', 'materials', 'edition', 'signatureLocation'] as const
export type ReadingField = (typeof READING_FIELDS)[number]

export const READING_MAX_PER_ARTWORK_PER_DAY = 5
export const READING_PHOTO_KINDS = ['FRONT_COLOR_CARD', 'SIGNATURE', 'BACK'] as const

export const READING_SYSTEM_PROMPT = `Você lê fotografias de uma obra de arte (frente, assinatura, verso) para pré-preencher a ficha técnica de uma plataforma de certificação. Responda SOMENTE com um JSON de uma linha com as chaves: artistName, title, year, technique, materials, edition, signatureLocation, signatureText, notes. Use null quando não tiver evidência clara na imagem. Nunca invente nome de artista: só informe artistName se estiver legível na assinatura, numa etiqueta ou no verso. year é um inteiro de 4 dígitos. technique é o meio (ex.: "Óleo sobre tela", "Acrílica sobre papel", "Fotografia"). signatureLocation descreve onde a assinatura está (ex.: "Frente · inferior direita"). signatureText é o texto lido da assinatura/data. notes em pt-BR, curto, só o que a pessoa precisa conferir.`

export function userPromptFor(kinds: readonly string[]): string {
  const names: Record<string, string> = { FRONT_COLOR_CARD: 'frente com cartão de cor', SIGNATURE: 'assinatura', BACK: 'verso' }
  return `Fotos enviadas, nesta ordem: ${kinds.map((k) => names[k] ?? k).join(', ')}. Leia o que for legível e devolva o JSON.`
}

const str = (v: unknown, max = 120): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

/** Parses the model text: tolerates code fences and prose around the JSON; unknown keys dropped; types coerced. */
export function parseReading(text: string): ReadingSuggestions {
  const m = /\{[\s\S]*\}/.exec(text)
  if (!m) return {}
  let raw: Record<string, unknown>
  try { raw = JSON.parse(m[0]) as Record<string, unknown> } catch { return {} }
  const yearNum = typeof raw.year === 'number' ? raw.year : typeof raw.year === 'string' ? Number(raw.year.replace(/\D/g, '').slice(0, 4)) : NaN
  const year = Number.isInteger(yearNum) && yearNum >= 1400 && yearNum <= new Date().getFullYear() ? yearNum : null
  return {
    artistName: str(raw.artistName), title: str(raw.title), year,
    technique: str(raw.technique), materials: str(raw.materials, 200), edition: str(raw.edition, 60), signatureLocation: str(raw.signatureLocation, 80),
    signatureText: str(raw.signatureText, 120), notes: str(raw.notes, 300),
  }
}

export interface SheetLike { title: string; year: number | null; technique: string | null; materials: string | null; edition: string | null; signatureLocation: string | null }

/** Only EMPTY fields receive a suggestion: what the person typed is never overwritten. */
export function applyReading(sheet: SheetLike, s: ReadingSuggestions): { patch: Partial<SheetLike>; filled: ReadingField[] } {
  const patch: Partial<SheetLike> = {}
  const filled: ReadingField[] = []
  const empty = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && !v.trim())
  if (empty(sheet.title) && s.title) { patch.title = s.title; filled.push('title') }
  if (empty(sheet.year) && s.year) { patch.year = s.year; filled.push('year') }
  if (empty(sheet.technique) && s.technique) { patch.technique = s.technique; filled.push('technique') }
  if (empty(sheet.materials) && s.materials) { patch.materials = s.materials; filled.push('materials') }
  if (empty(sheet.edition) && s.edition) { patch.edition = s.edition; filled.push('edition') }
  if (empty(sheet.signatureLocation) && s.signatureLocation) { patch.signatureLocation = s.signatureLocation; filled.push('signatureLocation') }
  return { patch, filled }
}

export function readingToast(s: ReadingSuggestions, filled: readonly string[]): string {
  if (s.signatureText) return `Assinatura reconhecida: ${s.signatureText}`
  if (filled.length) return 'Sugestões aplicadas · confira os campos'
  return 'Nada legível nas fotos · preencha à mão'
}
