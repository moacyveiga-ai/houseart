// Mensagens — pure helpers of the screen (handoff "HouseArt App Colecionador" ›
// Mensagens / Conversa com galeria; "HouseArt App Galeria" › Conversa com
// compradora). No I/O: the island and the test import this.
import type { MessageKind } from '@/lib/messaging/core'

export const MESSAGES_DESKTOP_MIN = 1024

export type MessageRole = 'buyer' | 'seller'

export interface ConversationView { id: number; artworkId: number | null; artworkTitle: string | null; artworkPublicId: string | null; artworkCoverUrl: string | null; other: { id: number; name: string; initials: string; sub: string }; preview: string; when: string; unread: number }
export interface MessageView { id: number; mine: boolean; kind: MessageKind; body: string; at: string; offerId: number | null }

/** The quick replies of the prototype, by the side of the counter. */
export const QUICK_REPLIES: Record<MessageRole, readonly string[]> = {
  buyer: ['Ainda disponível?', 'Posso ver ao vivo?', 'Como fica o frete?', 'Tem o condition report?'],
  seller: ['Sim, segue disponível', 'Quinta às 15h funciona?', 'Envio o condition report', 'Frete grátis em Salvador'],
}

/** The nav profile → which side of the counter writes (collector = buyer; the rest sell). */
export function roleOfProfile(profile: string): MessageRole {
  return profile === 'collector' ? 'buyer' : 'seller'
}

const TZ = 'America/Bahia'
const dayKey = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: TZ })

/** "10:12" today · "ontem 10:12" · "03/10 10:12" — the stamp under the bubble. */
export function bubbleTime(iso: string, now = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const hm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
  if (dayKey(d) === dayKey(now)) return hm
  const yesterday = new Date(now.getTime() - 86_400_000)
  if (dayKey(d) === dayKey(yesterday)) return `ontem ${hm}`
  return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: TZ })} ${hm}`
}

/** Merges a page of `?after=` messages into the list without duplicates, in id order. */
export function mergeMessages(current: MessageView[], incoming: MessageView[]): MessageView[] {
  if (incoming.length === 0) return current
  const seen = new Set(current.map((m) => m.id))
  const fresh = incoming.filter((m) => !seen.has(m.id))
  if (fresh.length === 0) return current
  return [...current, ...fresh].sort((a, b) => a.id - b.id)
}

export const lastIdOf = (ms: MessageView[]): number => (ms.length ? ms[ms.length - 1]!.id : 0)

/** The conversation id of a `/messages/<id>` pathname (null for the list). */
export function conversationIdOfPath(pathname: string): number | null {
  const m = /^\/messages\/(\d+)(?:\/)?$/.exec(pathname)
  if (!m) return null
  const id = Number(m[1])
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

/** The row of the list after the open conversation changes: read → no unread, new line → preview. */
export function touchRow(rows: ConversationView[], header: ConversationView, patch: { preview?: string; when?: string }): ConversationView[] {
  const i = rows.findIndex((r) => r.id === header.id)
  const next = { ...header, ...patch, unread: 0 }
  if (i < 0) return [next, ...rows]
  const out = rows.slice(); out.splice(i, 1)
  return [next, ...out]
}
