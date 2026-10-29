// The public footer of the handoff: ink-900, vertical negative lockup (64–72px), links.
import Link from 'next/link'
import { HouseArtLogo } from '@/components/layout/HouseArtLogo'

export function PublicFooter({ tall = false }: { tall?: boolean }) {
  return (
    <footer className={`hp-footer${tall ? ' hp-footer--tall' : ''}`}>
      <div className="hp-footer__inner">
        <div className="hp-footer__brand"><HouseArtLogo version="full_vert" tone="negativo" height={tall ? 72 : 64} />{tall ? <span className="hp-footer__by">by House · Viby Tecnologia</span> : null}</div>
        <div className="hp-footer__links">
          <Link href="/e/how-it-works">Para artistas e galerias</Link>
          <Link href="/e/how-it-works#precos">Preços</Link>
          <Link href="/e/how-it-works#sobre">Sobre</Link>
          <Link href="/e/help">Ajuda</Link>
          <Link href="/privacy">Privacidade</Link>
        </div>
      </div>
    </footer>
  )
}
