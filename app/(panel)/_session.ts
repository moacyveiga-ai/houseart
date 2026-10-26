// The panel pages' session: redirect to /login without session; an account
// with no profile at all goes to the public site (there is no profile screen:
// the topbar switcher changes profile). Called by every page under (panel)
// (the layout is not an authorization boundary in Next 16).
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { panelSession, type PanelSession } from '@/lib/auth/panel'
import { activeNavProfile } from '@/lib/profiles/server'
import type { ProfileKind } from '@/lib/profiles/nav'

export interface PanelPage extends PanelSession { nav: ProfileKind }

export async function requirePanelPage(next: string): Promise<PanelPage> {
  const s = await panelSession()
  // Signed in but without panel access (e.g. institution): the public site, never /login — the
  // login page sends a signed-in account back to `next`, and the two would bounce forever.
  if (!s) redirect((await getSession()) ? '/e' : `/login?next=${encodeURIComponent(next)}`)
  const nav = await activeNavProfile(s.user)
  if (!nav) redirect('/e')
  return { ...s, nav }
}
