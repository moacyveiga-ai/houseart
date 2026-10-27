// "Buscas recentes" of the search screen (audit colecionador §229, the `recentes` of the prototype):
// the last five terms, newest first, a repeated term moves to the top. Pure — the screen keeps the
// list in this viewer's localStorage (a per-viewer convenience; nothing reaches the server).
export const RECENT_KEY = 'ha-search-recent'
/** One list per account: two people on the same browser never see each other's searches. */
export const recentKeyOf = (userId: number) => `${RECENT_KEY}:${userId}`
export const RECENT_MAX = 5
const TERM_MAX = 120

const same = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }) === 0

/** The stored list, defensively: anything that is not an array of short strings reads as empty. */
export function parseRecent(raw: string | null): string[] {
  if (!raw) return []
  try {
    const v: unknown = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === 'string' && t.trim().length > 0).map((t) => t.trim().slice(0, TERM_MAX)).slice(0, RECENT_MAX) : []
  } catch { return [] }
}

export function pushRecent(list: readonly string[], term: string): string[] {
  const t = term.trim().slice(0, TERM_MAX)
  if (!t) return [...list]
  return [t, ...list.filter((x) => !same(x, t))].slice(0, RECENT_MAX)
}

export function removeRecent(list: readonly string[], term: string): string[] {
  return list.filter((x) => !same(x, term))
}
