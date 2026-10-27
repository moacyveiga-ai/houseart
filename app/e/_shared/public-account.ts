import 'server-only'
// Who is on the public site (/e and /verify): the logged person's panel (href + profile
// label) for the header, or null for a visitor. One rule for every public shell, so the
// verification pages stop showing "Entrar" to someone already signed in (audit público §33).
// Lives in app/ because lib/auth already imports lib/profiles (the other way closes a cycle).
import { getSession } from '@/lib/auth'
import { activeNavProfile } from '@/lib/profiles/server'
import { homeOf, PROFILE_LABELS } from '@/lib/profiles/nav'

export async function publicAccount(): Promise<{ href: string; label: string } | null> {
  const user = await getSession().catch(() => null)
  if (!user) return null
  const nav = await activeNavProfile(user).catch(() => null)
  return nav ? { href: homeOf(nav), label: PROFILE_LABELS[nav] } : { href: '/e/how-it-works#suporte', label: 'Ajuda' }
}
