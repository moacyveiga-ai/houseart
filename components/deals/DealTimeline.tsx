'use client'
import { useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Toast } from '@/components/ds/Toast'
import { formatBRL } from '@/lib/artworks/domain'
import type { DealView } from '@/lib/deals/server'

type Side = 'seller' | 'buyer'
type Serializable = Omit<DealView, 'amountCents' | 'shippingCents' | 'insuranceCents' | 'split'> & { amountCents: string; shippingCents: string; insuranceCents: string; split: { party: string; label: string; amountCents: string; status: string }[] }

export function DealTimeline({ deal, side }: { deal: Serializable; side: Side }) {
  const [toast, setToast] = useState('')
  const [ship, setShip] = useState({ carrier: '', tracking: '', insurer: '' })
  async function post(path: string, body?: unknown) {
    const res = await fetch(`/api/deals/${deal.id}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}) })
    const data = await res.json().catch(() => ({})) as { error?: string }
    setToast(res.ok ? 'Registrado.' : data.error ?? 'Não foi possível registrar.')
    if (res.ok) window.setTimeout(() => window.location.reload(), 700)
  }
  const amount = BigInt(deal.amountCents)
  const extras = BigInt(deal.shippingCents) + BigInt(deal.insuranceCents)
  const done = deal.phase === 'COMPLETED'
  return (
    <section className="ha-card ha-card--pad ha-stack">
      <div className="ha-row">
        {/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
        <span className="ha-wall ha-wall--72">{deal.cover ? <img src={deal.cover} alt="" /> : null}</span>
        <div style={{ flex: 1 }}>
          <div className="ha-title">{deal.artworkTitle}</div>
          <div className="ha-muted ha-sm">{side === 'buyer' ? `${deal.artist} · ${deal.sellerName} · ${formatBRL(amount)}${extras ? ` + ${formatBRL(extras)} frete e seguro` : ''}` : `${deal.market === 'PRIMARY' ? 'Venda' : 'Revenda'} · ${formatBRL(amount)} · comprador ${deal.buyerName}`}</div>
        </div>
        <div className="ha-num">{deal.progressPct}%</div>
      </div>
      <div className="ha-progress"><span style={{ width: `${deal.progressPct}%` }} /></div>
      <ol className="ha-timeline">
        {deal.steps.map((s, i) => (
          <li key={s.phase} className={`ha-timeline__item ha-timeline__item--${s.state}${i === deal.steps.length - 1 ? ' ha-timeline__item--last' : ''}`}>
            <span className="ha-timeline__rail"><span className="ha-timeline__dot"><Icon name={s.icon} size={18} /></span><span className="ha-timeline__line" /></span>
            <div className="ha-timeline__body"><div className="ha-timeline__name">{s.title}</div><div className="ha-timeline__desc">{s.description}</div></div>
            <div className="ha-timeline__date">{s.date ?? '—'}</div>
          </li>
        ))}
      </ol>
      {side === 'seller' ? (
        <div className="ha-stack">
          <h3 className="ha-h3">Repartição dos valores</h3>
          <div className="ha-kv">{deal.split.map((s) => [<span key={`k${s.party}`}>{s.label}{s.party === 'PLATFORM' ? ` · ${deal.market === 'PRIMARY' ? '12%' : '4%'}` : ''}</span>, <span key={`v${s.party}`} className="ha-num">{formatBRL(BigInt(s.amountCents))} · {s.status === 'RELEASED' ? 'liberado' : 'em garantia'}</span>])}</div>
          {deal.shipping ? <p className="ha-muted ha-sm">Transporte {deal.shipping.carrier} · rastreio {deal.shipping.tracking}{deal.shipping.insurer ? ` · seguro de trânsito ${deal.shipping.insurer}` : ''}</p> : null}
          {deal.phase === 'ESCROW' && !deal.sellerSigned ? <button type="button" className="ha-btn ha-btn--primary ha-btn--md" onClick={() => post('sign')}>Assinar o termo de transferência</button> : null}
          {deal.phase === 'DOCUMENTS' ? (
            <div className="ha-row">
              <input className="ha-input" placeholder="Transportadora" value={ship.carrier} onChange={(e) => setShip({ ...ship, carrier: e.target.value })} />
              <input className="ha-input" placeholder="Rastreio" value={ship.tracking} onChange={(e) => setShip({ ...ship, tracking: e.target.value })} />
              <input className="ha-input" placeholder="Seguradora (opcional)" value={ship.insurer} onChange={(e) => setShip({ ...ship, insurer: e.target.value })} />
              <button type="button" className="ha-btn ha-btn--primary ha-btn--sm" disabled={!ship.carrier || !ship.tracking} onClick={() => post('shipping', { carrier: ship.carrier, tracking: ship.tracking, insurer: ship.insurer || undefined })}>Registrar envio</button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="ha-stack">
          {deal.phase === 'OFFER_ACCEPTED' ? <button type="button" className="ha-btn ha-btn--primary ha-btn--md" onClick={() => post('escrow')}>Pagar em garantia · {formatBRL(amount)}</button> : null}
          {deal.phase === 'ESCROW' && !deal.buyerSigned ? <button type="button" className="ha-btn ha-btn--primary ha-btn--md" onClick={() => post('sign')}>Assinar o termo de transferência</button> : null}
          {deal.phase === 'ESCROW' && deal.buyerSigned && !deal.sellerSigned ? <p className="ha-muted">Aguardando a assinatura do vendedor.</p> : null}
          {deal.phase === 'SHIPPING' || done ? (
            <div className={`ha-callout${done ? ' ha-callout--ok' : ''}`}>
              <Icon name={done ? 'check' : 'contactless'} />
              <div>
                <b>{done ? 'Escritura emitida em seu nome' : 'A obra chegou?'}</b>
                <p className="ha-sm">{done ? 'A obra entrou na sua carteira e o pagamento foi liberado ao vendedor.' : 'Abra o app e encoste o celular na etiqueta do verso. A leitura confirma a posse.'}</p>
                {!done ? <button type="button" className="ha-btn ha-btn--ink ha-btn--sm" onClick={() => post('confirm-delivery')}>Confirmar recebimento</button> : null}
              </div>
            </div>
          ) : null}
        </div>
      )}
      <Toast message={toast} onDone={() => setToast('')} />
    </section>
  )
}

export function serializeDeal(d: DealView): Serializable {
  return { ...d, amountCents: d.amountCents.toString(), shippingCents: d.shippingCents.toString(), insuranceCents: d.insuranceCents.toString(), split: d.split.map((s) => ({ ...s, amountCents: s.amountCents.toString() })) }
}
