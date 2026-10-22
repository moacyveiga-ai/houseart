import '@/app/ds/public.css'
import { PublicHeader } from '@/components/public/PublicHeader'
import { PublicFooter } from '@/components/public/PublicFooter'

export const metadata = { title: 'Política de privacidade — HouseArt' }

/** Provisional text: the legal review publishes the final version (handoff Fase 2 links here). */
export default function Page() {
  return (
    <div className="hp">
      <PublicHeader />
      <main className="hp-container" style={{ padding: 'var(--ha-space-12) var(--ha-space-6)' }}>
        <h1 className="ha-h1">Política de privacidade</h1>
        <p className="ha-muted">A política de privacidade da HouseArt está em revisão jurídica. Até lá, os dados pessoais são usados só para operar a conta, a autenticação das obras e os avisos que você pedir; CPF e documentos ficam cifrados e nunca são expostos.</p>
      </main>
      <PublicFooter />
    </div>
  )
}
