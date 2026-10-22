'use client'
import { useState } from 'react'

/** "Esqueci minha senha": blind — the same answer whether or not the e-mail has an account. */
export function ForgotPasswordForm({ initialEmail = '', onBack }: { initialEmail?: string; onBack?: () => void }) {
  const [email, setEmail] = useState(initialEmail)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null)
    const res = await fetch('/api/auth/password/forgot', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) })
    const data = await res.json().catch(() => ({})) as { error?: string }
    setBusy(false)
    if (!res.ok) { setError(data.error ?? 'Não foi possível enviar o link.'); return }
    setSent(true)
  }
  if (sent) {
    return (
      <div className="ha-stack">
        <p className="ha-muted">Se <b>{email}</b> tiver conta, o link para redefinir a senha chega em instantes. Ele vale por 1 hora.</p>
        {onBack ? <button type="button" className="ha-link" onClick={onBack}>Voltar para entrar</button> : <a className="ha-link" href="/login">Voltar para entrar</a>}
      </div>
    )
  }
  return (
    <form className="ha-stack" onSubmit={submit}>
      <label className="ha-label">E-mail<input className="ha-input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      {error ? <p className="ha-field-error" role="alert">{error}</p> : null}
      <button className="ha-btn ha-btn--primary ha-btn--md" disabled={busy} type="submit">Enviar link</button>
      {onBack ? <button type="button" className="ha-link" onClick={onBack}>Voltar para entrar</button> : <a className="ha-link" href="/login">Voltar para entrar</a>}
    </form>
  )
}
