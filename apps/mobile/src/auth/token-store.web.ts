// Web build (the app simulator at /app): the session token lives in localStorage —
// there is no secure store in the browser. Same contract as token-store.ts.
const KEY = 'houseart.app.session.token'
const TOKEN_RE = /^[0-9a-f]{64}$/

export async function readToken(): Promise<string | null> {
  try { const v = window.localStorage.getItem(KEY); return v && TOKEN_RE.test(v) ? v : null } catch { return null }
}

export async function writeToken(token: string): Promise<void> {
  if (!TOKEN_RE.test(token)) throw new Error('Token de sessão inválido.')
  try { window.localStorage.setItem(KEY, token) } catch { /* private mode: session ends with the tab */ }
}

export async function clearToken(): Promise<void> {
  try { window.localStorage.removeItem(KEY) } catch { /* nothing to clear */ }
}
