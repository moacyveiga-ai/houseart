'use client'
// Perfil · minha conta (handoff "HouseArt App Colecionador" › Perfil, `ctSecoes`): header with
// initials, name, e-mail and the verification line; sections of items — link (chevron) or
// switch — that lead to screens that exist; "Dados pessoais" opens the read-only sheet of the
// prototype's `ctDados` (name and CPF come from the signup and are not edited here; the city
// saves by PATCH /api/auth/identity). "Sair da conta" is POST /api/auth/logout → /e.
import Link from 'next/link'
import { ContactChange } from './ContactChange'
import { useRef, useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Toggle } from '@/components/ds/Toggle'
import { Modal } from '@/components/ds/Modal'
import { DELETE_CONSEQUENCES, DELETE_WORD } from '@/lib/accounts/deletion-core'
import { ABOUT_MAX } from '@/lib/profile/core'
import { shrinkToJpeg } from '@/components/artworks/capture-render'
import './collector-account.css'
import { Button } from '@/components/ds/Button'

export interface AccountLinkItem { kind: 'link'; icon: string; name: string; sub: string; href: string }
export interface AccountSwitchItem { kind: 'switch'; icon: string; name: string; sub: string; key: 'marketingOptIn'; on: boolean }
export type CollectorAccountItem = AccountLinkItem | AccountSwitchItem
export interface CollectorAccountSection { name: string; items: CollectorAccountItem[] }
export interface PersonalData { name: string; email: string; emailVerified: boolean; phoneMask: string | null; phoneVerified: boolean; cpfMask: string | null; city: string; about: string; avatarUrl: string | null; hasPassword?: boolean }

export function CollectorAccount({ initials, me, sections, view }: { initials: string; me: PersonalData; sections: CollectorAccountSection[]; view: 'menu' | 'data' }) {
  const [leaving, setLeaving] = useState(false)
  const [sheet, setSheet] = useState<'logout' | 'delete' | null>(null)
  const [blocker, setBlocker] = useState<string | null | undefined>(undefined)
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  async function openDelete() {
    setSheet('delete'); setTyped(''); setDeleteError(null); setBlocker(undefined)
    const r = await fetch('/api/account/delete', { cache: 'no-store' }).catch(() => null)
    const j = (await r?.json().catch(() => ({}))) as { blocker?: string | null } | undefined
    setBlocker(r?.ok ? j?.blocker ?? null : null)
  }
  async function confirmDelete() {
    setDeleting(true); setDeleteError(null)
    const r = await fetch('/api/account/delete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: typed }) }).catch(() => null)
    if (r?.ok) { window.location.assign('/e'); return }
    const j = (await r?.json().catch(() => ({}))) as { error?: string } | undefined
    setDeleting(false); setDeleteError(j?.error ?? 'Não foi possível excluir agora.')
  }
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
  const [about, setAbout] = useState(me.about)
  const [savedAbout, setSavedAbout] = useState(me.about)
  const [avatar, setAvatar] = useState(me.avatarUrl)
  const [photoBusy, setPhotoBusy] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  async function changePhoto(file: File | undefined) {
    if (!file || photoBusy) return
    setPhotoBusy(true); setNote('')
    try {
      let blob: Blob = file
      try { blob = await shrinkToJpeg(file, 1024) } catch { /* the server re-encodes and says what is wrong */ }
      const form = new FormData(); form.append('file', blob, 'foto.jpg')
      const r = await fetch('/api/account/avatar', { method: 'POST', body: form })
      const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string }
      if (r.ok && j.url) { setAvatar(j.url); setNote('Foto atualizada') } else setNote(j.error ?? 'Não foi possível enviar a foto.')
    } catch { setNote('Não foi possível enviar a foto.') } finally { setPhotoBusy(false); if (picker.current) picker.current.value = '' }
  }
  async function removePhoto() {
    setPhotoBusy(true); setNote('')
    const r = await fetch('/api/account/avatar', { method: 'DELETE' }).catch(() => null)
    setPhotoBusy(false)
    if (r?.ok) { setAvatar(null); setNote('Foto removida') } else setNote('Não foi possível remover agora.')
  }
  async function saveData() {
    setSaving(true); setNote('')
    const res = await fetch('/api/auth/identity', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ city, name, about }) })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    setSaving(false)
    if (res.ok) setSavedAbout(about)
    setNote(res.ok ? 'Dados atualizados' : data.error ?? 'Não foi possível salvar agora.')
  }

  if (view === 'data') {
    const fields: { k: string; v: string; note?: string }[] = [
      { k: 'CPF', v: me.cpfMask ?? '—', note: me.cpfMask ? 'O CPF não pode ser alterado' : 'Informado na primeira oferta' },
    ]
    return (
      <div className="ha-account ha-cacct">
        <div className="ha-cacct__bar"><Link href="/account" className="ha-iconbtn ha-cacct__back" aria-label="Voltar"><Icon name="arrow_back" size={24} /></Link><span className="ha-cacct__bar-t">Dados pessoais</span></div>
        <div className="ha-account-me ha-cacct__photo">
          {/* eslint-disable-next-line @next/next/no-img-element -- public derivative of the profile photo */}
        {avatar ? <img className="ha-account-me__av ha-cacct__avimg" src={avatar} alt="" /> : <span className="ha-account-me__av">{initials}</span>}
          <span className="ha-row" style={{ gap: 8 }}>
            <input ref={picker} type="file" accept="image/*" hidden onChange={(e) => void changePhoto(e.target.files?.[0])} />
            <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" disabled={photoBusy} onClick={() => picker.current?.click()}>{avatar ? 'Trocar foto' : 'Adicionar foto'}</button>
            {avatar ? <button type="button" className="ha-btn ha-btn--ghost ha-btn--sm" disabled={photoBusy} onClick={() => void removePhoto()}>Remover</button> : null}
          </span>
        </div>
        <label className="ha-cacct__field"><span className="ha-cacct__field-k">Nome completo<span className="ha-cacct__field-n">Como aparece nos certificados e nas conversas</span></span><input className="ha-input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></label>
        <ContactChange kind="email" k="E-mail" value={me.email} needsPassword={!!me.hasPassword} note={me.emailVerified ? 'Verificado' : 'Não verificado'} />
        <ContactChange kind="phone" k="Celular" value={me.phoneMask ?? '—'} note={me.phoneMask ? (me.phoneVerified ? 'Verificado' : 'Não verificado') : 'Nenhum celular cadastrado'} />
        {fields.map((f) => (
          <label key={f.k} className="ha-cacct__field"><span className="ha-cacct__field-k">{f.k}<span className="ha-cacct__field-n">{f.note}</span></span><input className="ha-input ha-cacct__ro" value={f.v} readOnly /></label>
        ))}
        <label className="ha-cacct__field"><span className="ha-cacct__field-k">Cidade</span><input className="ha-input" value={city} maxLength={80} onChange={(e) => setCity(e.target.value)} placeholder="Onde você está" /></label>
        <label className="ha-cacct__field"><span className="ha-cacct__field-k">Sobre você<span className="ha-cacct__field-n">{about.length}/{ABOUT_MAX} · sem telefone, e-mail ou redes</span></span><textarea className="ha-input ha-cacct__about" value={about} maxLength={ABOUT_MAX} rows={3} onChange={(e) => setAbout(e.target.value)} placeholder="O que você coleciona, o que procura" /></label>
        <div className="ha-row"><button type="button" className="ha-btn ha-btn--primary ha-btn--md" disabled={saving || (city === me.city && name.trim() === me.name && about === savedAbout)} onClick={saveData}>Salvar</button>{note ? <span className="ha-cacct__note" role="status">{note}</span> : null}</div>
      </div>
    )
  }

  return (
    <div className="ha-account ha-cacct">
      <div className="ha-account-me">
        {/* eslint-disable-next-line @next/next/no-img-element -- public derivative of the profile photo */}
        {avatar ? <img className="ha-account-me__av ha-cacct__avimg" src={avatar} alt="" /> : <span className="ha-account-me__av">{initials}</span>}
        <span className="ha-stack ha-account-me__txt">
          <span className="ha-account-me__n">{me.name}</span>
          <span className="ha-account-me__e">{me.email}</span>
          <span className={`ha-cacct__ver${verified ? ' ha-cacct__ver--ok' : ''}`}><Icon name={verified ? 'verified_user' : 'pending'} size={15} filled />{verified ? (me.phoneMask ? 'E-mail e celular verificados' : 'E-mail verificado') : 'Verificação pendente'}</span>
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
      <button type="button" className="ha-account-logout" disabled={leaving} onClick={() => setSheet('logout')}><Icon name="logout" size={20} />Sair da conta</button>
      <button type="button" className="ha-cacct__danger" onClick={() => void openDelete()}>Excluir minha conta</button>
      <span className="ha-account-foot">HouseArt 1.0 (2026.10) · <Link href="/terms">Termos de uso</Link> · <Link href="/privacy">Privacidade</Link></span>

      <Modal open={sheet === 'logout'} title="Sair da conta?" onClose={() => setSheet(null)}>
        <div className="ha-cacct__sheet">
          <p className="ha-sm">Suas obras, ofertas e conversas continuam salvas. É só entrar de novo com o seu e-mail.</p>
          <div className="ha-row" style={{ gap: 8 }}>
            <button type="button" className="ha-btn ha-btn--outline ha-btn--md" onClick={() => setSheet(null)}>Cancelar</button>
            <button type="button" className="ha-btn ha-btn--primary ha-btn--md" disabled={leaving} onClick={logout}>Sair</button>
          </div>
        </div>
      </Modal>
      <Modal open={sheet === 'delete'} title="Excluir minha conta" onClose={() => setSheet(null)}>
        <div className="ha-cacct__sheet">
          {blocker === undefined ? <p className="ha-sm ha-muted">Conferindo suas negociações…</p> : blocker ? (
            <>
              <p className="ha-sm">{blocker}</p>
              <button type="button" className="ha-btn ha-btn--outline ha-btn--md" onClick={() => setSheet(null)}>Entendi</button>
            </>
          ) : (
            <>
              <p className="ha-sm">Ao excluir a conta:</p>
              <ul className="ha-cacct__list">{DELETE_CONSEQUENCES.map((c) => <li key={c}>{c}</li>)}</ul>
              <label className="ha-cacct__field">Digite {DELETE_WORD} para confirmar<input className="ha-input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" autoCapitalize="characters" /></label>
              {deleteError ? <p className="ha-cacct__err" role="alert">{deleteError}</p> : null}
              <Button variant="danger" size="md" disabled={deleting || typed.trim().toUpperCase() !== DELETE_WORD} onClick={confirmDelete} loading={deleting}>{deleting ? 'Excluindo…' : 'Excluir conta'}</Button>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
