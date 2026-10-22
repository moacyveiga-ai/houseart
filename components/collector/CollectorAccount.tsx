'use client'
// Perfil · minha conta (handoff "HouseArt App Colecionador" › Perfil, `ctSecoes`): header with
// initials, name, e-mail and the verification line; sections of items — link (chevron) or
// switch — that lead to screens that exist; "Dados pessoais" opens the read-only sheet of the
// prototype's `ctDados` (name and CPF come from the signup and are not edited here; the city
// saves by PATCH /api/auth/identity). "Sair da conta" is POST /api/auth/logout → /e.
import Link from 'next/link'
import { useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Toggle } from '@/components/ds/Toggle'
import './collector-account.css'

export interface AccountLinkItem { kind: 'link'; icon: string; name: string; sub: string; href: string }
export interface AccountSwitchItem { kind: 'switch'; icon: string; name: string; sub: string; key: 'marketingOptIn'; on: boolean }
export type CollectorAccountItem = AccountLinkItem | AccountSwitchItem
export interface CollectorAccountSection { name: string; items: CollectorAccountItem[] }
export interface PersonalData { name: string; email: string; emailVerified: boolean; phoneMask: string | null; phoneVerified: boolean; cpfMask: string | null; city: string }

export function CollectorAccount({ initials, me, sections, view }: { initials: string; me: PersonalData; sections: CollectorAccountSection[]; view: 'menu' | 'data' }) {
  const [leaving, setLeaving] = useState(false)
  const [switches, setSwitches] = useState<Record<string, boolean>>(() => Object.fromEntries(sections.flatMap((g) => g.items.filter((i): i is AccountSwitchItem => i.kind === 'switch').map((i) => [i.key, i.on]))))
  const [city, setCity] = useState(me.city)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState('')
  const verified = me.emailVerified && (me.phoneVerified || !me.phoneMask)

  async function logout() {
    setLeaving(true)
    await fetch('/api/auth/logout', { method: 'POST', headers: { accept: 'application/json' } }).catch(() => null)
    window.location.assign('/e')
  }
  async function flip(key: 'marketingOptIn', next: boolean) {
    setSwitches((s) => ({ ...s, [key]: next }))
    const res = await fetch('/api/auth/preferences', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ [key]: next }) })
    if (!res.ok) { setSwitches((s) => ({ ...s, [key]: !next })); setNote('Não foi possível salvar agora.') }
  }
  const [name, setName] = useState(me.name)
  async function saveData() {
    setSaving(true); setNote('')
    const res = await fetch('/api/auth/identity', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ city, name }) })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    setSaving(false)
    setNote(res.ok ? 'Dados atualizados' : data.error ?? 'Não foi possível salvar agora.')
  }

  if (view === 'data') {
    const fields: { k: string; v: string; note?: string }[] = [
      { k: 'E-mail', v: me.email, note: me.emailVerified ? 'Verificado' : 'Não verificado' },
      { k: 'Celular', v: me.phoneMask ?? '—', note: me.phoneMask ? (me.phoneVerified ? 'Verificado' : 'Não verificado') : 'Informado na primeira oferta' },
      { k: 'CPF', v: me.cpfMask ?? '—', note: me.cpfMask ? 'O CPF não pode ser alterado' : 'Informado na primeira oferta' },
    ]
    return (
      <div className="ha-account ha-cacct">
        <div className="ha-cacct__bar"><Link href="/account" className="ha-iconbtn ha-cacct__back" aria-label="Voltar"><Icon name="arrow_back" size={24} /></Link><span className="ha-cacct__bar-t">Dados pessoais</span></div>
        <div className="ha-account-me"><span className="ha-account-me__av">{initials}</span></div>
        <label className="ha-cacct__field"><span className="ha-cacct__field-k">Nome completo<span className="ha-cacct__field-n">Como aparece nos certificados e nas conversas</span></span><input className="ha-input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></label>
        {fields.map((f) => (
          <label key={f.k} className="ha-cacct__field"><span className="ha-cacct__field-k">{f.k}<span className="ha-cacct__field-n">{f.note}</span></span><input className="ha-input ha-cacct__ro" value={f.v} readOnly /></label>
        ))}
        <label className="ha-cacct__field"><span className="ha-cacct__field-k">Cidade</span><input className="ha-input" value={city} maxLength={80} onChange={(e) => setCity(e.target.value)} placeholder="Onde você está" /></label>
        <div className="ha-row"><button type="button" className="ha-btn ha-btn--primary ha-btn--md" disabled={saving || (city === me.city && name.trim() === me.name)} onClick={saveData}>Salvar</button>{note ? <span className="ha-cacct__note" role="status">{note}</span> : null}</div>
      </div>
    )
  }

  return (
    <div className="ha-account ha-cacct">
      <div className="ha-account-me">
        <span className="ha-account-me__av">{initials}</span>
        <span className="ha-stack ha-account-me__txt">
          <span className="ha-account-me__n">{me.name}</span>
          <span className="ha-account-me__e">{me.email}</span>
          <span className={`ha-cacct__ver${verified ? ' ha-cacct__ver--ok' : ''}`}><Icon name={verified ? 'verified' : 'pending'} size={15} filled />{verified ? 'Conta verificada' : 'Verificação pendente'}</span>
        </span>
      </div>
      {sections.map((g) => (
        <section key={g.name} className="ha-account-sec" aria-label={g.name}>
          <span className="ha-account-sec__k">{g.name}</span>
          <div className="ha-account-sec__box">
            {g.items.map((it) => it.kind === 'link' ? (
              <Link key={it.name} href={it.href} className="ha-account-item">
                <Icon name={it.icon} size={22} />
                <span className="ha-stack ha-account-item__txt"><span className="ha-account-item__n">{it.name}</span><span className="ha-account-item__s">{it.sub}</span></span>
                <Icon name="chevron_right" size={20} className="ha-account-item__arrow" />
              </Link>
            ) : (
              <div key={it.name} className="ha-account-item ha-cacct__sw">
                <Icon name={it.icon} size={22} />
                <span className="ha-stack ha-account-item__txt"><span className="ha-account-item__n">{it.name}</span><span className="ha-account-item__s">{it.sub}</span></span>
                <Toggle on={switches[it.key] ?? it.on} onChange={(n) => flip(it.key, n)} label={it.name} />
              </div>
            ))}
          </div>
        </section>
      ))}
      {note ? <span className="ha-cacct__note" role="status">{note}</span> : null}
      <button type="button" className="ha-account-logout" disabled={leaving} onClick={logout}><Icon name="logout" size={20} />Sair da conta</button>
      <span className="ha-account-foot">HouseArt · <Link href="/terms">Termos de uso</Link> · <Link href="/privacy">Privacidade</Link></span>
    </div>
  )
}
