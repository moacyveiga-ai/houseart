'use client'
// The public top bar of the handoff: sticky ink-900 64px with the negative
// lockup (44px) on every page; on the Home it is fixed, 72px, transparent over
// the hero and solid (rgba ink, blur) after 80 % of the viewport is scrolled.
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useSyncExternalStore, type FormEvent } from 'react'
import { HouseArtLogo } from '@/components/layout/HouseArtLogo'
import { Icon } from '@/components/ds/Icon'
import { headerSearchTarget } from './header-search-core'

export const PUBLIC_NAV = [
  { href: '/e/marketplace', label: 'Marketplace' },
  { href: '/e/artists', label: 'Artistas' },
  { href: '/e/galleries', label: 'Galerias' },
  { href: '/e#agenda', label: 'Agenda' },
  { href: '/e/how-it-works', label: 'Como funciona' },
  { href: '/verify', label: 'Verificar uma obra' },
] as const

function subscribeScroll(onChange: () => void) {
  window.addEventListener('scroll', onChange, { passive: true })
  window.addEventListener('resize', onChange)
  return () => { window.removeEventListener('scroll', onChange); window.removeEventListener('resize', onChange) }
}

/** `account`: the logged person's panel (href + profile label); null = anonymous. */
export function PublicHeader({ account = null }: { account?: { href: string; label: string } | null }) {
  const pathname = usePathname()
  const home = pathname === '/e'
  const scrolled = useSyncExternalStore(subscribeScroll, () => window.scrollY > window.innerHeight * 0.8, () => false)
  const solid = !home || scrolled
  // Catalogue pages use the light top bar of the handoff; there the brand is the wordmark alone (simples_horiz,
  // 24 px — decision of Moacy, 2026-10-28, instead of §4.5's full_horiz 30 px). Site, Verificar and the Home
  // keep the dark one with the full lockup.
  const light = ['/e/marketplace', '/e/artwork', '/e/artist', '/e/artists', '/e/gallery', '/e/galleries'].some((p) => pathname === p || pathname.startsWith(p + '/'))
  const router = useRouter()
  function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const to = headerSearchTarget(String(new FormData(e.currentTarget).get('q') ?? ''))
    if (to) router.push(to)
  }
  const active = (href: string) => href !== '/e#agenda' && (pathname === href || pathname.startsWith(href + '/'))
  return (
    <header className={`hp-header${home ? ' hp-header--home' : ''}${solid ? ' hp-header--solid' : ''}${light ? ' hp-header--light' : ''}`}>
      <div className="hp-header__inner">
        <Link href="/e" className="hp-header__brand" aria-label="HouseArt">{light ? <HouseArtLogo version="simples_horiz" tone="color" height={24} /> : <HouseArtLogo version="full_horiz" tone="negativo" height={home ? 48 : pathname.startsWith('/verify') ? 30 : 44} />}</Link>
        <nav className="hp-nav" aria-label="Navegação pública">
          {PUBLIC_NAV.map((n) => <Link key={n.href} href={n.href} className={`hp-nav__link${active(n.href) ? ' hp-nav__link--on' : ''}`} aria-current={active(n.href) ? 'page' : undefined}>{n.label}</Link>)}
        </nav>
        {light ? (
          <form className="hp-header__search" role="search" action="/e/marketplace" onSubmit={search}>
            <Icon name="search" size={20} />
            <input name="q" type="search" placeholder="Obra, artista ou ID" aria-label="Buscar obra, artista ou ID" maxLength={120} />
          </form>
        ) : null}
        <div className="hp-header__right">
          {account ? (
            <Link href={account.href} className="hp-header__login hp-header__login--account" aria-label={`Minha área · ${account.label}`}><Icon name="person" size={18} /><span className="hp-header__label">{account.label}</span></Link>
          ) : home ? (
            <><Link href="/login" className="hp-header__enter">Entrar</Link><Link href="/signup" className="hp-header__cta">Criar conta</Link></>
          ) : (
            <Link href="/login" className="hp-header__login">Entrar</Link>
          )}
        </div>
      </div>
    </header>
  )
}
