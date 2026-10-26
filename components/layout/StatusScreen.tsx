import Link from 'next/link'
import type { ReactNode } from 'react'
import { Icon } from '@/components/ds/Icon'

/**
 * The screen of a state that is not the page (not found, error): icon, display
 * title, one sentence and at most two actions — the empty-state pattern of the
 * handoff design system. Works inside the panel shell and on its own.
 */
export function StatusScreen({ icon, title, text, children, code }: { icon: string; title: string; text: string; children?: ReactNode; code?: string }) {
  return (
    <div className="ha-status">
      <span className="ha-status__icon" aria-hidden="true"><Icon name={icon} size={28} /></span>
      <h1 className="ha-h2 ha-status__title">{title}</h1>
      <p className="ha-muted ha-status__text">{text}</p>
      {children ? <div className="ha-status__actions">{children}</div> : null}
      {code ? <p className="ha-caption ha-status__code">Código para o suporte: <span className="ha-id">{code}</span></p> : null}
    </div>
  )
}

export function HomeLink({ label = 'Ir para o início' }: { label?: string }) {
  return <Link href="/" className="ha-btn ha-btn--outline ha-btn--md">{label}</Link>
}
