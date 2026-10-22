'use client'
// The heart of the marketplace card: LIKE on the artwork (POST /api/community/reactions,
// optimistic, rolls back on error). Without a session it links to the login with `next`.
import Link from 'next/link'
import { useState } from 'react'
import { Icon } from '@/components/ds/Icon'

export function MarketCardLike({ artworkId, publicId, liked: initial, signedIn }: { artworkId: number | null; publicId: string; liked: boolean; signedIn: boolean }) {
  const [liked, setLiked] = useState(initial)
  const [busy, setBusy] = useState(false)
  if (!signedIn || artworkId === null) return <Link href={`/login?next=${encodeURIComponent(`/e/artwork/${publicId}`)}`} className="hp-market-card__fav" aria-label="Entre para curtir"><Icon name="favorite" size={18} /></Link>
  async function toggle() {
    const before = liked
    setLiked(!before); setBusy(true)
    const res = await fetch('/api/community/reactions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target: 'ARTWORK', targetId: artworkId, kind: 'LIKE' }) })
    setBusy(false)
    if (!res.ok) { setLiked(before); return }
    const data = (await res.json().catch(() => ({}))) as { on?: boolean }
    setLiked(!!data.on)
  }
  return <button type="button" className={`hp-market-card__fav${liked ? ' hp-market-card__fav--on' : ''}`} aria-label={liked ? 'Remover curtida' : 'Curtir'} aria-pressed={liked} disabled={busy} onClick={toggle}><Icon name="favorite" size={18} filled={liked} /></button>
}
