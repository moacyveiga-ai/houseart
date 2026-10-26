// Comunidade — pure helpers of the screen (handoff "HouseArt App Colecionador"
// › Comunidade / Comentários, "HouseArt App Galeria" › Comunidade e eventos).
// No I/O: the feed arrives from `@/lib/community/server` through the page.
import type { FeedItem } from '@/lib/community/server'

/** The tabs of the prototype ("Para você · Seguindo · Eventos") plus the two the API also serves. */
export const COMMUNITY_TABS = [
  { key: 'foryou', label: 'Para você', api: 'ALL' },
  { key: 'following', label: 'Seguindo', api: 'ALL' },
  { key: 'events', label: 'Eventos', api: 'EVENTS' },
  { key: 'news', label: 'Notícias', api: 'NEWS' },
  { key: 'saved', label: 'Salvos', api: 'SAVED' },
] as const
export type CommunityTab = (typeof COMMUNITY_TABS)[number]['key']

export function tabOf(raw: string | undefined): CommunityTab {
  return (COMMUNITY_TABS.find((t) => t.key === raw)?.key ?? 'foryou') as CommunityTab
}

/** "Seguindo" has no API tab: it is "Para você" kept to the authors the viewer follows. */
export function filterTab(items: FeedItem[], tab: CommunityTab): FeedItem[] {
  return tab === 'following' ? items.filter((i) => i.author.following) : items
}

/** The uppercase tag beside the author's name ("ARTISTA", "GALERIA", "COLECIONADOR", "OFICIAL"). */
export function personTagOf(item: FeedItem): { label: string; official: boolean } {
  if (item.kind === 'NEWS' || item.kind === 'AGENDA') return { label: 'Oficial', official: true }
  const head = item.author.sub.split(' · ')[0]?.trim()
  return { label: head || 'Membro', official: false }
}

/** The grey line under the name: "Salvador · há 3 h" (city when the sub has one, then `when`). */
export function authorLineOf(item: FeedItem): string {
  const parts = item.author.sub.split(' · ').slice(1).map((p) => p.trim()).filter(Boolean)
  if (item.kind === 'AGENDA') return item.author.sub
  if (item.when && item.when !== 'agenda') parts.push(item.when)
  return parts.join(' · ')
}

export function votesLabel(total: number, voted: boolean): string {
  return `${total} ${total === 1 ? 'voto' : 'votos'} · ${voted ? 'você votou' : 'toque para votar'}`
}

export function goingLabel(n: number): string {
  return `${n} ${n === 1 ? 'pessoa vai' : 'pessoas vão'}`
}

/** What "Compartilhar" copies: the public artwork, the news page, or the community itself. */
export function sharePathOf(item: FeedItem): string {
  if (item.artwork?.publicId) return `/e/artwork/${item.artwork.publicId}`
  if (item.kind === 'NEWS' && item.href) return item.href
  return '/community'
}

/** The reaction target of a feed item (posts and EVENT posts are POST; the agenda is EVENT). */
export function reactionTargetOf(item: FeedItem): 'POST' | 'NEWS' | 'EVENT' {
  return item.kind === 'NEWS' ? 'NEWS' : item.kind === 'AGENDA' ? 'EVENT' : 'POST'
}

/** Applies a vote locally the way the server will count it (one vote per person, re-vote moves it). */
export function applyVote(poll: NonNullable<FeedItem['poll']>, option: number): NonNullable<FeedItem['poll']> {
  const counts = poll.options.map((o, i) => o.count + (i === option ? 1 : 0) - (i === poll.myVote ? 1 : 0))
  const total = counts.reduce((a, b) => a + b, 0)
  return { myVote: option, total, options: poll.options.map((o, i) => ({ label: o.label, count: counts[i]!, pct: total ? Math.round((counts[i]! * 100) / total) : 0 })) }
}

export type ComposerKind = 'TEXT' | 'PHOTO' | 'POLL' | 'EVENT'
export const COMPOSER_KINDS: { key: ComposerKind; label: string; icon: string }[] = [
  { key: 'TEXT', label: 'Texto', icon: 'notes' },
  { key: 'PHOTO', label: 'Foto', icon: 'add_photo_alternate' },
  { key: 'POLL', label: 'Enquete', icon: 'ballot' },
  { key: 'EVENT', label: 'Evento', icon: 'event' },
]

export interface ComposerDraft {
  kind: ComposerKind
  body: string
  artworkId: number | null
  imageUrl: string
  pollOptions: string[]
  event: { title: string; venue: string; startsOn: string; startsAt: string }
}

export const EMPTY_DRAFT: ComposerDraft = { kind: 'TEXT', body: '', artworkId: null, imageUrl: '', pollOptions: ['', ''], event: { title: '', venue: '', startsOn: '', startsAt: '' } }

/** The "Publicar" button only lights when the draft can be posted (the server re-checks with `checkPost`). */
export function draftReady(d: ComposerDraft): boolean {
  if (d.kind === 'TEXT') return d.body.trim().length > 0
  if (d.kind === 'PHOTO') return d.artworkId != null || d.imageUrl.trim() !== ''
  if (d.kind === 'POLL') return d.body.trim().length > 0 && d.pollOptions.filter((o) => o.trim()).length >= 2
  return d.event.title.trim().length > 0 && d.event.venue.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(d.event.startsOn)
}

/** The body the API expects for the draft. */
export function draftPayload(d: ComposerDraft): Record<string, unknown> {
  const base: Record<string, unknown> = { kind: d.kind, body: d.body.trim() }
  if (d.kind === 'TEXT' || d.kind === 'PHOTO') { if (d.artworkId) base.artworkId = d.artworkId; if (d.kind === 'PHOTO' && d.imageUrl.trim()) base.imageUrl = d.imageUrl.trim() }
  if (d.kind === 'POLL') base.pollOptions = d.pollOptions.map((o) => o.trim()).filter(Boolean)
  if (d.kind === 'EVENT') base.event = { title: d.event.title.trim(), venue: d.event.venue.trim(), startsOn: d.event.startsOn, startsAt: d.event.startsAt.trim() || null }
  return base
}
