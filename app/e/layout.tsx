// The public site (handoff Fase 7): header + footer of the design around every /e page.
import type { ReactNode } from 'react'
import '@/app/ds/public.css'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'
import { publicAccount } from '@/app/e/_shared/public-account'

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const account = await publicAccount()
  return (
    <div className="hp">
      <PublicHeader account={account} />
      <main>{children}</main>
      <PublicFooter />
    </div>
  )
}
