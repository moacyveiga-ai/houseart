// The two-panel entrance of the design ("Login" / "Criar conta" screens in
// houseart-design/screens.html): the ink panel with the brand, the framed
// artwork and the house claim on the left; a 380px column on the right.
import type { ReactNode } from 'react'
import { HouseArtLogo } from '@/components/layout/HouseArtLogo'

export function AuthShell({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <main className="ha-login">
      <section className="ha-login__art" aria-hidden="true">
        <HouseArtLogo version="full_horiz" tone="negativo" height={48} />
        <div className="ha-login__stage"><div className="ha-login__frame" /></div>
        <div className="ha-login__foot">
          <div className="ha-login__claim">A escritura da obra de arte</div>
          <div className="ha-login__caption">Joana Teixeira · <i>Construção para um dia claro</i>, 2025</div>
        </div>
      </section>
      <section className="ha-login__form">
        <div className="ha-login__card">
          <div>
            <h1 className="ha-h1">{title}</h1>
            <p className="ha-login__lead">{lead}</p>
          </div>
          {children}
        </div>
      </section>
    </main>
  )
}
