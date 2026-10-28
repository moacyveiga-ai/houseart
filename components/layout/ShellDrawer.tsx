'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { activeNavKey, type ProfileKind } from '@/lib/profiles/nav'

export interface DrawerItem { key: string; href: string; label: string; icon: string; badge?: number; on: boolean }

/**
 * The navigation of the panel below 1024 px (handoff §7: the side panel layout
 * stacks under ~1024): a menu button in the topbar opens a 280 px drawer with
 * the search and the profile's NAV. Esc, the scrim and any navigation close it;
 * focus goes into the drawer and back to the button (240 ms, the panel speed).
 */
export function ShellDrawer({ profile, items }: { profile: ProfileKind; items: DrawerItem[] }) {
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const [lastPath, setLastPath] = useState(pathname)
  if (pathname !== lastPath) { setLastPath(pathname); setOpen(false) }
  // The active item follows the URL here too: the layout that passes `items` is not re-rendered on navigation.
  const activeKey = pathname ? activeNavKey(profile, pathname) : items.find((i) => i.on)?.key ?? null

  useEffect(() => {
    if (!open) return
    const first = panel.current?.querySelector<HTMLElement>('input, a, button')
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); button.current?.focus(); return }
      if (e.key !== 'Tab' || !panel.current) return
      const f = [...panel.current.querySelectorAll<HTMLElement>('a[href], button, input')]
      if (!f.length) return
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus() }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus() }
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open])

  return (
    <>
      <button ref={button} type="button" className="ha-btn ha-btn--ghost ha-btn--xs ha-menubtn" aria-label="Abrir menu" aria-expanded={open} onClick={() => setOpen(true)}>
        <Icon name="menu" />
      </button>
      {open ? (
        <div className="ha-drawer" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="ha-drawer__scrim" aria-label="Fechar menu" tabIndex={-1} onClick={() => { setOpen(false); button.current?.focus() }} />
          <div className="ha-drawer__panel" ref={panel}>
            <div className="ha-drawer__head">
              <span className="ha-eyebrow">Menu</span>
              <button type="button" className="ha-btn ha-btn--ghost ha-btn--xs" aria-label="Fechar menu" onClick={() => { setOpen(false); button.current?.focus() }}><Icon name="close" /></button>
            </div>
            <form className="ha-drawer__search" role="search" action="/search">
              <Icon name="search" size={20} />
              <input name="q" className="ha-topbar__input" placeholder="Buscar obras, artistas, galerias ou IDs" aria-label="Buscar" />
            </form>
            <nav aria-label="Principal" className="ha-drawer__nav">
              {items.map((item) => (
                <Link key={item.key} href={item.href} className={`ha-nav-item${item.key === activeKey ? ' ha-nav-item--on' : ''}`} aria-current={item.key === activeKey ? 'page' : undefined}>
                  <Icon name={item.icon} size={20} />
                  <span>{item.label}</span>
                  {item.badge ? <span className="ha-nav-badge">{item.badge}</span> : null}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  )
}
