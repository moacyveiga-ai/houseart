/** Only a same-site path is accepted as `next` (no open redirect). */
export function safeNext(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\') || /[\r\n]/.test(raw)) return null
  return raw.length > 500 ? null : raw
}
