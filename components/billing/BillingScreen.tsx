'use client'
import { useState } from 'react'
import './billing.css'
import { Modal } from '@/components/ds/Modal'
import { Progress } from '@/components/ds/Progress'
import { Badge } from '@/components/ds/Badge'
import { Toast } from '@/components/ds/Toast'
import { formatBRL } from '@/lib/artworks/domain'
import type { UsageBar } from '@/lib/plans/core'

export interface BillingPlanProps { code: string; name: string; description: string; priceLabel: string; priceCents: string }
export interface BillingOption { code: string; name: string; description: string; priceCents: string }
export interface BillingInvoice { id: string; date: string; description: string; amountCents: string; status: string; statusLabel: string; fiscalDocumentRef: string | null }

const TONE: Record<string, 'verified' | 'pending' | 'alert' | 'neutral'> = { PAID: 'verified', HELD_IN_SPLIT: 'pending', OPEN: 'alert', CANCELLED: 'neutral' }

export function BillingScreen({ plan, options, monthLabel, bars, invoices, plansOn }: { plan: BillingPlanProps | null; options: BillingOption[]; monthLabel: string; bars: UsageBar[]; invoices: BillingInvoice[]; plansOn: boolean }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  async function choose(code: string) {
    setBusy(true)
    const res = await fetch('/api/billing/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code }) })
    const data = await res.json().catch(() => ({})) as { error?: string }
    setBusy(false)
    if (!res.ok) { setToast(data.error ?? 'Não foi possível mudar de plano.'); return }
    setOpen(false); setToast('Plano alterado')
    window.setTimeout(() => window.location.reload(), 700)
  }
  return (
    <div className="ha-stack" style={{ gap: 'var(--ha-space-6)' }}>
      <h1 className="ha-h1">Cobrança</h1>
      {/* The prototype's top: the plan in a dark card and the month's usage beside it (stacked below 720 px). */}
      <div className="ha-billing__top">
        {plan ? (
          <section className="ha-billing__plan">
            <span className="ha-billing__plan-eyebrow">Seu plano</span>
            <span className="ha-billing__plan-name">{plan.name}</span>
            {plan.description ? <span className="ha-billing__plan-desc">{plan.description}</span> : null}
            <span className="ha-billing__plan-price ha-num">{plan.priceLabel}<span className="ha-billing__plan-per"> /mês</span></span>
            {plansOn ? <button type="button" className="ha-billing__plan-btn" onClick={() => setOpen(true)}>Mudar de plano</button> : null}
          </section>
        ) : <section className="ha-billing__plan"><span className="ha-billing__plan-eyebrow">Seu plano</span><span className="ha-billing__plan-desc">Sua conta não tem plano: colecionadores e a equipe pagam só pelos serviços que usam.</span></section>}
        {bars.length > 0 ? (
          <section className="ha-billing__usage">
            <span className="ha-billing__usage-title">Uso em {monthLabel}</span>
            {bars.map((b) => (
              <div key={b.key} className="ha-stack" style={{ gap: 'var(--ha-space-1)' }}>
                <div className="ha-row ha-row--between ha-sm"><span>{b.label}</span><span className="ha-num">{b.text}</span></div>
                <Progress value={b.pct} label={b.label} />
              </div>
            ))}
          </section>
        ) : null}
      </div>
      <section className="ha-stack">
        <div className="ha-eyebrow">Faturas e notas fiscais</div>
        <div className="ha-table" style={{ '--ha-cols': '110px 2fr 1fr 150px 80px' } as React.CSSProperties}>
          <div className="ha-table__inner">
            <div className="ha-table__head"><div>Data</div><div>Descrição</div><div>Valor</div><div>Status</div><div /></div>
            {invoices.length === 0 ? <div className="ha-table__row"><div className="ha-muted">Nenhuma fatura ainda.</div></div> : null}
            {invoices.map((f) => (
              <div key={f.id} className="ha-table__row">
                <div>{f.date}</div><div>{f.description}</div><div className="ha-num">{formatBRL(BigInt(f.amountCents))}</div>
                <div><Badge tone={TONE[f.status] ?? 'neutral'}>{f.statusLabel}</Badge></div>
                <div>{f.fiscalDocumentRef ? <a className="ha-link" href={f.fiscalDocumentRef} target="_blank" rel="noreferrer">NF-e</a> : <span className="ha-muted ha-sm">NF-e</span>}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <Modal open={open} title="Mudar de plano" onClose={() => setOpen(false)}>
        <div className="ha-stack">
          {options.map((o) => (
            <button type="button" key={o.code} disabled={busy || o.code === plan?.code} className={`ha-radio-card${o.code === plan?.code ? ' ha-radio-card--on' : ''}`} onClick={() => choose(o.code)}>
              <span className="ha-radio-card__dot" /><span><b>{o.name}</b> · <span className="ha-num">{BigInt(o.priceCents) === 0n ? 'Grátis' : `${formatBRL(BigInt(o.priceCents))}/mês`}</span><br /><span className="ha-muted ha-sm">{o.description}</span></span>
            </button>
          ))}
          <p className="ha-muted ha-sm">A primeira mensalidade é cobrada agora no cartão cadastrado.</p>
        </div>
      </Modal>
      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  )
}
