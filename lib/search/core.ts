// Search — pure helpers.
export const QUERY_MAX = 80

export function normalizeQuery(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, ' ').trim().slice(0, QUERY_MAX)
}

/** "HA-2025-2B8D-4R1X" (any case, with or without dashes) — then only artworks are searched. */
export function looksLikePublicId(q: string): boolean {
  return /^ha-?\d{4}-?[0-9a-z]{4}-?[0-9a-z]{4}$/i.test(q.replace(/\s/g, ''))
}
