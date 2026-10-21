import Link from 'next/link'
import type { ReactNode } from 'react'
import { Icon } from '@/components/ds/Icon'
import { HouseArtLogo } from './HouseArtLogo'
import { NAV, PROFILE_LABELS, type ProfileKind } from '@/lib/profiles/nav'

export interface ShellUser { initials: string; profile: ProfileKind; name?: string }
import { IndexTicker, type TickerItem } from '@/components/ds/IndexTicker'
export type { TickerItem }

/**
 * The shell of the design: ticker (indices) → topbar 64px (logo 192px, search,
 * bell, profile button with initials + label + swap_horiz) → sidebar 240px with
 * NAV[profile] and footer (links + Sair) → main with max-width var(--ha-max).
 * Badges per item come from the server (`badges`), never from the NAV.
 */
export function AppShell({ user, activeKey, badges = {}, ticker = [], children }: {
  user: ShellUser
  activeKey: string | null
  badges?: Record<string, number>
  ticker?: TickerItem[]
  children: ReactNode
}) {
  const nav = NAV[user.profile]
  return (
    <div className="ha-shell">
      <IndexTicker items={ticker} />
      <header className="ha-topbar">
        <Link href={nav[0].href} className="ha-topbar__brand"><HouseArtLogo version="full_vert" height={48} /></Link>
        <form className="ha-topbar__search" role="search" action="/search">
          <Icon name="search" size={20} />
          <input name="q" className="ha-topbar__input" placeholder="Buscar obras, artistas, galerias ou IDs" aria-label="Buscar" />
        </form>
        <div className="ha-topbar__right">
          <Link href="/notifications" className="ha-btn ha-btn--ghost ha-btn--xs" aria-label="Notificações"><Icon name="notifications" /></Link>
          <Link href="/profiles" className="ha-profilebtn" aria-label="Trocar de perfil">
            <span className="ha-avatar">{user.initials}</span>
            <span className="ha-profilebtn__name">{PROFILE_LABELS[user.profile]}</span>
            <Icon name="swap_horiz" size={18} />
          </Link>
        </div>
      </header>
      <div className="ha-body">
        <aside className="ha-sidebar">
          <nav aria-label="Principal">
            {nav.map((item) => {
              const on = item.key === activeKey
              const badge = badges[item.key]
              return (
                <Link key={item.key} href={item.href} className={`ha-nav-item${on ? ' ha-nav-item--on' : ''}`} aria-current={on ? 'page' : undefined}>
                  <Icon name={item.icon} size={20} />
                  <span>{item.label}</span>
                  {badge ? <span className="ha-nav-badge">{badge}</span> : null}
                </Link>
              )
            })}
          </nav>
          <div className="ha-sidebar__foot">
            <Link href="/settings">Configurações</Link>
            <Link href="/help">Ajuda</Link>
            <form action="/api/auth/logout" method="post"><button type="submit" className="ha-sidebar__exit">Sair</button></form>
          </div>
        </aside>
        <main className="ha-main">{children}</main>
      </div>
    </div>
  )
}
