'use client'
// "Aceitar e entrar": POST /api/gallery/team/accept and follow the `href` of the answer.
import { useState } from 'react'
import { Button } from '@/components/ds/Button'

export function AcceptInviteScreen({ token, inviteEmail, userEmail }: { token: string; inviteEmail: string; userEmail: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mismatch = inviteEmail.toLowerCase() !== userEmail.toLowerCase()
  async function accept() {
    setBusy(true); setError('')
    const res = await fetch('/api/gallery/team/accept', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token }) })
    const data = await res.json().catch(() => ({})) as { href?: string; error?: string }
    if (!res.ok || !data.href) { setBusy(false); setError(data.error ?? 'Não foi possível aceitar o convite.'); return }
    window.location.assign(data.href)
  }
  return (
    <div className="ha-stack ha-stack--3">
      {mismatch ? <p className="ha-team-accept__err" role="alert">Este convite foi enviado a {inviteEmail}. Entre com essa conta para aceitar.</p> : null}
      {error ? <p className="ha-team-accept__err" role="alert">{error}</p> : null}
      <Button variant="ink" size="md" icon="login" loading={busy} disabled={mismatch} onClick={accept}>Aceitar e entrar</Button>
    </div>
  )
}
