// Messaging — pure rules (handoff Fase 5, "Mensagens" / "Conversa com galeria").
// Contacts and payments only through the platform: a message that carries a
// phone number, an e-mail, a link or a Pix key is refused before it is stored,
// with the guard sentence of the prototype.

export const MESSAGE_MAX = 2000
export const MESSAGE_KINDS = ['TEXT', 'SYSTEM', 'OFFER', 'COUNTER', 'IMAGE'] as const
/** The body a photo line carries (preview, notification, the apps that do not draw images). */
export const PHOTO_BODY = 'Foto'
export type MessageKind = (typeof MESSAGE_KINDS)[number]

export const CONTACT_GUARD = 'Para manter a garantia, contatos e pagamentos só pela HouseArt. Edite a mensagem para enviar.'

/** The prototype's filter, verbatim: phone, e-mail, link, WhatsApp or Pix. */
const CONTACT_LEAK = /(\+?\d[\d\s().-]{7,}\d)|([\w.+-]+@[\w-]+\.[\w.]+)|(https?:\/\/|www\.|wa\.me|pix\s*:)/i

/** Money and thousands-grouped numbers ("R$ 1.200.000,00", "1.500.000") are not contacts. */
const MONEY = /(?<![\d.])(?:R\$\s?)?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?(?![\d.])/g

export function hasContactLeak(text: string): boolean {
  return CONTACT_LEAK.test(text.replace(MONEY, ' '))
}

/** A run of years ("2019-2021", "1998 2004 2010") reads as a phone to the chat filter. */
const YEAR_RUN = /\b(?:1\d{3}|20\d{2})(?:\s*[-–/,\s]\s*(?:1\d{3}|20\d{2}))+\b/g

/** The chat filter for descriptive text ("Sobre a obra"): the same contacts, but runs of years pass. */
export function hasContactLeakInProse(text: string): boolean {
  return hasContactLeak(text.replace(YEAR_RUN, ' anos '))
}

export type MessageCheck = { ok: true; body: string } | { ok: false; error: string; code: 'EMPTY' | 'TOO_LONG' | 'CONTACT' }

export function checkMessage(raw: unknown): MessageCheck {
  const body = typeof raw === 'string' ? raw.replace(/\r\n/g, '\n').trim() : ''
  if (!body) return { ok: false, code: 'EMPTY', error: 'Escreva uma mensagem.' }
  if (body.length > MESSAGE_MAX) return { ok: false, code: 'TOO_LONG', error: `A mensagem passa de ${MESSAGE_MAX} caracteres.` }
  if (hasContactLeak(body)) return { ok: false, code: 'CONTACT', error: CONTACT_GUARD }
  return { ok: true, body }
}

/** The ordered pair of a conversation: the smaller id first (one row per pair + artwork). */
export function pairOf(a: number, b: number): { userAId: number; userBId: number } {
  return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a }
}

export function otherOf(pair: { userAId: number; userBId: number }, me: number): number {
  return pair.userAId === me ? pair.userBId : pair.userAId
}

/** Preview of the list: "Você: …" for my line, the text itself for theirs or for a system line. */
export function previewOf(body: string, mine: boolean, kind: MessageKind): string {
  const t = body.replace(/\s+/g, ' ').trim()
  const cut = t.length > 90 ? t.slice(0, 89) + '…' : t
  return kind === 'SYSTEM' ? cut : (mine ? 'Você: ' : '') + cut
}

/** "agora" · "há 5 min" · "há 3 h" · "ontem" · "dd/mm" */
export function whenLabel(at: Date, now = new Date()): string {
  const ms = now.getTime() - at.getTime()
  const min = Math.floor(ms / 60_000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'ontem'
  if (d < 7) return `há ${d} dias`
  return at.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Bahia' })
}

/** Which side of the counter I am in THIS conversation: the artwork is mine (or my gallery's) → seller. */
export function sideOfConversation(input: { artworkMemberUserId: number | null; artworkTenantId: number | null; me: number; myTenantId: number | null; myMemberKind: string | null }): 'buyer' | 'seller' {
  if (input.artworkMemberUserId != null && input.artworkMemberUserId === input.me) return 'seller'
  // the gallery staff answer for any artwork of their gallery (a collector's tenant is their own)
  if (input.myMemberKind === 'GALLERY_STAFF' && input.myTenantId != null && input.myTenantId === input.artworkTenantId) return 'seller'
  return 'buyer'
}

/**
 * "verificado pela HouseArt": someone the house vouches for — a member the team approved, a collector the team
 * confirmed, or anyone who proved e-mail AND phone. Signing up as a gallery alone proves nothing (members are born
 * ACTIVE without approval), so the member kind never grants the badge by itself.
 */
export function verifiedByHouse(u: { memberStatus: string | null; memberApprovedAt: Date | null; collectorVerifiedAt: Date | null; emailVerifiedAt: Date | null; phoneVerifiedAt: Date | null }): boolean {
  if (u.memberStatus === 'ACTIVE' && u.memberApprovedAt) return true
  return !!u.collectorVerifiedAt || (!!u.emailVerifiedAt && !!u.phoneVerifiedAt)
}

/** The report note keeps no contact: e-mails, links and long digit runs (phone, CPF, Pix key) are blanked out. */
export function redactContacts(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[contato removido]')
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, '[contato removido]')
    .replace(/\+?\d[\d\s().\-/]{6,}\d/g, '[contato removido]')
}

/** Denunciar (handoff Web/App Colecionador › Conversa › flag): the reasons the person picks. */
export const REPORT_REASONS = [
  { key: 'OFF_PLATFORM', label: 'Pediu contato ou pagamento fora da HouseArt' },
  { key: 'SCAM', label: 'Parece golpe ou obra falsa' },
  { key: 'ABUSE', label: 'Ofensa ou assédio' },
  { key: 'OTHER', label: 'Outro motivo' },
] as const
export type ReportReason = (typeof REPORT_REASONS)[number]['key']
export const REPORT_NOTE_MAX = 500
export const isReportReason = (v: unknown): v is ReportReason => typeof v === 'string' && REPORT_REASONS.some((r) => r.key === v)
export const reportReasonLabel = (k: ReportReason) => REPORT_REASONS.find((r) => r.key === k)!.label
