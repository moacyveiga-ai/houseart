import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { panelSession } from '@/lib/auth/panel'
import { activeNavProfile, profilesOf } from '@/lib/profiles/server'
import { initialsOf, navProfileOf } from '@/lib/profiles/core'
import { activeNavKey } from '@/lib/profiles/nav'
import { headers } from 'next/headers'
import { unreadCount } from '@/lib/notifications/server'
import { unreadMessages } from '@/lib/messaging/server'

// The shell only; each page calls requirePanelPage() (authorization lives in the page).
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const s = await panelSession()
  const nav = s ? await activeNavProfile(s.user) : null
  if (!s || !nav) return <>{children}</>
  const h = await headers()
  const pathname = h.get('x-pathname') ?? '/'
  // Counters of the shell (bell + "Mensagens" badge) — best-effort, never block the page.
  const [bell, messages, cards] = await Promise.all([unreadCount(s.user.id).catch(() => 0), unreadMessages(s.user.id).catch(() => 0), profilesOf(s.user).catch(() => [])])
  const profiles = cards.map((c) => ({ kind: c.kind, name: c.name, icon: c.icon, active: navProfileOf(c.kind) === nav }))
  return (
    <AppShell user={{ initials: initialsOf(s.user.name), profile: nav, name: s.user.name }} profiles={profiles} activeKey={activeNavKey(nav, pathname)} bell={bell} badges={messages ? { messages } : {}}>
      {children}
    </AppShell>
  )
}
