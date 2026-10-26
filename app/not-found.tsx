import Link from 'next/link'
import { HouseArtLogo } from '@/components/layout/HouseArtLogo'
import { HomeLink, StatusScreen } from '@/components/layout/StatusScreen'

export const metadata = { title: 'Página não encontrada — HouseArt' }

export default function NotFound() {
  return (
    <main className="ha-status-page">
      <Link href="/" aria-label="HouseArt"><HouseArtLogo height={30} /></Link>
      <StatusScreen icon="search_off" title="Página não encontrada" text="O endereço pode ter mudado ou a obra pode ter saído do ar. Confira o link ou volte ao início.">
        <HomeLink />
        <Link href="/verify" className="ha-btn ha-btn--ghost ha-btn--md">Verificar uma obra</Link>
      </StatusScreen>
    </main>
  )
}
