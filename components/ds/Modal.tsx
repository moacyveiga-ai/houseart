'use client'
import { useRef, type ReactNode } from 'react'
import { Icon } from './Icon'
import { useDialogFocus } from './useDialogFocus'

export function Modal({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  useDialogFocus(box, open, onClose)
  if (!open) return null
  return (
    <div className="ha-scrim" onClick={onClose} role="presentation">
      <div ref={box} tabIndex={-1} className="ha-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="ha-modal__head">
          <h2 className="ha-h3">{title}</h2>
          <button type="button" className="ha-btn ha-btn--ghost ha-btn--xs ha-modal__close" onClick={onClose} aria-label="Fechar"><Icon name="close" /></button>
        </div>
        <div className="ha-modal__body">{children}</div>
        {footer ? <div className="ha-modal__foot">{footer}</div> : null}
      </div>
    </div>
  )
}
