// The badge of the Mensagens tab: GET /api/messages/unread every 30 s while
// the app is in the foreground (and once when it comes back).
import { useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { api } from './client'

const UNREAD_MS = 30_000

export function useUnreadMessages(enabled: boolean): number {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!enabled) { setN(0); return }
    let alive = true
    let timer: ReturnType<typeof setInterval> | null = null
    const tick = () => { api<{ unread: number }>('/api/messages/unread').then((r) => { if (alive) setN(r.unread) }).catch(() => undefined) }
    const start = () => { if (timer) return; tick(); timer = setInterval(tick, UNREAD_MS) }
    const stop = () => { if (timer) { clearInterval(timer); timer = null } }
    if (AppState.currentState === 'active' || AppState.currentState === 'unknown') start()
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') start(); else stop() })
    return () => { alive = false; stop(); sub.remove() }
  }, [enabled])
  return n
}
