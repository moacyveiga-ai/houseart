'use client'
// "Falar com a galeria" of the public artwork page (handoff "HouseArt Obra"):
// opens (or finds) the conversation about the artwork and goes to it. Without
// a session, the link goes to /login and comes back here. With `dealId` it is
// the purchase's "Falar com o vendedor": the conversation with who SOLD (the
// deal's seller), not the artwork's current holder. With `gallery` (the public
// page's slug) it is "Falar com a galeria": a conversation without artwork.
import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type Target = { artworkId: number; publicId: string; dealId?: undefined; gallery?: undefined }
  | { dealId: number; artworkId?: undefined; publicId?: undefined; gallery?: undefined }
  | { gallery: string; artworkId?: undefined; publicId?: undefined; dealId?: undefined }

export function TalkToSellerButton(props: Target & { signedIn: boolean; label: ReactNode; className: string }) {
  const { signedIn, label, className } = props
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const back = props.dealId != null ? '/purchases' : props.gallery != null ? `/e/gallery/${props.gallery}` : `/e/artwork/${props.publicId}`
  if (!signedIn) return <Link href={`/login?next=${encodeURIComponent(back)}`} className={className}>{label}</Link>
  const open = async () => {
    if (busy) return
    setBusy(true); setError(null)
    try {
      const r = props.dealId != null
        ? await fetch(`/api/deals/${props.dealId}/conversation`, { method: 'POST' })
        : await fetch('/api/messages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(props.gallery != null ? { gallery: props.gallery } : { artworkId: props.artworkId }) })
      const j = (await r.json().catch(() => ({}))) as { id?: number; error?: string }
      if (r.status === 401) { router.push(`/login?next=${encodeURIComponent(back)}`); return }
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
