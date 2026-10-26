'use client'
// The detail side panel of the logged web (handoff README §7, "Web Galeria"/"Web Colecionador"):
// 600 px on the right under the top bar, over the list that stays visible; back arrow + title,
// scrolling body, fixed footer for the actions. Driven by the URL (the page renders it when the
// list's query names an item); closing goes to `closeHref`. Esc closes; focus moves in on open
// and back to the page on close. Not modal: the list behind stays usable (clicking another row
// swaps the panel), as in the prototype.
import { useEffect, useRef, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from './Icon'

export function SidePanel({ title, closeHref, children, footer, actions, hideTitle = false }: { title: string; closeHref: string; children: ReactNode; footer?: ReactNode; actions?: ReactNode; hideTitle?: boolean }) {
  const router = useRouter()
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null
    ref.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return
      // Esc while typing clears the field, never throws away what was typed in the panel
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName))) return
      // a dialog opened from inside the panel closes first
      if (document.querySelector('.ha-scrim')) return
      router.replace(closeHref, { scroll: false })
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      // switching rows: focus the row now open (marked aria-current) so the next close comes back to it
      const current = document.querySelector<HTMLElement>('a[aria-current="true"]')
      const to = current ?? (back && document.contains(back) ? back : null)
      to?.focus({ preventScroll: true })
    }
  }, [closeHref, router, title])
  return (
    <aside ref={ref} className="ha-sidepanel" role="dialog" aria-modal="false" aria-label={title} tabIndex={-1}>
      <div className="ha-sidepanel__head">
        <button type="button" className="ha-sidepanel__back" aria-label="Fechar" onClick={() => router.replace(closeHref, { scroll: false })}><Icon name="arrow_back" size={24} /></button>
        <span className="ha-sidepanel__title">{hideTitle ? null : title}</span>
        {actions}
      </div>
      <div className="ha-sidepanel__body">{children}</div>
      {footer ? <div className="ha-sidepanel__foot">{footer}</div> : null}
    </aside>
  )
}
