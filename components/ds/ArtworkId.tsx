'use client'
// artwork-id (átomo): QR + ID tabular + "Copiar" (vira "Copiado" por 1,6 s).
import { useEffect, useRef, useState } from 'react'
import { Icon } from './Icon'

export function ArtworkId({ id, qr = true }: { id: string; qr?: boolean }) {
  const [copied, setCopied] = useState(false)
  const t = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(t.current), [])
  const copy = async () => {
    try { await navigator.clipboard.writeText(id) } catch { /* sem clipboard: o texto segue selecionável */ }
    setCopied(true)
    window.clearTimeout(t.current)
    t.current = window.setTimeout(() => setCopied(false), 1600)
  }
  return (
    <span className="ha-artwork-id">
      {qr ? <span className="ha-artwork-id__qr" aria-hidden="true" /> : null}
      <span className="ha-id">{id}</span>
      <button type="button" className="ha-artwork-id__copy" onClick={copy} aria-label="Copiar ID">
        <Icon name={copied ? 'check' : 'content_copy'} size={16} />{copied ? 'Copiado' : 'Copiar'}
      </button>
    </span>
  )
}
