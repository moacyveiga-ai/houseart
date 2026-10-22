'use client'
// Compartilhar obra (handoff "HouseArt App Colecionador" › Compartilhar obra, `sh === 'share'`):
// a sheet with the artwork card (wall · title · artist · year · link), the channel grid,
// the message and the note "O link abre a página pública…". No API: the Web Share API when
// the browser has it, else copy / WhatsApp / Facebook / X / Pinterest / LinkedIn / Telegram /
// e-mail / SMS by their public share URLs. The link is `<origin>/e/artwork/<publicId>`.
import { useEffect, useState, type ReactNode } from 'react'
import { Icon } from '@/components/ds/Icon'
import './share-sheet.css'

export interface ShareArtwork { publicId: string; title: string; artist: string; year: number | null; cover: string | null; price?: string | null }

type Channel = { key: string; name: string; icon?: string; txt?: string; href?: (url: string, text: string) => string; native?: boolean; copy?: boolean }

const CHANNELS: Channel[] = [
  { key: 'whatsapp', name: 'WhatsApp', icon: 'chat', href: (u, t) => `https://wa.me/?text=${encodeURIComponent(`${t} ${u}`)}` },
  { key: 'facebook', name: 'Facebook', txt: 'f', href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
  { key: 'x', name: 'X', txt: 'X', href: (u, t) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(t)}&url=${encodeURIComponent(u)}` },
  { key: 'pinterest', name: 'Pinterest', txt: 'P', href: (u, t) => `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(u)}&description=${encodeURIComponent(t)}` },
  { key: 'linkedin', name: 'LinkedIn', txt: 'in', href: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}` },
  { key: 'telegram', name: 'Telegram', icon: 'send', href: (u, t) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(t)}` },
  { key: 'email', name: 'E-mail', icon: 'mail', href: (u, t) => `mailto:?subject=${encodeURIComponent('Uma obra na HouseArt')}&body=${encodeURIComponent(`${t}\n${u}`)}` },
  { key: 'sms', name: 'SMS', icon: 'sms', href: (u, t) => `sms:?body=${encodeURIComponent(`${t} ${u}`)}` },
  { key: 'copy', name: 'Copiar link', icon: 'link', copy: true },
  { key: 'more', name: 'Mais', icon: 'more_horiz', native: true },
]

export function shareUrlOf(publicId: string): string {
  return `${typeof window === 'undefined' ? '' : window.location.origin}/e/artwork/${publicId}`
}
export const defaultShareMessage = (a: ShareArtwork) => `Olha esta obra: ${a.title}, de ${a.artist}, certificada na HouseArt.`

export function ShareSheet({ artwork: a, open, onClose, onDone }: { artwork: ShareArtwork; open: boolean; onClose: () => void; onDone?: (message: string) => void }) {
  const [msg, setMsg] = useState(() => defaultShareMessage(a))
  const [showPrice, setShowPrice] = useState(true)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  // Rendered only after a click (never on the server), so the browser is known here.
  const canNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  const url = shareUrlOf(a.publicId)
  const shown = url.replace(/^https?:\/\//, '')
  const text = showPrice && a.price ? `${msg} ${a.price}.` : msg
  async function go(c: Channel) {
    if (c.copy) {
      try { await navigator.clipboard.writeText(url); onDone?.(`Link copiado · ${shown}`) } catch { onDone?.(url) }
      onClose(); return
    }
    if (c.native) {
      if (typeof navigator.share === 'function') { try { await navigator.share({ title: a.title, text, url }) } catch { /* cancelled */ } }
      else { try { await navigator.clipboard.writeText(url); onDone?.(`Link copiado · ${shown}`) } catch { onDone?.(url) } }
      onClose(); return
    }
    if (c.href) { window.open(c.href(url, text), '_blank', 'noopener,noreferrer'); onDone?.(`Abrindo ${c.name} com a mensagem e o link`); onClose() }
  }
  // 'Mais' only when the browser has the Web Share API (the prototype's 'menu do celular').
  const channels = CHANNELS.filter((c) => !c.native || canNative)
  return (
    <div className="ha-scrim ha-share-scrim" onClick={onClose} role="presentation">
      <div className="ha-share" role="dialog" aria-modal="true" aria-label="Compartilhar obra" onClick={(e) => e.stopPropagation()}>
        <div className="ha-share__head">
          <span className="ha-share__title">Compartilhar obra</span>
          <button type="button" className="ha-iconbtn" aria-label="Fechar" onClick={onClose}><Icon name="close" size={22} /></button>
        </div>
        <div className="ha-share__card">
          <span className="ha-wall ha-wall--72 ha-share__wall">
            {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
            {a.cover ? <img src={a.cover} alt="" /> : null}
          </span>
          <span className="ha-stack ha-share__txt">
            <i className="ha-share__t">{a.title}</i>
            <span className="ha-share__s">{a.artist}{a.year ? ` · ${a.year}` : ''}{showPrice && a.price ? ` · ${a.price}` : ''}</span>
            <span className="ha-share__link">{shown}</span>
          </span>
        </div>
        <div className="ha-share__grid">
          {channels.map((c) => (
            <button key={c.key} type="button" className="ha-share__ch" onClick={() => go(c)}>
              <span className="ha-share__circle">{c.icon ? <Icon name={c.icon} size={24} /> : <span className={`ha-share__letter${(c.txt?.length ?? 0) > 1 ? ' ha-share__letter--sm' : ''}`}>{c.txt}</span>}</span>
              <span className="ha-share__name">{c.name}</span>
            </button>
          ))}
        </div>
        <label className="ha-share__field">Mensagem<textarea className="ha-share__msg" rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} /></label>
        {a.price ? (
          <div className="ha-share__opts">
            <button type="button" className="ha-share__opt" onClick={() => setShowPrice((v) => !v)} role="switch" aria-checked={showPrice}>
              <span className="ha-stack"><span className="ha-share__opt-n">Mostrar o preço</span><span className="ha-share__opt-s">Aparece na mensagem enviada</span></span>
              <span className={`ha-toggle${showPrice ? ' ha-toggle--on' : ''}`} aria-hidden="true" />
            </button>
          </div>
        ) : null}
        <span className="ha-share__note"><Icon name="verified" size={16} />O link abre a página pública com certificado, proveniência e botão de compra. Funciona mesmo para quem não tem a HouseArt.</span>
      </div>
    </div>
  )
}

/** A button that opens the sheet (the public artwork page; the cards use the sheet directly). */
export function ShareButton({ artwork, className = 'ha-btn ha-btn--outline ha-btn--sm', children }: { artwork: ShareArtwork; className?: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [toast, setToast] = useState('')
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(''), 3200); return () => window.clearTimeout(t) }, [toast])
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}><Icon name="share" size={18} />{children ?? 'Compartilhar'}</button>
      <ShareSheet artwork={artwork} open={open} onClose={() => setOpen(false)} onDone={setToast} />
      {toast ? <div className="ha-toast" role="status" aria-live="polite">{toast}</div> : null}
    </>
  )
}
