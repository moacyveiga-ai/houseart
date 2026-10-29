'use client'
// Conta, equipe e repasses (handoff "HouseArt App Galeria" › Galeria › Conta, `ctSecoes`):
// header with the gallery's name, the e-mail of the login and the verification line ("CNPJ,
// e-mail e celular verificados"), sections of items (icon · name · sub · chevron) that lead
// to screens that exist, "Sair da conta" with the confirmation sheet (POST /api/auth/logout
// → /e) and "Excluir minha conta": a collector closes it here; a gallery's account is closed
// by the HouseArt desk, and the sheet says so (GET /api/account/delete decides).
import Link from 'next/link'
import { forgetAccountTheme } from '@/lib/theme'
import { useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Modal } from '@/components/ds/Modal'
import { DELETE_CONSEQUENCES, DELETE_WORD } from '@/lib/accounts/deletion-core'
import { Button } from '@/components/ds/Button'
import { Toggle } from '@/components/ds/Toggle'
import { ThemePicker } from '@/components/theme/ThemePicker'

/** `current`: the item open in the side panel over the account (it opens without scrolling the page). */
export interface AccountLinkItem { icon: string; name: string; sub: string; href: string; current?: boolean }
/** A switch saved by PATCH /api/auth/preferences (the same one the collector's Perfil uses). */
export interface AccountSwitchItem { icon: string; name: string; sub: string; switchKey: 'marketingOptIn'; on: boolean }
export type AccountItem = AccountLinkItem | AccountSwitchItem
export interface AccountSection { name: string; items: AccountItem[] }
export interface AccountVerification { cnpj: boolean; email: boolean; phone: boolean }

type DeleteState = { loading: true } | { loading: false; selfService: boolean; blocker: string | null; message: string | null }

/** "CNPJ, e-mail e celular verificados" · "E-mail verificado · celular pendente" … */
export function verificationLine(v: AccountVerification): { ok: boolean; text: string } {
  const names: [keyof AccountVerification, string][] = [['cnpj', 'CNPJ'], ['email', 'e-mail'], ['phone', 'celular']]
  const done = names.filter(([k]) => v[k]).map(([, n]) => n)
  const pending = names.filter(([k]) => !v[k]).map(([, n]) => n)
  const join = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`)
  if (!pending.length) return { ok: true, text: `${join(done)} verificados` }
  if (!done.length) return { ok: false, text: 'Verificação pendente' }
  return { ok: false, text: `${join(done)} ${done.length === 1 ? 'verificado' : 'verificados'} · ${join(pending)} ${pending.length === 1 ? 'pendente' : 'pendentes'}` }
}

export function AccountScreen({ initials, name, email, verification, sections, supportEmail = null }: { initials: string; name: string; email: string; verification?: AccountVerification | null; sections: AccountSection[]; supportEmail?: string | null }) {
  const [leaving, setLeaving] = useState(false)
  const [sheet, setSheet] = useState<'logout' | 'delete' | null>(null)
  const [del, setDel] = useState<DeleteState>({ loading: true })
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const ver = verification ? verificationLine(verification) : null
  const [switches, setSwitches] = useState<Record<string, boolean>>(() => Object.fromEntries(sections.flatMap((g) => g.items.flatMap((i) => ('switchKey' in i ? [[i.switchKey, i.on]] : [])))))
  const [switchError, setSwitchError] = useState<string | null>(null)
  const [savingSwitch, setSavingSwitch] = useState(false)

  // one save at a time: a quick double click never leaves the screen and the server disagreeing
  async function flip(key: 'marketingOptIn', next: boolean) {
    if (savingSwitch) return
    setSavingSwitch(true); setSwitches((s) => ({ ...s, [key]: next })); setSwitchError(null)
    const res = await fetch('/api/auth/preferences', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ [key]: next }) }).catch(() => null)
    if (!res?.ok) { setSwitches((s) => ({ ...s, [key]: !next })); setSwitchError('Não foi possível salvar agora.') }
    setSavingSwitch(false)
  }

  async function logout() {
    setLeaving(true)
    forgetAccountTheme()
    await fetch('/api/auth/logout', { method: 'POST', headers: { accept: 'application/json' } }).catch(() => null)
    window.location.assign('/e')
  }
  async function openDelete() {
    setSheet('delete'); setTyped(''); setDeleteError(null); setDel({ loading: true })
    const r = await fetch('/api/account/delete', { cache: 'no-store' }).catch(() => null)
    const d = (await r?.json().catch(() => ({}))) as { selfService?: boolean; blocker?: string | null; message?: string | null } | undefined
    if (!r?.ok) { setDel({ loading: false, selfService: false, blocker: null, message: d?.message ?? 'Não foi possível conferir a conta agora.' }); return }
    setDel({ loading: false, selfService: d?.selfService !== false, blocker: d?.blocker ?? null, message: d?.message ?? null })
  }
  async function confirmDelete() {
    setDeleting(true); setDeleteError(null)
    const r = await fetch('/api/account/delete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: typed }) }).catch(() => null)
    const d = (await r?.json().catch(() => ({}))) as { error?: string } | undefined
    if (!r?.ok) { setDeleting(false); setDeleteError(d?.error ?? 'Não foi possível excluir a conta.'); return }
    window.location.assign('/e')
  }

  return (
    <div className="ha-account">
      <div className="ha-account-me">
        <span className="ha-account-me__av">{initials}</span>
        <span className="ha-stack ha-account-me__txt">
          <span className="ha-account-me__n">{name}</span>
          <span className="ha-account-me__e">{email}</span>
          {ver ? <span className={`ha-account-me__ver${ver.ok ? ' ha-account-me__ver--ok' : ''}`}><Icon name={ver.ok ? 'verified_user' : 'pending'} size={16} filled={ver.ok} />{ver.text}</span> : null}
        </span>
      </div>
      {sections.map((g) => (
        <section key={g.name} className="ha-account-sec" aria-label={g.name}>
          <span className="ha-account-sec__k">{g.name}</span>
          <div className="ha-account-sec__box">
            {g.items.map((it) => ('switchKey' in it ? (
              <div key={it.name} className="ha-account-item ha-account-item--switch">
                <Icon name={it.icon} size={22} />
                <span className="ha-stack ha-account-item__txt"><span className="ha-account-item__n">{it.name}</span><span className="ha-account-item__s">{it.sub}</span></span>
                <span className="ha-stack" style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Toggle on={switches[it.switchKey] ?? it.on} disabled={savingSwitch} onChange={(n) => void flip(it.switchKey, n)} label={it.name} />
                  {switchError ? <span className="ha-account-sheet__err" role="alert">{switchError}</span> : null}
                </span>
              </div>
            ) : (
              <Link key={it.name} href={it.href} className="ha-account-item" scroll={it.current === undefined} aria-current={it.current ? 'true' : undefined}>
                <Icon name={it.icon} size={22} />
                <span className="ha-stack ha-account-item__txt"><span className="ha-account-item__n">{it.name}</span><span className="ha-account-item__s">{it.sub}</span></span>
                <Icon name="chevron_right" size={20} className="ha-account-item__arrow" />
              </Link>
            )))}
          </div>
        </section>
      ))}
      <ThemePicker />
      <button type="button" className="ha-account-logout" disabled={leaving} onClick={() => setSheet('logout')}><Icon name="logout" size={20} />Sair da conta</button>
      <button type="button" className="ha-account-danger" onClick={() => void openDelete()}>Excluir minha conta</button>
      <span className="ha-account-foot">HouseArt 1.0 (2026.10) · <Link href="/terms">Termos de uso</Link> · <Link href="/privacy">Privacidade</Link></span>

      <Modal open={sheet === 'logout'} title="Sair da conta?" onClose={() => setSheet(null)}>
        <div className="ha-account-sheet">
          <p className="ha-sm">O acervo, as ofertas e as conversas continuam aqui. É só entrar de novo com o seu e-mail.</p>
          <div className="ha-row" style={{ gap: 8 }}>
            <button type="button" className="ha-btn ha-btn--outline ha-btn--md" onClick={() => setSheet(null)}>Cancelar</button>
            <button type="button" className="ha-btn ha-btn--primary ha-btn--md" disabled={leaving} onClick={logout}>Sair</button>
          </div>
        </div>
      </Modal>
      <Modal open={sheet === 'delete'} title="Excluir minha conta" onClose={() => setSheet(null)}>
        <div className="ha-account-sheet">
          {del.loading ? <p className="ha-sm ha-muted">Conferindo a conta…</p> : !del.selfService ? (
            <>
              <p className="ha-sm">{del.message ?? 'A exclusão da conta de uma galeria é feita pelo atendimento da HouseArt: o acervo, os certificados emitidos e os repasses precisam de um encerramento combinado.'}</p>
              <div className="ha-row" style={{ gap: 8 }}>
                <button type="button" className="ha-btn ha-btn--outline ha-btn--md" onClick={() => setSheet(null)}>Entendi</button>
                {supportEmail ? <a className="ha-btn ha-btn--primary ha-btn--md" href={`mailto:${supportEmail}?subject=${encodeURIComponent('Encerrar a minha conta')}`}>Falar com a HouseArt</a> : null}
              </div>
            </>
          ) : del.blocker ? (
            <>
              <p className="ha-sm">{del.blocker}</p>
              <button type="button" className="ha-btn ha-btn--outline ha-btn--md" onClick={() => setSheet(null)}>Entendi</button>
            </>
          ) : (
            <>
              <p className="ha-sm">Ao excluir a conta:</p>
              <ul className="ha-account-sheet__list">{DELETE_CONSEQUENCES.map((c) => <li key={c}>{c}</li>)}</ul>
              <label className="ha-account-sheet__field">Digite {DELETE_WORD} para confirmar<input className="ha-input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" /></label>
              {deleteError ? <p className="ha-account-sheet__err" role="alert">{deleteError}</p> : null}
              <Button variant="danger" size="md" disabled={deleting || typed.trim().toUpperCase() !== DELETE_WORD} onClick={confirmDelete} loading={deleting}>{deleting ? 'Excluindo…' : 'Excluir conta'}</Button>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
