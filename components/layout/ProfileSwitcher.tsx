'use client'
import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { AvatarFace } from '@/components/ds/AvatarFace'
import { swapTarget, type ProfileKindKey } from '@/lib/profiles/core'

export interface SwitcherProfile { kind: ProfileKindKey; name: string; icon: string; active: boolean }

/** Switches the session's profile (POST /api/profiles) and opens its home; the error text when refused. */
async function switchProfile(kind: ProfileKindKey): Promise<string | null> {
  const res = await fetch('/api/profiles', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind }) }).catch(() => null)
  const data = (await res?.json().catch(() => ({}))) as { home?: string; error?: string } | undefined
  if (!res || !res.ok) return data?.error ?? 'Não foi possível trocar de perfil.'
  window.location.assign(data?.home ?? '/')
  return null
}

/**
 * The pill of the design next to the account button ("Ver como colecionador" on the gallery's panel,
 * "Ver como galeria" on the collector's): a shortcut to the counterpart profile the person also has.
 * Nothing when there is none — the switcher menu keeps every profile.
 */
export function ProfileSwapPill({ profiles }: { profiles: SwitcherProfile[] }) {
  const target = swapTarget(profiles)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!target) return null
  return (
    <button type="button" className="ha-swap-pill" disabled={busy} title={error ?? undefined}
      onClick={async () => { setBusy(true); setError(null); const err = await switchProfile(target.kind); if (err) { setBusy(false); setError(err) } }}>
      <Icon name="swap_horiz" size={18} />
      <span aria-live="polite">{busy ? 'Trocando…' : error ? 'Não foi possível trocar · tentar de novo' : target.label}</span>
    </button>
  )
}

/**
 * The profile button of the topbar (initials + profile + swap_horiz, as in the
 * design). With more than one profile it opens a menu that switches the
 * session's profile in place (POST /api/profiles) — there is no separate
 * "choose a profile" screen. With one profile it only shows who is in.
 */
export function ProfileSwitcher({ initials, label, display, avatarUrl = null, name, profiles, accountHref = '/account', helpHref }: { initials: string; label: string; display?: string; avatarUrl?: string | null; name?: string; profiles: SwitcherProfile[]; accountHref?: string; helpHref?: string }) {
  const who = display || name || label
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const many = profiles.length > 1

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); button.current?.focus() } }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])

  async function pick(kind: ProfileKindKey) {
    setBusy(kind); setError(null)
    const err = await switchProfile(kind)
    if (err) { setBusy(null); setError(err) }
  }

  return (
    <div className="ha-switcher" ref={wrap}>
      <button ref={button} type="button" className="ha-profilebtn" aria-haspopup="menu" aria-expanded={open} aria-controls={open ? menuId : undefined}
        aria-label={many ? `${who}, perfil ${label}. Trocar de perfil` : `Conta de ${who}`} onClick={() => setOpen((v) => !v)}>
        <span className="ha-avatar"><AvatarFace initials={initials} url={avatarUrl} /></span>
        <span className="ha-profilebtn__name">{who}</span>
        <Icon name={many ? 'swap_horiz' : 'expand_more'} size={18} />
      </button>
      {open ? (
        <div className="ha-switcher__menu" role="menu" id={menuId} aria-label="Conta">
          {name ? <p className="ha-switcher__who">{name}</p> : null}
          {many ? <p className="ha-switcher__label">Trocar de perfil</p> : null}
          {many ? profiles.map((p) => (
            <button key={p.kind} type="button" role="menuitemradio" aria-checked={p.active} className={`ha-switcher__item${p.active ? ' ha-switcher__item--on' : ''}`}
              disabled={busy !== null} onClick={() => (p.active ? setOpen(false) : pick(p.kind))}>
              <Icon name={p.icon} size={20} />
              <span>{busy === p.kind ? 'Trocando…' : p.name}</span>
              {p.active ? <Icon name="check" size={18} /> : null}
            </button>
          )) : null}
          {error ? <p className="ha-field-error" role="alert">{error}</p> : null}
          <div className="ha-switcher__sep" />
          <Link role="menuitem" href={accountHref} className="ha-switcher__item" onClick={() => setOpen(false)}><Icon name="person" size={20} /><span>Minha conta</span></Link>
          {helpHref ? <Link role="menuitem" href={helpHref} className="ha-switcher__item" onClick={() => setOpen(false)}><Icon name="help" size={20} /><span>Ajuda</span></Link> : null}
          <Link role="menuitem" href="/install" className="ha-switcher__item" onClick={() => setOpen(false)}><Icon name="install_mobile" size={20} /><span>Instalar o app</span></Link>
          <a role="menuitem" href="/simulator" target="_blank" rel="noopener" className="ha-switcher__item" onClick={() => setOpen(false)}><Icon name="smartphone" size={20} /><span>Simulador do app</span></a>
          <form action="/api/auth/logout" method="post">
            <button type="submit" role="menuitem" className="ha-switcher__item"><Icon name="logout" size={20} /><span>Sair</span></button>
          </form>
        </div>
      ) : null}
    </div>
  )
}
