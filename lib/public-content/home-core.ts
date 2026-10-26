// Pure rules of the public Home (HouseArt Home.dc.html): the month tabs of the
// agenda, the day/month of an event, the colour of each kind and the filter —
// what the prototype's Home.js did with example data, here over the database.
import { diaNoFuso } from '@/lib/timezone'
import { AGENDA_KIND_LABELS, AGENDA_KINDS, type AgendaKind } from './domain'

const MONTHS_LONG = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** 'YYYY-MM' of `now` in the house timezone (UTC−3). */
export function monthKeyOf(now: Date): string {
  return (diaNoFuso(now) ?? now.toISOString()).slice(0, 7)
}

export interface MonthTab { key: string; label: string }

/** `months` tabs from `fromMonth` ('YYYY-MM'): "Novembro 2026", "Dezembro 2026", "Janeiro 2027"… */
export function monthTabs(fromMonth: string, months = 4): MonthTab[] {
  const [y, m] = fromMonth.split('-').map(Number)
  return Array.from({ length: months }, (_, i) => {
    const idx = m - 1 + i
    const year = y + Math.floor(idx / 12)
    const month = idx % 12
    return { key: `${year}-${String(month + 1).padStart(2, '0')}`, label: `${MONTHS_LONG[month]} ${year}` }
  })
}

/** '2026-11-05' → { day: '05', mon: 'nov' } for the date block of the agenda row. */
export function dayPartsOf(startsOn: string): { day: string; mon: string } {
  const [, m, d] = startsOn.split('-')
  return { day: d ?? '', mon: MONTHS_SHORT[Number(m) - 1] ?? '' }
}

/** The prototype's TIPO_COR: pill background and ink per kind (tokens only). */
export const AGENDA_KIND_STYLE: Record<AgendaKind, { bg: string; fg: string }> = {
  FAIR: { bg: 'var(--ha-ink-900)', fg: 'var(--ha-paper-50)' },
  EXHIBITION: { bg: 'var(--ha-paper-200)', fg: 'var(--ha-ink-900)' },
  OPENING: { bg: 'var(--ha-sand-500)', fg: 'var(--ha-ink-900)' },
  AUCTION: { bg: 'var(--ha-verified-100)', fg: 'var(--ha-verified-500)' },
}

/** The chips: "Todos" (null) and one per kind, in the prototype's order. */
export const AGENDA_FILTERS: { key: AgendaKind | null; label: string }[] = [{ key: null, label: 'Todos' }, ...AGENDA_KINDS.map((k) => ({ key: k, label: AGENDA_KIND_LABELS[k] }))]

export const isAgendaKind = (k: string): k is AgendaKind => (AGENDA_KINDS as readonly string[]).includes(k)

/** Events of `monthKey` with the chosen kind (null = all). */
export function filterAgenda<T extends { startsOn: string; kind: string }>(items: T[], monthKey: string, kind: AgendaKind | null): T[] {
  return items.filter((e) => e.startsOn.startsWith(monthKey) && (kind === null || e.kind === kind))
}

/** The first tab that has an event, or the first tab: the page opens where there is something to read. */
export function initialMonth(tabs: MonthTab[], items: { startsOn: string }[]): string {
  return tabs.find((t) => items.some((e) => e.startsOn.startsWith(t.key)))?.key ?? tabs[0]?.key ?? ''
}

/** "18 out 2026" for the news eyebrow. `publishedAt` is a calendar date stored at midnight UTC (lib/dates.ts): read the UTC parts, never shift it. */
export function newsDateLabel(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/** The Home hero never puts the brand over a work (handoff §4.5): the background is an exhibition
 *  room of an active gallery, the gallery's own cover as the fallback, or nothing (the gradient alone). */
export interface HeroPhoto { url: string; gallery: string; room: string | null }
export function heroCaption(h: HeroPhoto | null): string | null {
  if (!h) return null
  return [h.room ?? 'Sala de exposição', h.gallery, 'foto ilustrativa'].join(' · ')
}
