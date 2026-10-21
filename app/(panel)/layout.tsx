import type { ReactNode } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { panelSession } from '@/lib/auth/panel'
import { activeNavProfile } from '@/lib/profiles/server'
import { initialsOf } from '@/lib/profiles/core'
import { activeNavKey } from '@/lib/profiles/nav'
import { headers } from 'next/headers'

// The shell only; each page calls requirePanelPage() (authorization lives in the page).
export default async function PanelLayout({ children }: { children: ReactNode }) {
  const s = await panelSession()
  const nav = s ? await activeNavProfile(s.user) : null
  if (!s || !nav) return <>{children}</>
  const h = await headers()
  const pathname = h.get('x-pathname') ?? '/'
  return (
    <AppShell user={{ initials: initialsOf(s.user.name), profile: nav, name: s.user.name }} activeKey={activeNavKey(nav, pathname)}>
      {children}
    </AppShell>
  )
}
