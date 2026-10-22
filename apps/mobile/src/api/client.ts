// Thin fetch over the HouseArt API: bearer from the secure store on every call.
import { API_URL, CLIENT_HEADER } from '@/config'
import { readToken } from '@/auth/token-store'

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) { super(message); this.status = status }
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
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

/** A file the app has on disk (camera or library): React Native's FormData takes `{ uri, name, type }`. */
export interface LocalFile { uri: string; name: string; type: string }

/**
 * multipart/form-data POST with the bearer (the fetch sets the boundary; never
 * set `content-type` by hand). Used by the photo upload of "Nova obra".
 */
export async function apiUpload<T = unknown>(path: string, fields: Record<string, string>, file: LocalFile): Promise<T> {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.append(k, v)
  // RN's FormData accepts this shape for a file part; the DOM typing does not know it.
  form.append('file', file as unknown as Blob)
  const headers: Record<string, string> = { accept: 'application/json', ...CLIENT_HEADER }
  const token = await readToken()
  if (token) headers.authorization = `Bearer ${token}`
  const res = await fetch(`${API_URL}${path}`, { method: 'POST', headers, body: form })
  const text = await res.text()
  let data: unknown = null
  try { data = text ? JSON.parse(text) : null } catch { data = null }
  if (!res.ok) {
    const msg = (data as { error?: unknown } | null)?.error
    throw new ApiError(typeof msg === 'string' ? msg : `Falha (${res.status})`, res.status)
  }
  return data as T
}
