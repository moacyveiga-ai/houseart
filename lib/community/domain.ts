// Community — allowlists and pure rules (handoff Fase 5, "Comunidade",
// "Comentários", "Comunidade e eventos"). The feed mixes member posts (photo,
// text, poll, event), the house news (NewsArticle) and the art agenda
// (AgendaEvent). Reactions are one row per (user, target, kind).

export const POST_KINDS = ['PHOTO', 'TEXT', 'POLL', 'EVENT'] as const
export type PostKind = (typeof POST_KINDS)[number]
export const REACTION_TARGETS = ['POST', 'NEWS', 'EVENT', 'COMMENT', 'MEMBER'] as const
export type ReactionTarget = (typeof REACTION_TARGETS)[number]
export const REACTION_KINDS = ['LIKE', 'SAVE', 'RSVP', 'FOLLOW'] as const
export type ReactionKind = (typeof REACTION_KINDS)[number]
export const COMMENT_TARGETS = ['POST', 'NEWS'] as const
export type CommentTarget = (typeof COMMENT_TARGETS)[number]

export const POST_BODY_MAX = 1500
export const COMMENT_MAX = 500
export const POLL_OPTIONS_MIN = 2
export const POLL_OPTIONS_MAX = 4
export const POLL_OPTION_MAX = 40

/** Which reaction kinds each target accepts. */
export const ALLOWED_REACTIONS: Record<ReactionTarget, readonly ReactionKind[]> = {
  POST: ['LIKE', 'SAVE', 'RSVP'], // RSVP only on an EVENT post (the server checks the kind)
  NEWS: ['LIKE', 'SAVE'],
  EVENT: ['LIKE', 'SAVE', 'RSVP'],
  COMMENT: ['LIKE'],
  MEMBER: ['FOLLOW'],
}

export function reactionAllowed(target: string, kind: string): target is ReactionTarget {
  return (REACTION_TARGETS as readonly string[]).includes(target) && (ALLOWED_REACTIONS[target as ReactionTarget] as readonly string[]).includes(kind)
}

export interface NewPostInput { kind: PostKind; body: string; artworkId?: number | null; imageUrl?: string | null; pollOptions?: string[]; event?: { title: string; venue: string; startsOn: string; startsAt?: string | null } | null }
export type PostCheck = { ok: true; value: NewPostInput } | { ok: false; error: string }

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, max) : '')

export function checkPost(raw: Record<string, unknown>): PostCheck {
  const kind = String(raw.kind ?? 'TEXT') as PostKind
  if (!POST_KINDS.includes(kind)) return { ok: false, error: 'Tipo de post inválido.' }
  const body = str(raw.body, POST_BODY_MAX)
  const artworkId = typeof raw.artworkId === 'number' && Number.isInteger(raw.artworkId) && raw.artworkId > 0 ? raw.artworkId : null
  const imageUrl = typeof raw.imageUrl === 'string' && /^https?:\/\//.test(raw.imageUrl) ? raw.imageUrl.slice(0, 500) : null
  if (kind === 'PHOTO' && !imageUrl && !artworkId) return { ok: false, error: 'Um post de foto precisa de uma imagem ou de uma obra.' }
  if (kind === 'TEXT' && !body) return { ok: false, error: 'Escreva alguma coisa.' }
  let pollOptions: string[] | undefined
  if (kind === 'POLL') {
    if (!body) return { ok: false, error: 'A enquete precisa de uma pergunta.' }
    const ops = Array.isArray(raw.pollOptions) ? raw.pollOptions.map((o) => str(o, POLL_OPTION_MAX)).filter(Boolean) : []
    if (ops.length < POLL_OPTIONS_MIN || ops.length > POLL_OPTIONS_MAX) return { ok: false, error: `A enquete tem de ${POLL_OPTIONS_MIN} a ${POLL_OPTIONS_MAX} opções.` }
    if (new Set(ops.map((o) => o.toLowerCase())).size !== ops.length) return { ok: false, error: 'As opções da enquete se repetem.' }
    pollOptions = ops
  }
  let event: NewPostInput['event'] = null
  if (kind === 'EVENT') {
    const e = (raw.event ?? {}) as Record<string, unknown>
    const title = str(e.title, 120), venue = str(e.venue, 160), startsOn = str(e.startsOn, 10), startsAt = str(e.startsAt, 10) || null
    if (!title || !venue) return { ok: false, error: 'O evento precisa de título e local.' }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn)) return { ok: false, error: 'Data do evento inválida.' }
    event = { title, venue, startsOn, startsAt }
  }
  return { ok: true, value: { kind, body, artworkId, imageUrl, pollOptions, event } }
}

export function checkComment(raw: unknown): { ok: true; body: string } | { ok: false; error: string } {
  const body = str(raw, COMMENT_MAX + 1)
  if (!body) return { ok: false, error: 'Escreva um comentário.' }
  if (body.length > COMMENT_MAX) return { ok: false, error: `O comentário passa de ${COMMENT_MAX} caracteres.` }
  return { ok: true, body }
}

/** Poll result per option: count and percentage of the total (rounded, sums to ~100). */
export function pollResult(options: string[], counts: number[]): { label: string; count: number; pct: number }[] {
  const total = counts.reduce((a, b) => a + b, 0)
  return options.map((label, i) => ({ label, count: counts[i] ?? 0, pct: total ? Math.round(((counts[i] ?? 0) * 100) / total) : 0 }))
}

/** "29" + "OUT" from YYYY-MM-DD, as the event card of the prototype. */
export function dayMonthOf(ymd: string): { day: string; month: string } {
  const [, m, d] = ymd.split('-')
  const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ']
  return { day: d ?? '', month: months[Number(m) - 1] ?? '' }
}
