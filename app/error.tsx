'use client'
import Link from 'next/link'
import { useEffect } from 'react'
import { HouseArtLogo } from '@/components/layout/HouseArtLogo'
import { HomeLink, StatusScreen } from '@/components/layout/StatusScreen'

// Error boundary of the public pages and of everything outside the panel. The
// server message never reaches the screen (Next sends only a digest in production).
export default function AppError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => { console.error('[app] erro na tela', error.digest ?? error.name) }, [error])
  return (
    <main className="ha-status-page">
      <Link href="/" aria-label="HouseArt"><HouseArtLogo height={30} /></Link>
      <StatusScreen icon="error" title="Algo não saiu como esperado" text="A página não carregou. Tente de novo; se continuar, volte ao início." code={error.digest}>
        <button type="button" className="ha-btn ha-btn--primary ha-btn--md" onClick={() => unstable_retry()}>Tentar de novo</button>
        <HomeLink />
      </StatusScreen>
    </main>
  )
}
