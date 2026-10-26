'use client'
// "Pagar em garantia" on Compras (a deal waiting for the escrow): Pix · Cartão · Boleto, as the checkout.
// A pending Pix/boleto shows its instructions; "Trocar forma de pagamento" drops it for another.
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ds/Icon'
import { formatBRL } from '@/lib/artworks/domain'
import { PAY_METHODS, maskCep, type PayMethod } from '@/components/checkout/checkout-core'
import { boletoBillingProblem, type PaymentInstructions } from '@/lib/payments/async-core'
import { PaymentInstructionsCard } from './PaymentInstructionsCard'
import '@/components/checkout/checkout.css'

export function EscrowPay({ dealId, totalCents, pending }: { dealId: number; totalCents: string; pending: PaymentInstructions | null }) {
  const router = useRouter()
  const [instr, setInstr] = useState<PaymentInstructions | null>(pending)
  const [changing, setChanging] = useState(false)
  const [method, setMethod] = useState<PayMethod>(pending?.method ?? 'PIX')
  const [bill, setBill] = useState({ taxId: '', line1: '', city: '', state: '', postalCode: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const total = formatBRL(BigInt(totalCents))
  const problem = method === 'BOLETO' ? boletoBillingProblem(bill) : null

  async function pay() {
    if (problem) { setError(problem); return }
    setBusy(true); setError('')
    const res = await fetch(`/api/deals/${dealId}/escrow`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(method === 'CARD' ? { method } : { method, billing: method === 'BOLETO' ? { ...bill, postalCode: bill.postalCode.replace(/\D/g, '') } : undefined }) })
    const data = await res.json().catch(() => ({})) as { paid?: boolean; instructions?: PaymentInstructions | null; error?: string }
    setBusy(false)
    if (!res.ok) { setError(data.error ?? 'Não foi possível registrar.'); return }
    if (data.paid || !data.instructions) { router.refresh(); return }
    setInstr(data.instructions); setChanging(false)
  }

  if (instr && !changing) {
    return (
      <div className="ha-stack">
        <PaymentInstructionsCard dealId={dealId} i={instr} />
        <button type="button" className="ha-link ha-link--quiet" style={{ alignSelf: 'flex-start', background: 'none', border: 0, padding: 0, cursor: 'pointer' }} onClick={() => setChanging(true)}>Trocar forma de pagamento</button>
      </div>
    )
  }
  return (
    <div className="ha-stack">
      <div role="radiogroup" aria-label="Forma de pagamento" className="hc-methods">
        {PAY_METHODS.map((m) => (
          <button key={m.key} type="button" role="radio" aria-checked={method === m.key} className={`hc-method${method === m.key ? ' hc-method--on' : ''}`} onClick={() => { setMethod(m.key); setError('') }}>
            <Icon name={m.icon} size={24} /><span className="hc-option__name">{m.name}</span><span className="hc-option__sub">{m.key === 'CARD' ? 'cartão padrão da carteira' : m.sub}</span>
          </button>
        ))}
      </div>
      {method === 'BOLETO' ? (
        <div className="hc-billing">
          <label className="hc-address__field"><span>CPF ou CNPJ de quem paga</span><input className="ha-input" inputMode="numeric" value={bill.taxId} onChange={(e) => setBill({ ...bill, taxId: e.target.value.replace(/[^\d./-]/g, '').slice(0, 18) })} /></label>
          <label className="hc-address__field"><span>Endereço (rua e número)</span><input className="ha-input" autoComplete="address-line1" value={bill.line1} onChange={(e) => setBill({ ...bill, line1: e.target.value.slice(0, 200) })} /></label>
          <div className="hc-billing__row">
            <label className="hc-address__field"><span>Cidade</span><input className="ha-input" value={bill.city} onChange={(e) => setBill({ ...bill, city: e.target.value.slice(0, 80) })} /></label>
            <label className="hc-address__field hc-billing__uf"><span>UF</span><input className="ha-input" maxLength={2} value={bill.state} onChange={(e) => setBill({ ...bill, state: e.target.value.replace(/[^a-z]/gi, '').toUpperCase().slice(0, 2) })} /></label>
            <label className="hc-address__field"><span>CEP</span><input className="ha-input" inputMode="numeric" value={bill.postalCode} onChange={(e) => setBill({ ...bill, postalCode: maskCep(e.target.value) })} /></label>
          </div>
        </div>
      ) : null}
      {error ? <p className="ha-field-error" role="alert">{error}</p> : null}
      <div className="ha-row" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="ha-btn ha-btn--primary ha-btn--md" disabled={busy} aria-busy={busy || undefined} onClick={pay}>{method === 'PIX' ? `Pagar ${total} com Pix` : method === 'BOLETO' ? `Pagar ${total} no boleto` : `Pagar em garantia · ${total}`}</button>
        {instr ? <button type="button" className="ha-btn ha-btn--outline ha-btn--md" onClick={() => setChanging(false)}>Voltar</button> : null}
      </div>
    </div>
  )
}
