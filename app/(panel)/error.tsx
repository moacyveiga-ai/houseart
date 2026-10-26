'use client'
import { useEffect } from 'react'
import { HomeLink, StatusScreen } from '@/components/layout/StatusScreen'

// Error boundary inside the panel: the shell (menu, topbar) stays, only the page area shows the state.
export default function PanelError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => { console.error('[panel] erro na tela', error.digest ?? error.name) }, [error])
  return (
    <StatusScreen icon="error" title="Algo não saiu como esperado" text="Esta tela não carregou. Tente de novo; o resto do sistema segue funcionando." code={error.digest}>
      <button type="button" className="ha-btn ha-btn--primary ha-btn--md" onClick={() => unstable_retry()}>Tentar de novo</button>
      <HomeLink />
    </StatusScreen>
  )
}
