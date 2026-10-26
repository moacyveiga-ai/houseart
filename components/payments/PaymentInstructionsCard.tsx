'use client'
// What the buyer needs to pay a Pix or a boleto (checkout "done" and Compras): the QR + "copia e cola",
// or the boleto line + PDF, the amount and the deadline. Paid only when the bank confirms — the page
// refreshes on its own every few seconds while it waits. In mock, "Simular pagamento" stands for the bank.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ds/Icon'
import { formatBRL } from '@/lib/artworks/domain'
import type { PaymentInstructions } from '@/lib/payments/async-core'
import './payment-instructions.css'

const when = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Bahia' })

export function PaymentInstructionsCard({ dealId, i, onPaid }: { dealId: number; i: PaymentInstructions; onPaid?: () => void }) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const code = i.method === 'PIX' ? i.pixCode : i.boletoNumber
  // while it waits, the page asks the server again (the webhook marks it paid)
  useEffect(() => {
    if (i.mock) return
    const t = window.setInterval(() => router.refresh(), 8000)
    return () => window.clearInterval(t)
  }, [i.mock, router])
  async function copy() {
    if (!code) return
    try { await navigator.clipboard.writeText(i.method === 'BOLETO' ? code.replace(/\D/g, '') : code); setCopied(true); window.setTimeout(() => setCopied(false), 2500) } catch { setError('Não foi possível copiar. Selecione o código e copie.') }
  }
  async function simulate() {
    setBusy(true); setError('')
    const res = await fetch(`/api/deals/${dealId}/escrow`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ simulate: true }) })
    const data = await res.json().catch(() => ({})) as { error?: string }
    setBusy(false)
    if (!res.ok) { setError(data.error ?? 'Não foi possível confirmar.'); return }
    if (onPaid) onPaid(); else router.refresh()
  }
  return (
    <section className="ha-pay" aria-live="polite">
      <div className="ha-pay__head">
        <Icon name={i.method === 'PIX' ? 'qr_code_2' : 'receipt_long'} size={22} />
        <span className="ha-stack" style={{ gap: 0 }}><b>{i.method === 'PIX' ? 'Pague com Pix' : 'Pague o boleto'}</b><span className="ha-pay__muted">{formatBRL(BigInt(i.amountCents))} · {i.method === 'PIX' ? 'vence' : 'vencimento'} {when(i.expiresAt)}</span></span>
      </div>
      {i.method === 'PIX' && i.pixQrUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- the provider's QR image or our data: URL
        <img className="ha-pay__qr" src={i.pixQrUrl} alt="QR Code do Pix" width={220} height={220} />
      ) : null}
      {code ? (
        <div className="ha-pay__code">
          <span className="ha-pay__muted">{i.method === 'PIX' ? 'Pix copia e cola' : 'Linha digitável'}</span>
          <code>{code}</code>
          <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" onClick={copy}><Icon name={copied ? 'check' : 'content_copy'} size={18} />{copied ? 'Copiado' : 'Copiar código'}</button>
        </div>
      ) : null}
      <div className="ha-pay__links">
        {i.boletoPdfUrl ? <a className="ha-link" href={i.boletoPdfUrl} target="_blank" rel="noreferrer">Baixar o boleto (PDF)</a> : null}
        {i.hostedUrl ? <a className="ha-link" href={i.hostedUrl} target="_blank" rel="noreferrer">Abrir instruções de pagamento</a> : null}
      </div>
      <p className="ha-pay__muted">{i.method === 'PIX' ? 'A confirmação chega em segundos depois do pagamento.' : 'O boleto compensa em até 1 dia útil depois do pagamento.'} O valor fica retido na HouseArt até você confirmar a entrega. Sem pagamento até o vencimento, a reserva da obra é desfeita.</p>
      {i.mock ? <button type="button" className="ha-btn ha-btn--ink ha-btn--sm" disabled={busy} onClick={simulate}><Icon name="bolt" size={18} />Simular pagamento (ambiente de demonstração)</button> : null}
      {error ? <p className="ha-field-error" role="alert">{error}</p> : null}
    </section>
  )
}
