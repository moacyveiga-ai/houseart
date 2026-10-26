import Link from 'next/link'
import { HouseArtLogo } from '@/components/layout/HouseArtLogo'
import { StatusScreen } from '@/components/layout/StatusScreen'
import { SUSPENDED_MESSAGE } from '@/lib/auth'

export const metadata = { title: 'Conta suspensa — HouseArt' }

/** Where a member of a tenant suspended by the house lands when the panel refuses it (app/(panel)/_session.ts). */
export default function SuspendedPage() {
  const support = process.env.SUPPORT_EMAIL ?? null
  return (
    <main className="ha-status-page">
      <Link href="/e" aria-label="HouseArt"><HouseArtLogo height={30} /></Link>
      <StatusScreen icon="block" title="Conta suspensa" text={SUSPENDED_MESSAGE}>
        {support ? <a className="ha-btn ha-btn--primary ha-btn--md" href={`mailto:${support}`}>Falar com a HouseArt</a> : null}
        <Link href="/e" className="ha-btn ha-btn--ghost ha-btn--md">Ir para o site</Link>
      </StatusScreen>
    </main>
  )
}
