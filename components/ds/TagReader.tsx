// tag-reader · tap-confirm (organismo, mobile): lendo (anel sand pulsando, dois
// anéis defasados 600 ms) · válida (verified + check) · removida (alert + link_off)
// · confirmar recebimento (paper-100, contactless, botão color).
import type { ReactNode } from 'react'
import { Icon } from './Icon'

export type ReaderState = 'reading' | 'valid' | 'removed' | 'confirm'

export function TagReader({ state, title, subtitle, children }: { state: ReaderState; title: string; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <div className={`ha-reader${state === 'confirm' ? ' ha-reader--confirm' : ''}`} role="status" aria-live="polite">
      {state === 'reading' ? (
        <div className="ha-reader__ring"><span className="ha-reader__pulse" /><span className="ha-reader__pulse ha-reader__pulse--late" /><span className="ha-reader__core"><Icon name="contactless" size={32} /></span></div>
      ) : state === 'valid' ? (
        <div className="ha-reader__ring ha-reader__ring--valid"><Icon name="check" size={48} /></div>
      ) : state === 'removed' ? (
        <div className="ha-reader__ring ha-reader__ring--removed"><Icon name="link_off" size={48} /></div>
      ) : (
        <div className="ha-reader__ring ha-reader__ring--idle"><Icon name="contactless" size={44} /></div>
      )}
      <div><div className="ha-reader__title">{title}</div>{subtitle ? <div className="ha-reader__sub">{subtitle}</div> : null}</div>
      {children}
    </div>
  )
}
