// Session state for the whole app: token in the secure store, `me` from the
// API, cookie mirrored for the WebView. One provider at the root layout.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, ApiError } from '@/api/client'
import { clearSessionCookies, setSessionCookie } from './cookies'
import { clearToken, readToken, writeToken } from './token-store'
import { isProfileKind, type Me, type ProfileCard, type ProfileKind } from './types'

type Status = 'loading' | 'signed-out' | 'signed-in'

interface SessionState {
  status: Status
  me: Me | null
  /** Profiles the account may use (for the chooser). */
  profiles: ProfileCard[]
  signInWithPassword: (credential: string, password: string) => Promise<void>
  startCode: (email: string) => Promise<string>
  verifyCode: (token: string, code: string) => Promise<void>
  switchProfile: (kind: ProfileKind) => Promise<void>
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<SessionState | null>(null)

interface LoginBody { ok: boolean; token?: string; user?: Partial<Me>; error?: string }

function normalizeMe(raw: Me): Me {
  return { ...raw, activeProfileKind: isProfileKind(raw.activeProfileKind) ? raw.activeProfileKind : null }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading')
  const [me, setMe] = useState<Me | null>(null)
  const [profiles, setProfiles] = useState<ProfileCard[]>([])

  const loadMe = useCallback(async (token: string) => {
    const raw = await api<Me>('/api/auth/me', { token })
    const user = normalizeMe(raw)
    const p = await api<{ active: string | null; profiles: ProfileCard[] }>('/api/profiles', { token }).catch(() => ({ active: null, profiles: [] as ProfileCard[] }))
    await setSessionCookie(token)
    setMe(user)
    setProfiles(p.profiles)
    setStatus('signed-in')
  }, [])

  const dropSession = useCallback(async () => {
    await clearToken()
    await clearSessionCookies()
    setMe(null)
    setProfiles([])
    setStatus('signed-out')
  }, [])

  const refresh = useCallback(async () => {
    const token = await readToken()
    if (!token) { await dropSession(); return }
    try { await loadMe(token) } catch (e) {
      // 401 = the session died server-side; anything else keeps what we have (offline).
      if (e instanceof ApiError && e.status === 401) await dropSession()
      else if (status === 'loading') setStatus(me ? 'signed-in' : 'signed-out')
    }
  }, [dropSession, loadMe, me, status])

  useEffect(() => { void refresh() // eslint-disable-line react-hooks/exhaustive-deps
  }, [])

  const adopt = useCallback(async (body: LoginBody) => {
    if (!body.ok || !body.token) throw new Error(body.error ?? 'Não foi possível entrar.')
    await writeToken(body.token)
    await loadMe(body.token)
  }, [loadMe])

  const signInWithPassword = useCallback(async (credential: string, password: string) => {
    const body = await api<LoginBody>('/api/auth/login', { body: { credential, password, remember: true }, anonymous: true })
    await adopt(body)
  }, [adopt])

  const startCode = useCallback(async (email: string) => {
    const r = await api<{ ok: boolean; token?: string; error?: string }>('/api/auth/code/start', { body: { email }, anonymous: true })
    if (!r.ok || !r.token) throw new Error(r.error ?? 'Não foi possível enviar o código.')
    return r.token
  }, [])

  const verifyCode = useCallback(async (token: string, code: string) => {
    const body = await api<LoginBody>('/api/auth/code/verify', { body: { token, code }, anonymous: true })
    await adopt(body)
  }, [adopt])

  const switchProfile = useCallback(async (kind: ProfileKind) => {
    await api('/api/profiles', { body: { kind } })
    setMe((m) => (m ? { ...m, activeProfileKind: kind } : m))
  }, [])

  const signOut = useCallback(async () => {
    // The route reads the cookie; the cookie jar of the app carries it, and the
    // bearer goes too (README lists the API adjustment to honour it).
    await api('/api/auth/logout', { method: 'POST', body: {} }).catch(() => undefined)
    await dropSession()
  }, [dropSession])

  const value = useMemo<SessionState>(() => ({ status, me, profiles, signInWithPassword, startCode, verifyCode, switchProfile, refresh, signOut }),
    [status, me, profiles, signInWithPassword, startCode, verifyCode, switchProfile, refresh, signOut])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession(): SessionState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSession fora do SessionProvider')
  return v
}
