'use client'
import { useState } from 'react'

export function BuyerAccept({ token, status, signed }: { token: string; status: string; signed: boolean }) {
  const [doc, setDoc] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  async function post(path: string, body: unknown) {
    const res = await fetch(`/api/transfer/${token}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({})) as { error?: string }
    setMsg(res.ok ? 'Registrado.' : data.error ?? 'Falha.')
    if (res.ok) window.setTimeout(() => window.location.reload(), 700)
  }
  if (status === 'COMPLETED') return <p className="ha-callout">Escritura emitida em seu nome. Entre na HouseArt pelo seu e-mail para ver a carteira.</p>
  if (status === 'AWAITING_TAP') return <div className="ha-stack"><p>Com a obra em mãos, encoste o celular na etiqueta do verso.</p><button type="button" className="ha-btn ha-btn--primary ha-btn--md" onClick={() => post('tap', {})}>Confirmar o toque</button>{msg ? <p className="ha-muted ha-sm">{msg}</p> : null}</div>
  if (signed) return <p className="ha-muted">Você já assinou. Aguardando o vendedor e o pagamento da taxa.</p>
  return (
    <form className="ha-stack" onSubmit={(e) => { e.preventDefault(); void post('accept', { document: doc }) }}>
      <label className="ha-label">Confirme seu CPF<input className="ha-input" inputMode="numeric" value={doc} onChange={(e) => setDoc(e.target.value)} required /></label>
      <p className="ha-muted ha-sm">A identidade é conferida (CPF e biometria) antes da assinatura.</p>
      <button className="ha-btn ha-btn--primary ha-btn--md" type="submit">Confirmar identidade e assinar</button>
      {msg ? <p className="ha-muted ha-sm">{msg}</p> : null}
    </form>
  )
}
