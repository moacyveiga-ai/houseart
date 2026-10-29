'use client'
import { useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Toast } from '@/components/ds/Toast'
import { TagReader } from '@/components/ds/TagReader'
import { formatBRL } from '@/lib/artworks/domain'
import type { SerializableDeal as Serializable } from './deal-view'
import { EscrowPay } from '@/components/payments/EscrowPay'
import { TalkToSellerButton } from '@/components/public/TalkToSellerButton'
import { PackagingForm, PackagingView } from './Packaging'
import { canRecordPackaging } from '@/lib/deals/packaging-core'
import { purchasePct, purchaseSteps } from '@/lib/deals/purchase-progress-core'

type Side = 'seller' | 'buyer'

export function DealTimeline({ deal, side }: { deal: Serializable; side: Side }) {
  const [toast, setToast] = useState('')
  const [ship, setShip] = useState({ carrier: '', tracking: '', insurer: '' })
  const [busy, setBusy] = useState(false)
  async function post(path: string, body?: unknown) {
    setBusy(true)
    try {
      const res = await fetch(`/api/deals/${deal.id}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) })
      const data = await res.json().catch(() => ({})) as { error?: string }
      setToast(res.ok ? (path === 'confirm-delivery' ? 'Leitura válida · escritura transferida' : 'Registrado.') : data.error ?? 'Não foi possível registrar.')
      if (res.ok) { window.setTimeout(() => window.location.reload(), 700); return }
    } catch { setToast('Sem conexão. Tente de novo.') }
    setBusy(false)
  }
  const amount = BigInt(deal.amountCents)
  const shipping = BigInt(deal.shippingCents)
  const insurance = BigInt(deal.insuranceCents)
  const extras = shipping + insurance
  const done = deal.phase === 'COMPLETED'
  // the buyer reads the deal in the five steps of "Acompanhar compra"; the seller keeps the six phases
  const steps = side === 'buyer' ? purchaseSteps(deal) : deal.steps
  const pct = side === 'buyer' ? purchasePct(deal.phase) : deal.progressPct
  return (
    <section className="ha-card ha-card--pad ha-stack">
      <div className="ha-row">
        {/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
        <span className="ha-wall ha-wall--72">{deal.cover ? <img src={deal.cover} alt="" /> : null}</span>
        <div style={{ flex: 1 }}>
          <div className="ha-title">{deal.artworkTitle}</div>
          <div className="ha-muted ha-sm">{side === 'buyer' ? `${deal.artist} · ${deal.sellerName}` : `${deal.market === 'PRIMARY' ? 'Venda' : 'Revenda'} · ${formatBRL(amount)} · comprador ${deal.buyerName}`}</div>
        </div>
        <div className="ha-num">{pct}%</div>
      </div>
      <div className="ha-progress"><span style={{ width: `${pct}%` }} /></div>
      <ol className="ha-timeline">
        {steps.map((s, i) => (
          <li key={s.title} className={`ha-timeline__item ha-timeline__item--${s.state}${i === steps.length - 1 ? ' ha-timeline__item--last' : ''}`}>
            <span className="ha-timeline__rail"><span className="ha-timeline__dot"><Icon name={s.icon} size={18} /></span><span className="ha-timeline__line" /></span>
            <div className="ha-timeline__body"><div className="ha-timeline__name">{s.title}</div><div className="ha-timeline__desc">{s.description}</div></div>
            <div className="ha-timeline__date">{s.date ?? '—'}</div>
          </li>
        ))}
      </ol>
      {side === 'seller' ? (
        <div className="ha-stack">
          <h3 className="ha-h3">Repartição dos valores</h3>
          <div className="ha-kv">{deal.split.map((s) => [<span key={`k${s.party}`}>{s.label}{s.party === 'PLATFORM' ? ` · ${deal.market === 'PRIMARY' ? '12%' : '4%'}` : ''}</span>, <span key={`v${s.party}`} className="ha-num">{formatBRL(BigInt(s.amountCents))}{s.payoutLabel ? ` · ${s.payoutLabel}` : s.status === 'RELEASED' ? ' · liberado' : ''}</span>])}</div>
          {canRecordPackaging(deal.phase, deal.exception) ? <PackagingForm dealId={deal.id} p={deal.packaging} onDone={setToast} /> : <PackagingView p={deal.packaging} />}
          {deal.shipping ? <p className="ha-muted ha-sm">Transporte {deal.shipping.carrier} · rastreio {deal.shipping.tracking}{deal.shipping.insurer ? ` · seguro de trânsito ${deal.shipping.insurer}` : ''}</p> : null}
          {deal.phase === 'ESCROW' && !deal.sellerSigned ? <button type="button" className="ha-btn ha-btn--primary ha-btn--md" disabled={busy} onClick={() => post('sign')}>Assinar o termo de transferência</button> : null}
          {deal.phase === 'DOCUMENTS' ? (
            <div className="ha-row">
              <input className="ha-input" placeholder="Transportadora" value={ship.carrier} onChange={(e) => setShip({ ...ship, carrier: e.target.value })} />
              <input className="ha-input" placeholder="Rastreio" value={ship.tracking} onChange={(e) => setShip({ ...ship, tracking: e.target.value })} />
              <input className="ha-input" placeholder="Seguradora (opcional)" value={ship.insurer} onChange={(e) => setShip({ ...ship, insurer: e.target.value })} />
              <button type="button" className="ha-btn ha-btn--primary ha-btn--sm" disabled={busy || !ship.carrier || !ship.tracking} onClick={() => post('shipping', { carrier: ship.carrier, tracking: ship.tracking, insurer: ship.insurer || undefined })}>Registrar envio</button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="ha-stack">
          {/* The app's "Acompanhar compra": the values paid in escrow (work + shipping + insurance). */}
          <div className="ha-kv">
            <span>Obra</span><span className="ha-num">{formatBRL(amount)}</span>
            <span>Frete</span><span className="ha-num">{shipping ? formatBRL(shipping) : 'Grátis'}</span>
            <span>Seguro</span><span className="ha-num">{insurance ? formatBRL(insurance) : '—'}</span>
            <span><b>{deal.escrowPaid || done ? 'Pago em garantia' : 'A pagar em garantia'}</b></span><span className="ha-num"><b>{formatBRL(amount + extras)}</b></span>
          </div>
          <PackagingView p={deal.packaging} />
          {deal.phase === 'OFFER_ACCEPTED' && !deal.exception ? <EscrowPay dealId={deal.id} totalCents={(amount + extras).toString()} pending={deal.escrowPending} /> : null}
          {/* Compras · "Falar com o vendedor" (HouseArt Web App.dc.html): the conversation with who SOLD, about this artwork */}
          {deal.exception !== 'CANCELLED' ? <div className="ha-row"><TalkToSellerButton dealId={deal.id} signedIn label="Falar com o vendedor" className="ha-btn ha-btn--outline ha-btn--sm" /></div> : null}
          {deal.exception === 'CANCELLED' ? <p className="ha-muted">Negócio cancelado: o pagamento não foi identificado no prazo e a reserva da obra foi desfeita.</p> : null}
          {deal.phase === 'ESCROW' && !deal.buyerSigned ? <button type="button" className="ha-btn ha-btn--primary ha-btn--md" disabled={busy} onClick={() => post('sign')}>Assinar o termo de transferência</button> : null}
          {deal.phase === 'ESCROW' && deal.buyerSigned && !deal.sellerSigned ? <p className="ha-muted">Aguardando a assinatura do vendedor.</p> : null}
          {/* Compras › cartão de recebimento (HouseArt Web App.dc.html: "A obra chegou?" → "Escritura emitida em seu nome") */}
          {done ? (
            <div className="ha-callout ha-callout--ok">
              <Icon name="check" />
              <div className="ha-stack ha-stack--3">
                <div>
                  <b>Escritura emitida em seu nome</b>
                  <p className="ha-sm">A obra entrou na sua carteira e o pagamento foi liberado ao vendedor.</p>
                </div>
                <div className="ha-row">
                  <a href="/wallet" className="ha-btn ha-btn--primary ha-btn--sm"><Icon name="collections" size={18} />Ver na coleção</a>
                  {deal.exception ? null : <a href={`/api/deals/${deal.id}/receipt`} download className="ha-btn ha-btn--outline ha-btn--sm"><Icon name="download" size={18} />Baixar comprovante</a>}
                </div>
              </div>
            </div>
          ) : deal.phase === 'SHIPPING' ? (
            <TagReader state="confirm" title="A obra chegou?" subtitle="Abra o app e encoste o celular na etiqueta do verso. A leitura confirma a posse: o pagamento é liberado ao vendedor e a escritura passa para o seu nome no mesmo instante.">
              <button type="button" className="ha-btn ha-btn--primary ha-btn--md" disabled={busy} onClick={() => { void post('confirm-delivery') }}><Icon name="contactless" size={18} />Confirmar recebimento</button>
            </TagReader>
          ) : deal.phase === 'DELIVERY' || deal.phase === 'TRANSFER' ? (
            <div className="ha-callout"><Icon name="contract" /><p className="ha-sm" style={{ margin: 0 }}>Leitura registrada. Estamos concluindo a escritura: em até 1 h ela aparece na sua coleção.</p></div>
          ) : null}
        </div>
      )}
      <Toast message={toast} onDone={() => setToast('')} />
    </section>
  )
}
