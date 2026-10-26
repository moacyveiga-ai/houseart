'use client'
// "Compartilhar" on the artist's public page: the system share sheet where it
// exists, else copies the link (the artwork ShareSheet is per artwork).
import { useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Toast } from '@/components/ds/Toast'

export function ArtistShare({ name, slug }: { name: string; slug: string }) {
  const [toast, setToast] = useState('')
  async function share() {
    const url = `${window.location.origin}/e/artist/${slug}?utm_source=share&utm_medium=artist`
    try {
      if (navigator.share) { await navigator.share({ title: `${name} na HouseArt`, url }); return }
      await navigator.clipboard.writeText(url)
      setToast('Link copiado')
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') setToast('Não foi possível compartilhar agora.')
    }
  }
  return (
    <>
      <button type="button" className="hp-artist-share" aria-label={`Compartilhar ${name}`} onClick={share}><Icon name="ios_share" size={20} /></button>
      <Toast message={toast} onDone={() => setToast('')} />
    </>
  )
}
