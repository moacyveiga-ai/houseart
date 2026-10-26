import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { panelSession, scopeOfSession } from '@/lib/auth/panel'
import { activeNavProfile, profilesOf } from '@/lib/profiles/server'
import { initialsOf, navProfileOf } from '@/lib/profiles/core'
import { activeNavKey } from '@/lib/profiles/nav'
import { headers } from 'next/headers'
import { unreadCount } from '@/lib/notifications/server'
import { navBadges } from '@/lib/nav-badges/server'
import { ScopeNotApplied } from '@/lib/scope/extension-core'
import { tickerItems } from '@/lib/market-indicators/server'

// The index strip is in the Web App prototype (artist, appraiser, advisor, admin); the Web Galeria and
// Web Colecionador prototypes have no strip.
const TICKER_PROFILES = new Set(['artist', 'appraiser', 'advisor', 'admin'])

// The shell only; each page calls requirePanelPage() (authorization lives in the page).
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const s = await panelSession()
  const nav = s ? await activeNavProfile(s.user) : null
  if (!s || !nav) return <>{children}</>
  const h = await headers()
  const pathname = h.get('x-pathname') ?? '/'
  // Counters of the shell (bell + the badges of the menu, lib/nav-badges) — best-effort, never block the page.
  const [bell, badges, cards, ticker] = await Promise.all([unreadCount(s.user.id).catch(() => 0), navBadges(nav, s.user, scopeOfSession(s.user)).catch((e: unknown) => { if (e instanceof ScopeNotApplied) throw e; return {} }), profilesOf(s.user).catch(() => []), TICKER_PROFILES.has(nav) ? tickerItems().catch(() => []) : []])
  const profiles = cards.map((c) => ({ kind: c.kind, name: c.name, icon: c.icon, active: navProfileOf(c.kind) === nav }))
  return (
    <AppShell user={{ initials: initialsOf(s.user.name), profile: nav, name: s.user.name }} profiles={profiles} activeKey={activeNavKey(nav, pathname)} bell={bell} ticker={ticker} badges={badges}>
      {children}
    </AppShell>
  )
}
