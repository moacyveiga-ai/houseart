// Pure formatting shared by the screens (the prototype's brl / parcela / ficha / initials).
import { API_URL } from '@/config'
import { colors } from '@/theme'

export function brl(cents: string | number | bigint | null | undefined): string {
  if (cents === null || cents === undefined) return 'Sob consulta'
  const n = typeof cents === 'bigint' ? Number(cents) : Number(cents)
  if (!Number.isFinite(n)) return 'Sob consulta'
  return (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}

/** "ou 10× de R$ X sem juros" (installmentCents of lib/shipping/quote-core: floor to the real). */
export function installmentLine(cents: string | null): string {
  if (cents === null) return 'O preço não aparece: interessados pedem contato.'
  const each = Math.floor(Number(cents) / 10 / 100) * 100
  return `ou 10× de ${brl(each)} sem juros`
}

// the seven techniques of the handoff, plus the categories of before (frozen certificates)
export const CATEGORY_LABEL: Record<string, string> = { PAINTING: 'Pintura', SCULPTURE: 'Escultura', PHOTOGRAPHY: 'Fotografia', LITERATURE: 'Literatura', PRINT: 'Gravura', DRAWING: 'Desenho', MIXED_MEDIA: 'Técnica mista', WORK_ON_PAPER: 'Obra sobre papel', DIGITAL: 'Digital', OTHER: 'Outro' }

/** The technical line: year · technique (or the category) · dimensions. */
export function sheetLine(i: { year: number | null; technique: string | null; category?: string; dimensions: string }): string {
  return [i.year ? String(i.year) : null, i.technique ?? (i.category ? CATEGORY_LABEL[i.category] ?? i.category : null), i.dimensions && i.dimensions !== '—' ? i.dimensions : null].filter(Boolean).join(' · ')
}

export const initialsOf = (n: string): string => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?'

/** Avatar tints from the tokens only (the prototype gives each person a pair); stable by name. */
const AVATAR_PAIRS: { bg: string; fg: string }[] = [
  { bg: colors.sand100, fg: colors.ink900 }, { bg: colors.verified100, fg: colors.verified500 }, { bg: colors.pending100, fg: colors.pending500 },
  { bg: colors.ink900, fg: colors.paper50 }, { bg: colors.paper200, fg: colors.ink900 }, { bg: colors.alert100, fg: colors.alert500 },
]
export function avatarTint(name: string): { bg: string; fg: string } {
  let h = 0
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_PAIRS[h % AVATAR_PAIRS.length]!
}

/** Media URLs may be relative (`/api/public/media/…`): the app prefixes the API host. */
export function absUrl(u: string | null | undefined): string | null {
  if (!u) return null
  return /^https?:\/\//.test(u) ? u : `${API_URL}${u.startsWith('/') ? '' : '/'}${u}`
}

export const marketLabel = (m: 'PRIMARY' | 'SECONDARY' | null): string => (m === 'SECONDARY' ? 'Revenda' : 'Primário')
export const sellerKindLabel = (k: 'GALLERY' | 'PRIVATE'): string => (k === 'GALLERY' ? 'Galeria' : 'Colecionador')

/** "10:12" today · "ontem 10:12" · "03/10 10:12" (the stamp under a bubble). */
export function bubbleTime(iso: string, now = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const key = (x: Date) => x.toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' })
  const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Bahia' })
  if (key(d) === key(now)) return hm
  if (key(d) === key(new Date(now.getTime() - 86_400_000))) return `ontem ${hm}`
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Bahia' })} ${hm}`
}

/** "HA-2025-2B8D-4R1X" (any case, with or without dashes). */
export const looksLikePublicId = (q: string): boolean => /^ha-?\d{4}-?[0-9a-z]{4}-?[0-9a-z]{4}$/i.test(q.replace(/\s/g, ''))
