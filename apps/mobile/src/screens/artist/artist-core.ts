// App Artista — pure helpers (no React, no fetch): the capture slots, the
// "Ficha rápida" parsing, the tag reading, the targets of the home actions,
// the status line of a work and the avisos' icon/tone/stamp. Ported from the
// web (`lib/artworks/domain.ts` MEDIA_SLOTS, `components/certification/
// link-marker-core.ts`, `components/notifications/notifications-core.ts`) —
// the app does not import the root, so the copies live here.
import type { ArtworkStatus } from '@/api/gallery'
import type { CertAction } from '@/api/artist'
import { colors } from '@/theme'
import type { IconName } from '@/ui/kit'

// ── Nova obra · câmera guiada ─────────────────────────────────────────────
export interface CaptureSlot { kind: string; name: string; hint: string; required: boolean; colorCard?: true; focus?: { x: number; y: number } }
/** The ten slots of the web "Mídia" step, in the design order: six required, four optional. */
export const CAPTURE_SLOTS: CaptureSlot[] = [
  { kind: 'FRONT_COLOR_CARD', name: 'Frontal com cartão de cor', hint: 'Obra inteira no quadro, cartão de cor no canto, luz difusa.', required: true, colorCard: true },
  { kind: 'MACRO_TL', name: 'Macro 1 · superior esquerda', hint: 'Aproxime até ver a trama da tela.', required: true, focus: { x: 0.12, y: 0.12 } },
  { kind: 'MACRO_TR', name: 'Macro 2 · superior direita', hint: 'Mesma distância da anterior.', required: true, focus: { x: 0.88, y: 0.12 } },
  { kind: 'MACRO_BL', name: 'Macro 3 · inferior esquerda', hint: 'Inclua a pincelada mais marcada da região.', required: true, focus: { x: 0.12, y: 0.88 } },
  { kind: 'MACRO_BR', name: 'Macro 4 · inferior direita', hint: 'Mantenha o celular paralelo à obra.', required: true, focus: { x: 0.88, y: 0.88 } },
  { kind: 'BACK', name: 'Verso', hint: 'Chassi inteiro e assinatura visíveis. É aqui que a etiqueta será colada.', required: true },
  { kind: 'SIGNATURE', name: 'Assinatura', hint: 'Aproxime até ler a assinatura e a data com nitidez.', required: false, focus: { x: 0.85, y: 0.88 } },
  { kind: 'DETAIL', name: 'Detalhe da superfície', hint: 'A um palmo de distância, numa área com pincelada ou textura marcada.', required: false },
  { kind: 'SIDE', name: 'Lateral', hint: 'Espessura do chassi e acabamento da borda.', required: false },
  { kind: 'IN_SITU', name: 'Na parede', hint: 'Ajuda o comprador a entender a escala. Inclua um móvel ou a porta.', required: false },
]
export const REQUIRED_COUNT = CAPTURE_SLOTS.filter((s) => s.required).length

/** "Foto 3 de 6" for the required shots, "Opcional · 2 de 4" after them. */
export function captureCounter(index: number): string {
  const s = CAPTURE_SLOTS[index]
  if (!s) return ''
  if (s.required) return `Foto ${index + 1} de ${REQUIRED_COUNT}`
  return `Opcional · ${index - REQUIRED_COUNT + 1} de ${CAPTURE_SLOTS.length - REQUIRED_COUNT}`
}

/** The first slot without a photo (required first); the slot count when all are done. */
export function nextSlot(done: ReadonlySet<string>, from = 0): number {
  for (let i = from; i < CAPTURE_SLOTS.length; i++) if (!done.has(CAPTURE_SLOTS[i]!.kind)) return i
  return CAPTURE_SLOTS.length
}
export const missingRequired = (done: ReadonlySet<string>): CaptureSlot[] => CAPTURE_SLOTS.filter((s) => s.required && !done.has(s.kind))

/** A file name and type for the multipart part (the picker may not give them). */
export function photoPart(asset: { uri: string; fileName?: string | null; mimeType?: string | null }, kind: string): { uri: string; name: string; type: string } {
  const type = asset.mimeType && /^image\/(jpeg|png|webp)$/.test(asset.mimeType) ? asset.mimeType : /\.png$/i.test(asset.uri) ? 'image/png' : /\.webp$/i.test(asset.uri) ? 'image/webp' : 'image/jpeg'
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'
  return { uri: asset.uri, name: asset.fileName || `${kind.toLowerCase()}.${ext}`, type }
}

// ── Ficha rápida ──────────────────────────────────────────────────────────
/** "90 × 90 × 3,5" (×, x or *) → cm strings the PATCH converts to mm; null when the text does not read. */
export function parseDimensions(text: string): { heightMm: string; widthMm: string; depthMm: string | null } | null {
  const parts = (text ?? '').trim().split(/\s*[×xX*]\s*/).filter(Boolean)
  if (parts.length < 2 || parts.length > 3) return null
  const nums = parts.map((p) => p.replace(/\s|cm/gi, '').replace(',', '.'))
  if (!nums.every((n) => /^\d+(\.\d+)?$/.test(n) && Number(n) > 0)) return null
  return { heightMm: nums[0]!, widthMm: nums[1]!, depthMm: nums[2] ?? null }
}

/** mm back to the field: "90 × 90 × 3,5". */
export function dimensionsText(a: { heightMm: number | null; widthMm: number | null; depthMm: number | null }): string {
  const cm = (mm: number | null) => (mm === null ? null : String(mm / 10).replace('.', ','))
  const h = cm(a.heightMm), w = cm(a.widthMm), d = cm(a.depthMm)
  if (!h || !w) return ''
  return [h, w, d].filter(Boolean).join(' × ')
}

export interface QuickSheet { title: string; year: string; technique: string; dimensions: string }
/** The problems that block "Enviar e vincular etiqueta" (the server is the authority; this only avoids a useless round trip). */
export function sheetProblems(f: QuickSheet): string[] {
  const p: string[] = []
  if (!f.title.trim()) p.push('Informe o título.')
  if (f.year.trim() && !/^\d{4}$/.test(f.year.trim())) p.push('Ano com quatro dígitos.')
  if (!f.technique.trim()) p.push('Informe a técnica.')
  if (f.dimensions.trim() && !parseDimensions(f.dimensions)) p.push('Dimensões como 90 × 90 × 3,5.')
  return p
}

/** The PATCH body of the sheet (empty fields go as null; dimensions in cm, the server converts). */
export function sheetPatch(f: QuickSheet): Record<string, unknown> {
  const d = parseDimensions(f.dimensions)
  return {
    title: f.title.trim(),
    year: f.year.trim() ? Number(f.year.trim()) : null,
    technique: f.technique.trim() || null,
    ...(d ? { heightMm: d.heightMm, widthMm: d.widthMm, depthMm: d.depthMm } : {}),
  }
}

// ── Vincular etiqueta ─────────────────────────────────────────────────────
export interface SunRead { uid: string; ctr: number; cmac: string }
const UID_RE = /^[0-9a-f]{14}$/
const CMAC_RE = /^[0-9a-f]{16}$/

/** `uid`, `ctr` and `cmac` from the URL of the tag (full URL, `?query`, or `a=b&c=d`). */
export function parseSunUrl(input: string): SunRead | null {
  const text = (input ?? '').trim()
  if (!text) return null
  const q = text.includes('?') ? text.slice(text.indexOf('?') + 1) : text
  const params = new Map<string, string>()
  for (const pair of q.split('#')[0]!.split('&')) {
    const i = pair.indexOf('=')
    if (i > 0) params.set(decodeURIComponent(pair.slice(0, i)), decodeURIComponent(pair.slice(i + 1)))
  }
  const uid = (params.get('uid') ?? '').trim().toLowerCase()
  const cmac = (params.get('cmac') ?? '').trim().toLowerCase()
  const ctrRaw = (params.get('ctr') ?? '').trim()
  if (!UID_RE.test(uid) || !CMAC_RE.test(cmac) || !/^\d{1,8}$/.test(ctrRaw)) return null
  const ctr = Number(ctrRaw)
  if (ctr > 0xffffff) return null
  return { uid, ctr, cmac }
}

/** What was pasted: a full SUN read, a bare UID (14 hex — only a simulated tap uses it), or nothing usable. */
export type PastedMarker = { kind: 'sun'; read: SunRead } | { kind: 'uid'; uid: string } | null
export function parsePastedMarker(input: string): PastedMarker {
  const sun = parseSunUrl(input)
  if (sun) return { kind: 'sun', read: sun }
  const bare = (input ?? '').trim().toLowerCase().replace(/[\s:-]/g, '')
  return UID_RE.test(bare) ? { kind: 'uid', uid: bare } : null
}

export type LinkPhase = 'reading' | 'linked' | 'signing' | 'signed' | 'error'
/** The texts of the prototype (LT.vincular) per phase. */
export function linkTexts(phase: LinkPhase, title: string, publicId: string | null, error: string | null): { title: string; text: string } {
  switch (phase) {
    case 'reading': return { title: 'Encoste o celular no verso da obra', text: 'Bem no centro da etiqueta, até vibrar' }
    case 'error': return { title: 'Não deu para vincular', text: error ?? 'Tente de novo.' }
    case 'linked':
    case 'signing': return { title: 'Etiqueta vinculada', text: `${title} · ${publicId ?? ''}`.trim() }
    case 'signed': return { title: 'Certificado assinado', text: 'Carimbo do tempo aplicado. Falta emitir o certificado na Certificação.' }
  }
}

// ── Início ────────────────────────────────────────────────────────────────
/** Where a next action of `lib/dashboard` (web hrefs) goes in the app. */
export type ActionTarget = { kind: 'tab'; tab: 'certification' | 'artworks'; filter?: string } | { kind: 'web'; path: string; title: string }
export function actionTarget(href: string): ActionTarget {
  if (href.startsWith('/certification')) return { kind: 'tab', tab: 'certification' }
  if (href.startsWith('/artworks')) {
    const m = /[?&]filter=([a-z]+)/.exec(href)
    return { kind: 'tab', tab: 'artworks', filter: m?.[1] }
  }
  if (href.startsWith('/sales')) return { kind: 'web', path: '/sales', title: 'Vendas' }
  return { kind: 'web', path: href.startsWith('/') ? href : '/', title: 'HouseArt' }
}

const MATERIAL: Record<string, IconName> = { draw: 'draw', handshake: 'handshake', add_a_photo: 'add-a-photo', contactless: 'contactless', notifications: 'notifications', chat_bubble: 'chat-bubble', forum: 'forum', local_shipping: 'local-shipping', contract: 'description', swap_horiz: 'swap-horiz', autorenew: 'autorenew', assignment: 'assignment', receipt_long: 'receipt-long' }
/** A Material Symbols name of the web (snake_case) → the Material Icons glyph of the app. */
export const iconOf = (symbol: string): IconName => MATERIAL[symbol] ?? 'chevron-right'

/** The status line under a work of "Suas obras" (prototype `obras.st` and its colour). */
export function workStatus(status: ArtworkStatus): { label: string; color: string } {
  switch (status) {
    case 'LISTED': return { label: 'À venda', color: colors.ink900 }
    case 'IN_DEAL': return { label: 'Em negociação', color: colors.ink900 }
    case 'IN_CERTIFICATION': return { label: 'Em certificação', color: colors.pending500 }
    case 'AUTHENTICATED': return { label: 'Autenticada', color: colors.verified500 }
    case 'SOLD': return { label: 'Vendida', color: colors.ink500 }
    case 'DRAFT': return { label: 'Rascunho', color: colors.ink500 }
    case 'STOLEN': return { label: 'Roubada', color: colors.alert500 }
    case 'DISPUTED': return { label: 'Em disputa', color: colors.alert500 }
    default: return { label: 'Arquivada', color: colors.ink500 }
  }
}

/** "Olá, Joana" (the prototype greets by the first name). */
export const helloOf = (name: string): string => `Olá, ${name.trim().split(/\s+/)[0] || ''}`.trim()

// ── Carteira de escrituras ────────────────────────────────────────────────
/** What a tap on a certification row does in the app. */
export type CertTarget = { kind: 'link'; artworkId: number } | { kind: 'verify'; publicId: string } | { kind: 'web'; path: string; title: string } | { kind: 'none' }
export function certTarget(i: { artworkId: number; action: CertAction; publicId: string | null }): CertTarget {
  if (i.action === 'LINK_IN_APP' || i.action === 'SIGN') return { kind: 'link', artworkId: i.artworkId }
  if (i.action === 'VIEW' && i.publicId) return { kind: 'verify', publicId: i.publicId }
  if (i.action === 'ISSUE') return { kind: 'web', path: '/certification', title: 'Certificação' }
  return { kind: 'none' }
}
export const versionLabel = (v: number | null): string => (v ? `Versão ${v}` : '—')

// ── Avisos ────────────────────────────────────────────────────────────────
/** The round icon follows the kind prefix of `notify()` (the web `iconOf`). */
export function noticeIcon(kind: string): IconName {
  switch (kind.split('.')[0]) {
    case 'offer': return 'handshake'
    case 'message': return 'chat-bubble'
    case 'community': return 'forum'
    case 'deal': return 'local-shipping'
    case 'certificate': return 'description'
    case 'ownership': return 'swap-horiz'
    case 'royalty': return 'autorenew'
    case 'appraisal': return 'assignment'
    case 'billing': return 'receipt-long'
    default: return 'notifications'
  }
}
/** Green for what was issued or concluded, sand while unread, paper once read (prototype `avisos.bg/fg`). */
export function noticeTone(n: { kind: string; readAt: string | null }): { bg: string; fg: string } {
  const head = n.kind.split('.')[0]
  if (head === 'certificate' || head === 'royalty' || n.kind === 'deal.completed' || n.kind === 'ownership.completed') return { bg: colors.verified100, fg: colors.verified500 }
  return n.readAt ? { bg: colors.paper100, fg: colors.ink900 } : { bg: colors.sand100, fg: colors.ink900 }
}
/** "agora" · "30 min" · "3 h" · "ontem" · "02/03" (the prototype's `quando`). */
export function whenShort(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const ms = now.getTime() - d.getTime()
  if (Number.isNaN(ms)) return ''
  if (ms < 60_000) return 'agora'
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} min`
  const key = (x: Date) => x.toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' })
  if (key(d) === key(now)) return `${Math.floor(ms / 3_600_000)} h`
  if (key(d) === key(new Date(now.getTime() - 86_400_000))) return 'ontem'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Bahia' })
}
