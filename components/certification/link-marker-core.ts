// "Vincular etiqueta" (handoff "HouseArt App Artista" › leitor / LT.vincular) —
// PURE. Reads the SUN URL the tag writes (`<APP_URL>/a/<publicId>?uid=&ctr=&cmac=`,
// or, before the link, a URL whose query has the three fields), and runs the
// screen's state machine: lendo → ok → (assinando) → fim, with erro on the side.

export interface SunRead { uid: string; ctr: number; cmac: string }

const UID_RE = /^[0-9a-f]{14}$/
const CMAC_RE = /^[0-9a-f]{16}$/

/** `uid`, `ctr` and `cmac` from the URL of the tag (full URL, `?query`, or `a=b&c=d`). `null` when any is missing or malformed. */
export function parseSunUrl(input: string): SunRead | null {
  const text = (input ?? '').trim()
  if (!text) return null
  let params: URLSearchParams
  try {
    const u = new URL(text)
    params = u.searchParams
  } catch {
    params = new URLSearchParams(text.startsWith('?') ? text.slice(1) : text)
  }
  const uid = (params.get('uid') ?? '').trim().toLowerCase()
  const cmac = (params.get('cmac') ?? '').trim().toLowerCase()
  const ctrRaw = (params.get('ctr') ?? '').trim()
  if (!UID_RE.test(uid) || !CMAC_RE.test(cmac) || !/^\d{1,8}$/.test(ctrRaw)) return null
  const ctr = Number(ctrRaw)
  if (!Number.isInteger(ctr) || ctr < 0 || ctr > 0xffffff) return null
  return { uid, ctr, cmac }
}

/** What the person pasted: a full SUN read, a bare UID (14 hex — only a simulated tap can use it), or nothing usable. */
export type PastedMarker = { kind: 'sun'; read: SunRead } | { kind: 'uid'; uid: string } | null
export function parsePastedMarker(input: string): PastedMarker {
  const sun = parseSunUrl(input)
  if (sun) return { kind: 'sun', read: sun }
  const bare = (input ?? '').trim().toLowerCase().replace(/[\s:-]/g, '')
  if (UID_RE.test(bare)) return { kind: 'uid', uid: bare }
  return null
}

// ── state machine ─────────────────────────────────────────────────────────
export type LinkPhase = 'reading' | 'linked' | 'signing' | 'signed' | 'error'
export interface LinkState { phase: LinkPhase; publicId: string | null; error: string | null }
export type LinkEvent =
  | { type: 'LINKED'; publicId: string }
  | { type: 'FAILED'; message: string }
  | { type: 'RETRY' }
  | { type: 'SIGN_START' }
  | { type: 'SIGNED' }
  | { type: 'SIGN_FAILED'; message: string }

export const initialLinkState = (publicId: string | null = null): LinkState => ({ phase: publicId ? 'linked' : 'reading', publicId, error: null })

export function linkReducer(s: LinkState, e: LinkEvent): LinkState {
  switch (e.type) {
    case 'LINKED': return s.phase === 'reading' || s.phase === 'error' ? { phase: 'linked', publicId: e.publicId, error: null } : s
    case 'FAILED': return s.phase === 'reading' ? { ...s, phase: 'error', error: e.message } : s
    case 'RETRY': return s.phase === 'error' ? { ...s, phase: 'reading', error: null } : s
    case 'SIGN_START': return s.phase === 'linked' ? { ...s, phase: 'signing', error: null } : s
    case 'SIGNED': return s.phase === 'signing' ? { ...s, phase: 'signed', error: null } : s
    case 'SIGN_FAILED': return s.phase === 'signing' ? { ...s, phase: 'linked', error: e.message } : s
    default: return s
  }
}

/** The texts of the prototype (LT.vincular) per phase. */
export interface LinkTexts { top: string; title: string; text: string; cta: string | null }
export function linkTexts(s: LinkState, artworkTitle: string): LinkTexts {
  const top = 'Vincular etiqueta'
  switch (s.phase) {
    case 'reading': return { top, title: 'Encoste o celular no verso da obra', text: 'Bem no centro da etiqueta, até vibrar', cta: null }
    case 'error': return { top, title: 'Não deu para vincular', text: s.error ?? 'Tente encostar de novo.', cta: 'Tentar de novo' }
    case 'linked': return { top, title: 'Etiqueta vinculada', text: `${artworkTitle} · ${s.publicId ?? ''}`.trim(), cta: 'Assinar certificado digitalmente' }
    case 'signing': return { top, title: 'Etiqueta vinculada', text: `${artworkTitle} · ${s.publicId ?? ''}`.trim(), cta: 'Assinando…' }
    case 'signed': return { top, title: 'Certificado assinado', text: 'Carimbo do tempo aplicado. Falta emitir o certificado na Certificação.', cta: 'Voltar à certificação' }
  }
}

/** The error text of a failed link, from the route's body, never invented. */
export function linkErrorMessage(status: number, body: { error?: unknown } | null): string {
  if (body && typeof body.error === 'string' && body.error.trim()) return body.error
  if (status === 0) return 'Sem conexão. Tente de novo.'
  return 'Leitura inválida. Tente de novo.'
}
