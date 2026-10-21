'use client'
import { useState } from 'react'
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
      <section className="ha-card ha-stack">
        <div className="ha-eyebrow">Seu plano</div>
        {plan ? (
          <div className="ha-row ha-row--between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--ha-space-4)' }}>
            <div><h2 className="ha-h2">{plan.name}</h2><p className="ha-muted">{plan.description}</p></div>
            <div style={{ textAlign: 'right' }}><div className="ha-h2 ha-num">{plan.priceLabel}<span className="ha-muted ha-sm"> /mês</span></div>
              {plansOn ? <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" onClick={() => setOpen(true)}>Mudar de plano</button> : null}</div>
          </div>
        ) : <p className="ha-muted">Sua conta não tem plano: colecionadores e a equipe pagam só pelos serviços que usam.</p>}
      </section>
      {bars.length > 0 ? (
        <section className="ha-card ha-stack">
          <div className="ha-eyebrow">Uso em {monthLabel}</div>
          {bars.map((b) => (
            <div key={b.key} className="ha-stack" style={{ gap: 'var(--ha-space-1)' }}>
              <div className="ha-row ha-row--between"><span>{b.label}</span><span className="ha-num ha-muted">{b.text}</span></div>
              <Progress value={b.pct} label={b.label} />
            </div>
          ))}
        </section>
      ) : null}
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
