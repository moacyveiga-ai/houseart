'use client'
import { useState } from 'react'

export function OfferForm({ publicId, fixedPriceCents }: { publicId: string; fixedPriceCents: string | null }) {
  const [form, setForm] = useState({ buyerName: '', buyerEmail: '', buyerDocument: '', buyerCity: '', offeredCents: fixedPriceCents ? String(Number(fixedPriceCents) / 100) : '', message: '' })
  const [code, setCode] = useState<string | null>(null)
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function post(url: string, body: unknown) {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    return { res, data: await res.json().catch(() => ({})) as { error?: string; code?: string; href?: string } }
  }
  async function start(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null)
    const { res, data } = await post('/api/public/offers', { ...form, publicId, offeredCents: Math.round(Number(form.offeredCents.replace(/\D/g, '')) * 100) })
    setBusy(false)
    if (!res.ok) { setError(data.error ?? 'Não foi possível enviar.'); return }
    setCode(data.code ?? null)
  }
  async function confirm(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null)
    const { res, data } = await post(`/api/public/offers/${code}/confirm`, { otp })
    setBusy(false)
    if (!res.ok) { setError(data.error ?? 'Código inválido.'); return }
    window.location.assign(data.href ?? '/')
  }
  if (code) {
    return (
      <form className="ha-stack" onSubmit={confirm}>
        <p className="ha-muted">Enviamos um código de 6 dígitos para <b>{form.buyerEmail}</b>. Confirme para registrar a proposta <b>{code}</b>.</p>
        <label className="ha-label">Código<input className="ha-input" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} required /></label>
        {error ? <p className="ha-field-error" role="alert">{error}</p> : null}
        <button className="ha-btn ha-btn--primary ha-btn--md" disabled={busy} type="submit">Confirmar proposta</button>
      </form>
    )
  }
  return (
    <form className="ha-stack" onSubmit={start}>
      <h2 className="ha-h3">{fixedPriceCents ? 'Comprar' : 'Fazer proposta'}</h2>
      <label className="ha-label">Nome completo<input className="ha-input" value={form.buyerName} onChange={(e) => setForm({ ...form, buyerName: e.target.value })} required /></label>
      <label className="ha-label">E-mail<input className="ha-input" type="email" value={form.buyerEmail} onChange={(e) => setForm({ ...form, buyerEmail: e.target.value })} required /></label>
      <label className="ha-label">CPF<input className="ha-input" inputMode="numeric" value={form.buyerDocument} onChange={(e) => setForm({ ...form, buyerDocument: e.target.value })} required /></label>
      <label className="ha-label">Cidade/UF<input className="ha-input" placeholder="Recife/PE" value={form.buyerCity} onChange={(e) => setForm({ ...form, buyerCity: e.target.value })} /></label>
      <label className="ha-label">Valor da proposta (R$)<input className="ha-input ha-input--num" inputMode="numeric" value={form.offeredCents} readOnly={!!fixedPriceCents} onChange={(e) => setForm({ ...form, offeredCents: e.target.value })} required /></label>
      <label className="ha-label">Mensagem (opcional)<textarea className="ha-textarea" rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></label>
      {error ? <p className="ha-field-error" role="alert">{error}</p> : null}
      <button className="ha-btn ha-btn--primary ha-btn--md" disabled={busy} type="submit">{fixedPriceCents ? 'Confirmar compra' : 'Enviar proposta'}</button>
      <p className="ha-muted ha-sm">A proposta vale 7 dias. Você pode retratá-la em até 24 horas (art. 427 do Código Civil).</p>
    </form>
  )
}
