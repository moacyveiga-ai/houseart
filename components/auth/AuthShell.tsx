// The two-panel entrance of the design: the ink panel with the brand on the
// left; a column for the card on the right. Two looks for the panel:
//   · `frame` (default — "Login" / "Criar conta" of screens.html): the framed
//     artwork and the house claim with a caption (or `foot`, e.g. the plan
//     summary of HouseArt Cadastro.dc.html).
//   · `claim` (HouseArt Entrar.dc.html): headline + tagline at the bottom of a
//     darkened wall, no frame.
// The API `{title, lead, children}` is kept; `hideHeading` (or no `title`)
// lets an island draw its own header — the login swaps to "Recuperar senha"
// in place. `brandHeight` follows the handoff table (§4.5: 30 on Entrar and
// Cadastro, 48 on the Web App login). `className` adds a modifier to the root.
import type { CSSProperties, ReactNode } from 'react'
import Image from 'next/image'
import { HouseArtLogo } from '@/components/layout/HouseArtLogo'

export interface AuthShellProps {
  title?: string
  lead?: ReactNode
  children: ReactNode
  /** replaces the claim/caption block of the `frame` panel */
  foot?: ReactNode
  className?: string
  brandHeight?: number
  hideHeading?: boolean
  /** look of the ink panel (see the header comment) */
  variant?: 'frame' | 'claim'
  /** headline of the `claim` panel (`<i>` for the italic part) */
  claim?: ReactNode
  /** sentence under the headline of the `claim` panel; `null` hides it */
  tagline?: ReactNode
  /** picture hung inside the frame of the `frame` panel (public-domain artwork, as the prototype) */
  art?: { src: string; alt: string }
  /** photo of a real artwork filling the `claim` panel behind the headline (public domain), darkened by CSS; `credit` is the caption line */
  wall?: { src: string; credit: string }
}

export function AuthShell({ title, lead, children, foot, className, brandHeight, hideHeading = false, variant = 'frame', claim, tagline, art, wall }: AuthShellProps) {
  const isClaim = variant === 'claim'
  return (
    <main className={['ha-login', isClaim ? 'ha-login--claim' : '', className ?? ''].filter(Boolean).join(' ')}>
      {/* the photo goes as a CSS background (a missing file in a dev base shows the gradient alone, never a broken image) */}
      <section className={wall ? 'ha-login__art ha-login__art--wall' : 'ha-login__art'} style={wall ? ({ '--ha-login-wall': `url("${wall.src}")` } as CSSProperties) : undefined}>
        <a href="/e" className="ha-login__brand" aria-label="HouseArt — site"><HouseArtLogo version="full_horiz" tone="negativo" height={brandHeight ?? (isClaim ? 30 : 48)} /></a>
        {isClaim ? (
          <div className="ha-login__hero" aria-hidden="true">
            <h2 className="ha-login__headline">{claim ?? <>Sua coleção, <i>com escritura.</i></>}</h2>
            {tagline === null ? null : <p className="ha-login__tagline">{tagline ?? 'Acompanhe ofertas, entregas e certificados das suas obras em um só lugar.'}</p>}
            {wall ? <p className="ha-login__credit">{wall.credit}</p> : null}
          </div>
        ) : (
          <>
            <div className="ha-login__stage" aria-hidden="true"><div className={art ? 'ha-login__frame ha-login__frame--art' : 'ha-login__frame'}>{art ? <Image src={art.src} alt={art.alt} width={700} height={875} priority unoptimized /> : null}</div></div>
            {foot ?? (
              <div className="ha-login__foot" aria-hidden="true">
                <div className="ha-login__claim">{claim ?? 'A escritura da obra de arte'}</div>
                <div className="ha-login__caption">Joana Teixeira · <i>Construção para um dia claro</i>, 2025</div>
              </div>
            )}
          </>
        )}
      </section>
      <section className="ha-login__form">
        <div className="ha-login__card">
          {hideHeading || !title ? null : (
            <div className="ha-login__head">
              <h1 className="ha-h1">{title}</h1>
              {lead ? <p className="ha-login__lead">{lead}</p> : null}
            </div>
          )}
          {children}
        </div>
      </section>
    </main>
  )
}
