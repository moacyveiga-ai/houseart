import Link from 'next/link'
import type { ReactNode } from 'react'
import { Icon } from '@/components/ds/Icon'
import { HouseArtLogo } from './HouseArtLogo'
import { accountHrefOf, HELP_HREF, NAV, PROFILE_LABELS, type ProfileKind } from '@/lib/profiles/nav'
import { ShellDrawer } from './ShellDrawer'
import { SidebarNav } from './SidebarNav'
import { ProfileSwapPill, ProfileSwitcher, type SwitcherProfile } from './ProfileSwitcher'

export interface ShellUser { initials: string; profile: ProfileKind; name?: string
  /** what the profile chip says: the gallery's name for the gallery profile, else the person's */
  display?: string; avatarUrl?: string | null }
export type { SwitcherProfile }
import { IndexTicker, type TickerItem } from '@/components/ds/IndexTicker'
export type { TickerItem }

/**
 * The shell of the design: ticker (indices) → topbar 64px (logo 192px, search,
 * bell, profile switcher: initials + label + swap_horiz, a menu of the account's profiles) → sidebar 240px with
 * NAV[profile] and footer (links + Sair) → main with max-width var(--ha-max).
 * Badges per item come from the server (`badges`), never from the NAV.
 */
export function AppShell({ user, profiles = [], activeKey, badges = {}, bell = 0, ticker = [], children }: {
  user: ShellUser
  /** The account's profiles for the switcher (the active one marked). */
  profiles?: SwitcherProfile[]
  activeKey: string | null
  badges?: Record<string, number>
  /** Unread notifications (the dot on the bell); from the server. */
  bell?: number
  ticker?: TickerItem[]
  children: ReactNode
}) {
  const nav = NAV[user.profile]
  const accountHref = accountHrefOf(user.profile)
  const drawerItems = nav.map((item) => ({ key: item.key, href: item.href, label: item.label, icon: item.icon, badge: badges[item.key] || undefined, on: item.key === activeKey }))
  return (
    <div className="ha-shell">
      <IndexTicker items={ticker} />
      <header className="ha-topbar">
        <ShellDrawer profile={user.profile} items={drawerItems} />
        <Link href={nav[0].href} className="ha-topbar__brand"><HouseArtLogo version="simples_horiz" tone="auto-mono" height={24} /><span className="ha-topbar__system">{PROFILE_LABELS[user.profile]}</span></Link>
        <form className="ha-topbar__search" role="search" action="/search">
          <Icon name="search" size={20} />
          <input name="q" className="ha-topbar__input" placeholder="Buscar obras, artistas, galerias ou IDs" aria-label="Buscar" />
        </form>
        <div className="ha-topbar__right">
          <Link href="/notifications" className="ha-btn ha-btn--ghost ha-btn--xs ha-bell" aria-label={bell ? `Notificações, ${bell} não lidas` : 'Notificações'}><Icon name="notifications" />{bell ? <span className="ha-bell__dot" /> : null}</Link>
          <ProfileSwapPill profiles={profiles} />
          <ProfileSwitcher initials={user.initials} label={PROFILE_LABELS[user.profile]} display={user.display} avatarUrl={user.avatarUrl ?? null} name={user.name} profiles={profiles} accountHref={accountHref} helpHref={HELP_HREF} />
        </div>
      </header>
      <div className="ha-body">
        <aside className="ha-sidebar">
          <SidebarNav profile={user.profile} badges={badges} initialKey={activeKey} />
        </aside>
        <main className="ha-main"><div className="ha-main__inner">{children}</div></main>
      </div>
    </div>
  )
}
