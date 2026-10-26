'use client'
// A reaction button of the public site (Seguir, Salvar): POST /api/community/reactions,
// optimistic with rollback. Without a session it sends to the login and back.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, type ReactNode } from 'react'

export function PublicReactButton({ target, targetId, kind, on: initial, signedIn, className, onClass, children, onChildren }: {
  target: 'MEMBER' | 'EVENT' | 'ARTWORK' | 'NEWS'; targetId: number; kind: 'FOLLOW' | 'SAVE' | 'LIKE'; on: boolean; signedIn: boolean
  className: string; onClass?: string; children: ReactNode; onChildren?: ReactNode
}) {
  const pathname = usePathname()
  const [on, setOn] = useState(initial)
  const [busy, setBusy] = useState(false)
  if (!signedIn) return <Link href={`/login?next=${encodeURIComponent(pathname)}`} className={className}>{children}</Link>
  async function toggle() {
    const before = on
    setOn(!before); setBusy(true)
    const res = await fetch('/api/community/reactions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target, targetId, kind }) })
    setBusy(false)
    if (!res.ok) { setOn(before); return }
    const data = (await res.json().catch(() => ({}))) as { on?: boolean }
    setOn(!!data.on)
  }
  return <button type="button" className={`${className}${on && onClass ? ` ${onClass}` : ''}`} aria-pressed={on} disabled={busy} onClick={toggle}>{on && onChildren ? onChildren : children}</button>
}
