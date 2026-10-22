// Thin fetch over the HouseArt API: bearer from the secure store on every call.
import { API_URL, CLIENT_HEADER } from '@/config'
import { readToken } from '@/auth/token-store'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  /** Overrides the stored token (login flows pass the fresh one). */
  token?: string | null
  /** Skip the bearer entirely (login, code start). */
  anonymous?: boolean
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json', ...CLIENT_HEADER }
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  if (!opts.anonymous) {
    const token = opts.token ?? (await readToken())
    if (token) headers.authorization = `Bearer ${token}`
  }
  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })
  const text = await res.text()
  let data: unknown = null
  try { data = text ? JSON.parse(text) : null } catch { data = null }
  if (!res.ok) {
    const msg = (data as { error?: unknown } | null)?.error
    throw new ApiError(typeof msg === 'string' ? msg : `Falha (${res.status})`, res.status)
  }
  return data as T
}
