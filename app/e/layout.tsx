// The public site (handoff Fase 7): header + footer of the design around every /e page.
import type { ReactNode } from 'react'
import '@/app/ds/public.css'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { getSession } from '@/lib/auth'
import { activeNavProfile } from '@/lib/profiles/server'
import { homeOf, PROFILE_LABELS } from '@/lib/profiles/nav'

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const user = await getSession().catch(() => null)
  const nav = user ? await activeNavProfile(user).catch(() => null) : null
  const account = user ? (nav ? { href: homeOf(nav), label: PROFILE_LABELS[nav] } : { href: '/e/how-it-works#suporte', label: 'Ajuda' }) : null
  return (
    <div className="hp">
      <PublicHeader account={account} />
      <main>{children}</main>
      <PublicFooter />
    </div>
  )
}
