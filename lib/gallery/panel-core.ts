// "Galeria · painel do dia" — PURE: the Agenda tiles, the "Precisa de você" items that come from
// counts (messages without an answer, drafts) and the offer line "89% do preço".

export interface AgendaItem { key: string; day: string; month: string; title: string; sub: string; icon: string; href: string }

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** "2026-11-03" → { day: "03", month: "nov" }; anything else → null. */
export function dayMonthOf(ymd: string): { day: string; month: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd)
  if (!m) return null
  const month = Number(m[2])
  if (month < 1 || month > 12) return null
  return { day: m[3]!, month: MONTHS[month - 1]! }
}

export interface AgendaSource {
  key: string
  /** YYYY-MM-DD */
  startsOn: string
  title: string
  sub: string
  /** OPENING (the gallery's own event post) · GOING (an event the person confirmed) · AGENDA (the house agenda, posted by the gallery) */
  kind: 'OPENING' | 'GOING' | 'AGENDA'
  href: string
}

const AGENDA_ICON: Record<AgendaSource['kind'], string> = { OPENING: 'celebration', GOING: 'event_available', AGENDA: 'event' }

/** Upcoming first (from `today`, YYYY-MM-DD in the house's zone), one tile per source, `take` at most. */
export function agendaOf(sources: AgendaSource[], today: string, take = 5): AgendaItem[] {
  const seen = new Set<string>()
  return sources
    .filter((s) => s.startsOn >= today && dayMonthOf(s.startsOn))
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.title.localeCompare(b.title))
    .filter((s) => { if (seen.has(s.key)) return false; seen.add(s.key); return true })
    .slice(0, take)
    .map((s) => ({ key: s.key, ...dayMonthOf(s.startsOn)!, title: s.title, sub: s.sub, icon: AGENDA_ICON[s.kind], href: s.href }))
}

export interface PanelAction { icon: string; title: string; sub: string; tag: string; tone: 'pending' | 'alert' | 'neutral'; href: string }

/** "2 mensagens sem resposta" · "Helena Vaz, Marcelo Dias" · responder — null when there is none. */
export function unansweredAction(names: string[]): PanelAction | null {
  const n = names.length
  if (!n) return null
  const shown = names.slice(0, 3).join(', ') + (n > 3 ? ` e mais ${n - 3}` : '')
  return { icon: 'chat_bubble', title: n === 1 ? '1 mensagem sem resposta' : `${n} mensagens sem resposta`, sub: shown, tag: 'responder', tone: 'pending', href: '/messages' }
}

/** "3 obras sem certificado" · "Peça a certificação para colocar à venda" → Acervo › Rascunhos. */
export function draftsAction(drafts: number): PanelAction | null {
  if (!drafts) return null
  return { icon: 'draft', title: drafts === 1 ? '1 obra sem certificado' : `${drafts} obras sem certificado`, sub: 'Peça a certificação para colocar à venda', tag: 'rascunho', tone: 'neutral', href: '/artworks?filter=drafts' }
}

/** The offer line of the panel: "Construção nº 7 · Helena Vaz · 89% do preço" (the difference when there is no price). */
export function offerSub(o: { artworkTitle: string; buyer: string; pctOfPrice: number | null; differenceLabel: string }): string {
  const tail = o.pctOfPrice != null ? `${o.pctOfPrice}% do preço` : o.differenceLabel
  return [o.artworkTitle, o.buyer, tail].filter(Boolean).join(' · ')
}

/** "46 salvos · 214 curtidas · 2 ofertas" under a most-viewed work. */
export function topStats(s: { saves: number; likes: number; openOffers: number }): string {
  return [
    `${s.saves} ${s.saves === 1 ? 'salvo' : 'salvos'}`,
    `${s.likes} ${s.likes === 1 ? 'curtida' : 'curtidas'}`,
    `${s.openOffers} ${s.openOffers === 1 ? 'oferta' : 'ofertas'}`,
  ].join(' · ')
}
