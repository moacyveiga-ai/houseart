// Messaging — pure rules (handoff Fase 5, "Mensagens" / "Conversa com galeria").
// Contacts and payments only through the platform: a message that carries a
// phone number, an e-mail, a link or a Pix key is refused before it is stored,
// with the guard sentence of the prototype.

export const MESSAGE_MAX = 2000
export const MESSAGE_KINDS = ['TEXT', 'SYSTEM', 'OFFER', 'COUNTER'] as const
export type MessageKind = (typeof MESSAGE_KINDS)[number]

export const CONTACT_GUARD = 'Para manter a garantia, contatos e pagamentos só pela HouseArt. Edite a mensagem para enviar.'

/** The prototype's filter, verbatim: phone, e-mail, link, WhatsApp or Pix. */
const CONTACT_LEAK = /(\+?\d[\d\s().-]{7,}\d)|([\w.+-]+@[\w-]+\.[\w.]+)|(https?:\/\/|www\.|wa\.me|pix\s*:)/i

export function hasContactLeak(text: string): boolean {
  return CONTACT_LEAK.test(text)
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
