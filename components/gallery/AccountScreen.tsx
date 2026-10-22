'use client'
// Conta, equipe e repasses (handoff "HouseArt App Galeria" › Galeria › Conta, `ctSecoes`):
// header with initials, sections of items (icon · name · sub · chevron) that lead to
// screens that exist, and "Sair da conta" (POST /api/auth/logout → /e).
import Link from 'next/link'
import { useState } from 'react'
import { Icon } from '@/components/ds/Icon'

export interface AccountItem { icon: string; name: string; sub: string; href: string }
export interface AccountSection { name: string; items: AccountItem[] }

export function AccountScreen({ initials, name, email, sections }: { initials: string; name: string; email: string; sections: AccountSection[] }) {
  const [leaving, setLeaving] = useState(false)
  async function logout() {
    setLeaving(true)
    await fetch('/api/auth/logout', { method: 'POST', headers: { accept: 'application/json' } }).catch(() => null)
    window.location.assign('/e')
  }
  return (
    <div className="ha-account">
      <div className="ha-account-me">
        <span className="ha-account-me__av">{initials}</span>
        <span className="ha-stack ha-account-me__txt">
          <span className="ha-account-me__n">{name}</span>
          <span className="ha-account-me__e">{email}</span>
        </span>
      </div>
      {sections.map((g) => (
        <section key={g.name} className="ha-account-sec" aria-label={g.name}>
          <span className="ha-account-sec__k">{g.name}</span>
          <div className="ha-account-sec__box">
            {g.items.map((it) => (
              <Link key={it.name} href={it.href} className="ha-account-item">
                <Icon name={it.icon} size={22} />
                <span className="ha-stack ha-account-item__txt"><span className="ha-account-item__n">{it.name}</span><span className="ha-account-item__s">{it.sub}</span></span>
                <Icon name="chevron_right" size={20} className="ha-account-item__arrow" />
              </Link>
            ))}
          </div>
        </section>
      ))}
      <button type="button" className="ha-account-logout" disabled={leaving} onClick={logout}><Icon name="logout" size={20} />Sair da conta</button>
      <span className="ha-account-foot">HouseArt · <Link href="/terms">Termos de uso</Link> · <Link href="/privacy">Privacidade</Link></span>
    </div>
  )
}
