// The panel pages' session: redirect to /login without session, to
// /profiles without an active profile. Called by every page under (panel)
// (the layout is not an authorization boundary in Next 16).
import { redirect } from 'next/navigation'
import { panelSession, type PanelSession } from '@/lib/auth/panel'
import { activeNavProfile } from '@/lib/profiles/server'
import type { ProfileKind } from '@/lib/profiles/nav'

export interface PanelPage extends PanelSession { nav: ProfileKind }

export async function requirePanelPage(next: string): Promise<PanelPage> {
  const s = await panelSession()
  if (!s) redirect(`/login?next=${encodeURIComponent(next)}`)
  const nav = await activeNavProfile(s.user)
  if (!nav) redirect(`/profiles?next=${encodeURIComponent(next)}`)
  return { ...s, nav }
}
