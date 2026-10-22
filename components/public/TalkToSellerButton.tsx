'use client'
// "Falar com a galeria" of the public artwork page (handoff "HouseArt Obra"):
// opens (or finds) the conversation about the artwork and goes to it. Without
// a session, the link goes to /login and comes back here.
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export function TalkToSellerButton({ artworkId, publicId, signedIn, label, className }: { artworkId: number; publicId: string; signedIn: boolean; label: string; className: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!signedIn) return <Link href={`/login?next=${encodeURIComponent(`/e/artwork/${publicId}`)}`} className={className}>{label}</Link>
  const open = async () => {
    if (busy) return
    setBusy(true); setError(null)
    try {
      const r = await fetch('/api/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ artworkId }) })
      const j = (await r.json().catch(() => ({}))) as { id?: number; error?: string }
      if (r.status === 401) { router.push(`/login?next=${encodeURIComponent(`/e/artwork/${publicId}`)}`); return }
      if (!r.ok || !j.id) { setError(j.error ?? 'Não foi possível abrir a conversa.'); return }
      router.push(`/messages/${j.id}`)
    } catch { setError('Não foi possível abrir a conversa.') } finally { setBusy(false) }
  }
  return (
    <>
      <button type="button" className={className} onClick={open} disabled={busy} aria-busy={busy || undefined}>{label}</button>
      {error ? <span className="ha-field-error" role="alert">{error}</span> : null}
    </>
  )
}
