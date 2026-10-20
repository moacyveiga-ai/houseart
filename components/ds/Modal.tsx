'use client'
import { useEffect, type ReactNode } from 'react'
import { Icon } from './Icon'

export function Modal({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="ha-scrim" onClick={onClose} role="presentation">
      <div className="ha-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="ha-modal__head">
          <h2 className="ha-h3">{title}</h2>
          <button type="button" className="ha-btn ha-btn--ghost ha-btn--xs" onClick={onClose} aria-label="Fechar"><Icon name="close" /></button>
        </div>
        <div className="ha-modal__body">{children}</div>
        {footer ? <div className="ha-modal__foot">{footer}</div> : null}
      </div>
    </div>
  )
}
