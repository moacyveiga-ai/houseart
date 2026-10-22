'use client'
import { useState } from 'react'

export function ResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(null)
    if (password !== confirm) { setError('As senhas não conferem.'); return }
    setBusy(true)
    const res = await fetch('/api/auth/password/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, password }) })
    const data = await res.json().catch(() => ({})) as { error?: string }
    setBusy(false)
    if (!res.ok) { setError(data.error ?? 'Não foi possível salvar a senha.'); return }
    setDone(true)
  }
  if (!token) {
    return <div className="ha-stack"><p className="ha-field-error" role="alert">Link inválido ou expirado. Peça um novo link.</p><a className="ha-link" href="/recover-password">Pedir novo link</a></div>
  }
  if (done) {
    return <div className="ha-stack"><p className="ha-muted">Senha salva. Entre de novo com a senha nova.</p><a className="ha-btn ha-btn--primary ha-btn--md" href="/login">Entrar</a></div>
  }
  return (
    <form className="ha-stack" onSubmit={submit}>
      <label className="ha-label">Nova senha<input className="ha-input" type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} /></label>
      <label className="ha-label">Confirmar senha<input className="ha-input" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} /></label>
      <label className="ha-check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Mostrar senha</label>
      {error ? <p className="ha-field-error" role="alert">{error}</p> : null}
      <button className="ha-btn ha-btn--primary ha-btn--md" disabled={busy} type="submit">Salvar senha</button>
    </form>
  )
}
