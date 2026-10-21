// The public site (handoff Fase 7): header + footer of the design around every /e page.
import type { ReactNode } from 'react'
import '@/app/ds/public.css'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="hp">
      <PublicHeader />
      <main>{children}</main>
      <PublicFooter />
    </div>
  )
}
