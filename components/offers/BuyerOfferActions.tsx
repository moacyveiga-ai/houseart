'use client'
import { useState } from 'react'

export function BuyerOfferActions({ code, token, canRetract, canReply }: { code: string; token: string; canRetract: boolean; canReply: boolean }) {
  const [amount, setAmount] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  async function post(path: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/public/offers/${code}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, ...body }) })
    const data = await res.json().catch(() => ({})) as { error?: string }
    setMsg(res.ok ? 'Registrado.' : data.error ?? 'Não foi possível registrar.')
    if (res.ok) window.setTimeout(() => window.location.reload(), 600)
  }
  return (
    <div className="ha-stack">
      {canReply ? (
        <div className="ha-row">
          <button type="button" className="ha-btn ha-btn--primary ha-btn--sm" onClick={() => post('reply', { accept: true })}>Aceitar a contraproposta</button>
          <input className="ha-input ha-input--num" placeholder="Nova proposta (R$)" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" disabled={!amount} onClick={() => post('reply', { accept: false, amountCents: Math.round(Number(amount.replace(/\D/g, '')) * 100) })}>Contrapropor</button>
        </div>
      ) : null}
      {canRetract ? <button type="button" className="ha-link" onClick={() => post('retract', {})}>Retratar a proposta (até 24 h do envio)</button> : null}
      {msg ? <p className="ha-muted ha-sm" role="status">{msg}</p> : null}
    </div>
  )
}
