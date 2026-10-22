import '@/app/ds/public.css'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'

export const metadata = { title: 'Termos de uso — HouseArt' }

/** Provisional text: the legal review publishes the final version (handoff Fase 2 links here). */
export default function Page() {
  return (
    <div className="hp">
      <PublicHeader />
      <main className="hp-container" style={{ padding: 'var(--ha-space-12) var(--ha-space-6)' }}>
        <h1 className="ha-h1">Termos de uso</h1>
        <p className="ha-muted">Os termos de uso da HouseArt estão em revisão jurídica. Esta página será publicada com o texto definitivo antes do lançamento comercial.</p>
      </main>
      <PublicFooter />
    </div>
  )
}
