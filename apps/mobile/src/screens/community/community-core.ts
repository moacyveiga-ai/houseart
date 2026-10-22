// Comunidade (handoff "HouseArt App Colecionador" › Comunidade / Comentários) —
// PURE helpers over the feed items of GET /api/public/community/feed.
import type { FeedItem } from '@/api/types'

/** "Para você · Seguindo · Eventos" of the prototype plus the two the API also serves. */
export const COMMUNITY_TABS = [
  { key: 'foryou', label: 'Para você', api: 'ALL' },
  { key: 'following', label: 'Seguindo', api: 'ALL' },
  { key: 'events', label: 'Eventos', api: 'EVENTS' },
  { key: 'news', label: 'Notícias', api: 'NEWS' },
  { key: 'saved', label: 'Salvos', api: 'SAVED' },
] as const
export type CommunityTab = (typeof COMMUNITY_TABS)[number]['key']

/** "Seguindo" has no API tab: it is "Para você" kept to the authors the viewer follows. */
export const filterTab = (items: FeedItem[], tab: CommunityTab): FeedItem[] => (tab === 'following' ? items.filter((i) => i.author.following) : items)

/** The uppercase tag beside the author's name ("Artista", "Galeria", "Colecionador", "Oficial"). */
export function personTagOf(item: FeedItem): { label: string; official: boolean } {
  if (item.kind === 'NEWS' || item.kind === 'AGENDA') return { label: 'Oficial', official: true }
  const head = item.author.sub.split(' · ')[0]?.trim()
  return { label: head || 'Membro', official: false }
}

/** The grey line under the name: "Salvador · há 3 h". */
export function authorLineOf(item: FeedItem): string {
  if (item.kind === 'AGENDA') return item.author.sub
  const parts = item.author.sub.split(' · ').slice(1).map((p) => p.trim()).filter(Boolean)
  if (item.when && item.when !== 'agenda') parts.push(item.when)
  return parts.join(' · ')
}

export const votesLabel = (total: number, voted: boolean) => `${total} ${total === 1 ? 'voto' : 'votos'} · ${voted ? 'você votou' : 'toque para votar'}`
export const goingLabel = (n: number) => `${n} ${n === 1 ? 'pessoa vai' : 'pessoas vão'}`

/** The reaction target of a feed item (posts and EVENT posts are POST; the agenda is EVENT). */
export const reactionTargetOf = (item: FeedItem): 'POST' | 'NEWS' | 'EVENT' => (item.kind === 'NEWS' ? 'NEWS' : item.kind === 'AGENDA' ? 'EVENT' : 'POST')

/** Applies a vote locally the way the server will count it (one vote per person, re-vote moves it). */
export function applyVote(poll: NonNullable<FeedItem['poll']>, option: number): NonNullable<FeedItem['poll']> {
  const counts = poll.options.map((o, i) => o.count + (i === option ? 1 : 0) - (i === poll.myVote ? 1 : 0))
  const total = counts.reduce((a, b) => a + b, 0)
  return { myVote: option, total, options: poll.options.map((o, i) => ({ label: o.label, count: counts[i]!, pct: total ? Math.round((counts[i]! * 100) / total) : 0 })) }
}

/** The prototype's contact filter, shown before the server's own refusal. */
export const hasContact = (t: string) => /(\+?\d[\d\s().-]{7,}\d)|([\w.+-]+@[\w-]+\.[\w.]+)|(https?:\/\/|www\.|wa\.me|pix\s*:)/i.test(t)
export const CONTACT_LINE = 'Telefones, e-mails e links não podem ser publicados. Negocie pelas mensagens da HouseArt.'

export type ComposerKind = 'TEXT' | 'PHOTO' | 'POLL' | 'EVENT'
export const COMPOSER_KINDS: { key: ComposerKind; label: string; icon: 'notes' | 'add-photo-alternate' | 'ballot' | 'event' }[] = [
  { key: 'TEXT', label: 'Texto', icon: 'notes' }, { key: 'PHOTO', label: 'Foto', icon: 'add-photo-alternate' }, { key: 'POLL', label: 'Enquete', icon: 'ballot' }, { key: 'EVENT', label: 'Evento', icon: 'event' },
]
export interface ComposerDraft { kind: ComposerKind; body: string; artworkId: number | null; imageUrl: string; pollOptions: string[]; event: { title: string; venue: string; startsOn: string; startsAt: string } }
export const EMPTY_DRAFT: ComposerDraft = { kind: 'TEXT', body: '', artworkId: null, imageUrl: '', pollOptions: ['', ''], event: { title: '', venue: '', startsOn: '', startsAt: '' } }

export function draftReady(d: ComposerDraft): boolean {
  if (d.kind === 'TEXT') return d.body.trim().length > 0
  if (d.kind === 'PHOTO') return d.artworkId != null || /^https?:\/\//.test(d.imageUrl.trim())
  if (d.kind === 'POLL') return d.body.trim().length > 0 && d.pollOptions.filter((o) => o.trim()).length >= 2
  return d.event.title.trim().length > 0 && d.event.venue.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(d.event.startsOn)
}

/** The body POST /api/community/posts expects. */
export function draftPayload(d: ComposerDraft): Record<string, unknown> {
  const base: Record<string, unknown> = { kind: d.kind, body: d.body.trim() }
  if (d.kind === 'TEXT' || d.kind === 'PHOTO') { if (d.artworkId) base.artworkId = d.artworkId; if (d.kind === 'PHOTO' && d.imageUrl.trim()) base.imageUrl = d.imageUrl.trim() }
  if (d.kind === 'POLL') base.pollOptions = d.pollOptions.map((o) => o.trim()).filter(Boolean)
  if (d.kind === 'EVENT') base.event = { title: d.event.title.trim(), venue: d.event.venue.trim(), startsOn: d.event.startsOn, startsAt: d.event.startsAt.trim() || null }
  return base
}

/** "2026-11-07" from the typed "07/11/2026" (the field keeps the Brazilian order). */
export const isoDateOf = (br: string): string => { const d = br.replace(/\D/g, '').slice(0, 8); return d.length === 8 ? `${d.slice(4)}-${d.slice(2, 4)}-${d.slice(0, 2)}` : '' }
export const formatDateInput = (raw: string) => { const d = raw.replace(/\D/g, '').slice(0, 8); return d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }
