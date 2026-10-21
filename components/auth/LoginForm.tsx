'use client'
import { useState } from 'react'
import { Icon } from '@/components/ds/Icon'

type Mode = 'password' | 'code'

export function LoginForm({ next }: { next: string | null }) {
  const [mode, setMode] = useState<Mode>('password')
  const [credential, setCredential] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function post(url: string, body: unknown) {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string; token?: string; next?: string | null }
    return { res, data }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null)
    const { res, data } = await post('/api/auth/login', { credential, password, next })
    setBusy(false)
    if (!res.ok) { setError(data.error ?? 'Não foi possível entrar.'); return }
    window.location.assign(data.next ?? '/profiles')
  }

  async function startCode(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null)
    const { res, data } = await post('/api/auth/code/start', { email: credential })
    setBusy(false)
    if (!res.ok) { setError(data.error ?? 'Não foi possível enviar o código.'); return }
    setToken(data.token ?? null)
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null)
    const { res, data } = await post('/api/auth/code/verify', { token, code, next })
    setBusy(false)
    if (!res.ok) { setError(data.error ?? 'Código inválido.'); return }
    window.location.assign(data.next ?? '/profiles')
  }

  if (mode === 'code' && token) {
    return (
      <form className="ha-stack" onSubmit={verifyCode}>
        <p className="ha-muted">Enviamos um código de 6 dígitos para <b>{credential}</b>. Ele vale por 15 minutos.</p>
        <label className="ha-label">Código<input className="ha-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required /></label>
        {error ? <p className="ha-field-error" role="alert">{error}</p> : null}
        <button className="ha-btn ha-btn--primary ha-btn--md" disabled={busy} type="submit">Entrar</button>
        <button type="button" className="ha-link" onClick={() => post('/api/auth/code/resend', { token })}>Reenviar código</button>
        <button type="button" className="ha-link" onClick={() => { setToken(null); setMode('password') }}>Voltar</button>
      </form>
    )
  }

  return (
    <form className="ha-stack" onSubmit={mode === 'password' ? submitPassword : startCode}>
      <button type="button" className="ha-btn ha-btn--ink ha-btn--md" onClick={() => setMode(mode === 'password' ? 'code' : 'password')}>
        <Icon name="mail" size={18} />{mode === 'password' ? 'Entrar com e-mail' : 'Entrar com senha'}
      </button>
      <div className="ha-divider"><span>ou</span></div>
      <label className="ha-label">E-mail ou celular<input className="ha-input" autoComplete="username" value={credential} onChange={(e) => setCredential(e.target.value)} required /></label>
      {mode === 'password' ? (
        <label className="ha-label">Senha<input className="ha-input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
      ) : null}
      {error ? <p className="ha-field-error" role="alert">{error}</p> : null}
      <button className="ha-btn ha-btn--primary ha-btn--md" disabled={busy} type="submit">{mode === 'password' ? 'Entrar' : 'Receber código'}</button>
      <div className="ha-row ha-login__links">
        <a className="ha-link ha-link--quiet" href="/recover-password">Esqueci a senha</a>
        <a className="ha-link" href="/signup">Criar conta</a>
      </div>
    </form>
  )
}
