// A small loader over `api()`: loading / error / data / reload. Screens stay
// declarative; the error text is the one the API sent (or a generic line).
import { useCallback, useEffect, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { api } from './client'

export interface Loaded<T> { data: T | null; error: string | null; loading: boolean; reload: () => Promise<void> }

export function useApi<T>(path: string | null): Loaded<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!path)
  const seq = useRef(0)
  const reload = useCallback(async () => {
    if (!path) return
    const n = ++seq.current
    setLoading(true)
    try {
      const d = await api<T>(path)
      if (n === seq.current) { setData(d); setError(null) }
    } catch (e) {
      if (n === seq.current) setError((e as Error).message || 'Não foi possível carregar.')
    } finally { if (n === seq.current) setLoading(false) }
  }, [path])
  useEffect(() => { void reload() }, [reload])
  return { data, error, loading, reload }
}

/** Reloads when the screen comes back into focus (not on the first focus, which `useApi` already loads). */
export function useReloadOnFocus(reload: () => Promise<void>): void {
  const first = useRef(true)
  useFocusEffect(useCallback(() => {
    if (first.current) { first.current = false; return }
    void reload()
  }, [reload]))
}
