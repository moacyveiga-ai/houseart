// "Preencher com as fotos" (handoff "HouseArt App Colecionador" › Cadastrar
// obra, passo 3: cbIA / cbIATit) — PURE. The server (POST /api/artworks/<id>/
// read-photos) decides what gets filled; this module decides what the panel
// SAYS and which sheet fields the screen highlights afterwards.

/** The sheet fields the reading may fill and the wizard shows (artistName is not a wizard field). */
export const HIGHLIGHTABLE_FIELDS = ['title', 'year', 'technique', 'materials', 'edition', 'signatureLocation'] as const
export type HighlightableField = (typeof HIGHLIGHTABLE_FIELDS)[number]

/** How long the filled fields stay highlighted (ms). */
export const HIGHLIGHT_MS = 6000

export type ReadingPhase = 'idle' | 'reading' | 'applied' | 'off' | 'error'

/** What the route answers (2xx) — only the keys the panel reads. */
export interface ReadingResponse {
  mode?: 'claude' | 'mock'
  applied?: Record<string, unknown>
  filled?: string[]
  toast?: string
  suggestions?: { notes?: string | null; signatureText?: string | null } | null
}

export interface ReadingPanelState {
  phase: ReadingPhase
  /** the title of the block (cbIATit in the prototype) */
  title: string
  /** the fixed subtitle of the prototype */
  subtitle: string
  /** the API's own message when nothing was applied (mock, 422, 429, failure) — never invented here */
  message: string | null
  /** `suggestions.notes`, shown under the block when the model asked the person to check something */
  note: string | null
  busy: boolean
}

export const READING_SUBTITLE = 'Lemos assinatura, técnica e medidas aproximadas. Você confere tudo.'
const TITLE_IDLE = 'Preencher com as fotos'
const TITLE_READING = 'Lendo as fotos…'
const TITLE_APPLIED = 'Sugestões aplicadas · confira os campos'

export function readingPanelState(input: { phase: ReadingPhase; message?: string | null; note?: string | null }): ReadingPanelState {
  const base = { subtitle: READING_SUBTITLE, message: null, note: null, busy: false }
  switch (input.phase) {
    case 'reading': return { ...base, phase: 'reading', title: TITLE_READING, busy: true }
    case 'applied': return { ...base, phase: 'applied', title: TITLE_APPLIED, note: input.note ?? null }
    case 'off': return { ...base, phase: 'off', title: TITLE_IDLE, message: input.message ?? null, note: input.note ?? null }
    case 'error': return { ...base, phase: 'error', title: TITLE_IDLE, message: input.message ?? null }
    default: return { ...base, phase: 'idle', title: TITLE_IDLE }
  }
}

/** The fields to highlight: only those the route says it filled AND the wizard shows. */
export function fieldsToHighlight(filled: readonly string[] | undefined): HighlightableField[] {
  return (filled ?? []).filter((f): f is HighlightableField => (HIGHLIGHTABLE_FIELDS as readonly string[]).includes(f))
}

/** `applied` → the patch the wizard state accepts (typed, unknown keys dropped). */
export function patchFromReading(applied: Record<string, unknown> | undefined): Partial<Record<HighlightableField, string | number | null>> {
  const out: Partial<Record<HighlightableField, string | number | null>> = {}
  if (!applied) return out
  for (const key of HIGHLIGHTABLE_FIELDS) {
    if (!(key in applied)) continue
    const v = applied[key]
    if (key === 'year') { if (typeof v === 'number' && Number.isFinite(v)) out.year = Math.round(v) }
    else if (typeof v === 'string') out[key] = v
    else if (v === null) out[key] = null
  }
  return out
}

/** Decides the panel state from a 2xx answer of the route. */
export function stateFromResponse(r: ReadingResponse): { state: ReadingPanelState; highlight: HighlightableField[]; toast: string | null; patch: ReturnType<typeof patchFromReading> } {
  const highlight = fieldsToHighlight(r.filled)
  const note = r.suggestions?.notes?.trim() || null
  if (r.mode === 'mock') return { state: readingPanelState({ phase: 'off', message: r.toast ?? null }), highlight: [], toast: null, patch: {} }
  if (highlight.length === 0) return { state: readingPanelState({ phase: 'off', message: r.toast ?? null, note }), highlight: [], toast: null, patch: {} }
  return { state: readingPanelState({ phase: 'applied', note }), highlight, toast: r.toast ?? null, patch: patchFromReading(r.applied) }
}

/** Decides the panel state from a non-2xx answer (422 without front photo, 429 daily limit, 409 locked…). */
export function stateFromError(status: number, body: { error?: unknown } | null): ReadingPanelState {
  const msg = body && typeof body.error === 'string' && body.error.trim() ? body.error : status === 0 ? 'Sem conexão. Tente de novo.' : 'Não foi possível ler as fotos agora.'
  return readingPanelState({ phase: 'error', message: msg })
}
