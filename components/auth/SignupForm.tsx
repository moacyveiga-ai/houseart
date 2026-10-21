'use client'
import { useState } from 'react'
import { PROFILE_CARDS } from '@/lib/profiles/core'

const SELF_SIGNUP = ['ARTIST', 'GALLERY', 'ADVISOR', 'COLLECTOR'] as const

export function SignupForm() {
  const [form, setForm] = useState({ name: '', email: '', password: '', profileKind: 'ARTIST' as (typeof SELF_SIGNUP)[number] })
  const [token, setToken] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function post(url: string, body: unknown) {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    return { res, data: await res.json().catch(() => ({})) as { error?: string; token?: string } }
  }
  async function start(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null)
    const { res, data } = await post('/api/auth/signup/start', form)
    setBusy(false)
    if (!res.ok) { setError(data.error ?? 'Não foi possível criar a conta.'); return }
    setToken(data.token ?? null)
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null)
    const { res, data } = await post('/api/auth/code/verify', { token, code })
    setBusy(false)
    if (!res.ok) { setError(data.error ?? 'Código inválido.'); return }
    window.location.assign('/profiles')
  }
  if (token) {
    return (
      <form className="ha-stack" onSubmit={verify}>
        <p className="ha-muted">Enviamos um código de 6 dígitos para <b>{form.email}</b>.</p>
        <label className="ha-label">Código<input className="ha-input" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required /></label>
        {error ? <p className="ha-field-error" role="alert">{error}</p> : null}
        <button className="ha-btn ha-btn--primary ha-btn--md" disabled={busy} type="submit">Confirmar e criar conta</button>
      </form>
    )
  }
  return (
    <form className="ha-stack" onSubmit={start}>
      <div className="ha-stack ha-stack--3">
        {PROFILE_CARDS.filter((c) => (SELF_SIGNUP as readonly string[]).includes(c.kind)).map((c) => (
          <label key={c.kind} className={`ha-radio-card${form.profileKind === c.kind ? ' ha-radio-card--on' : ''}`}>
            <input type="radio" name="profileKind" value={c.kind} checked={form.profileKind === c.kind} onChange={() => setForm({ ...form, profileKind: c.kind as (typeof SELF_SIGNUP)[number] })} className="ha-sr" />
            <span className="ha-radio-card__dot" /><span><b>{c.name}</b><br /><span className="ha-muted ha-sm">{c.description}</span></span>
          </label>
        ))}
      </div>
      <label className="ha-label">Nome completo<input className="ha-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required minLength={3} /></label>
      <label className="ha-label">E-mail<input className="ha-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
      <label className="ha-label">Senha<input className="ha-input" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} /></label>
      {error ? <p className="ha-field-error" role="alert">{error}</p> : null}
      <button className="ha-btn ha-btn--primary ha-btn--md" disabled={busy} type="submit">Receber código por e-mail</button>
      <a className="ha-link" href="/login">Já tenho conta</a>
    </form>
  )
}
