'use client'
import { useEffect } from 'react'

export function Toast({ message, onDone, ms = 3200 }: { message: string; onDone: () => void; ms?: number }) {
  useEffect(() => {
    if (!message) return
    const t = window.setTimeout(onDone, ms)
    return () => window.clearTimeout(t)
  }, [message, ms, onDone])
  if (!message) return null
  return <div className="ha-toast" role="status" aria-live="polite">{message}</div>
}
