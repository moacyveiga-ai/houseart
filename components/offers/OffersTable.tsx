'use client'
import { useState } from 'react'
import { Badge } from '@/components/ds/Badge'
import { Modal } from '@/components/ds/Modal'
import { Toast } from '@/components/ds/Toast'
import { formatBRL } from '@/lib/artworks/domain'

export interface OfferRowView { id: number; code: string; artworkTitle: string; artworkCover: string | null; listPriceCents: string | null; currentCents: string; status: string; statusLabel: string; buyer: string; expiresIn: string; differenceLabel: string; open: boolean; lastAuthor: string | null }

/** `canAnswer` false (the gallery's Acervo role): no Aceitar · Contrapropor · Recusar, and `blockedReason` says why. */
export function OffersTable({ offers: initial, negotiatorLine, canAnswer = true, blockedReason }: { offers: OfferRowView[]; negotiatorLine: string; canAnswer?: boolean; blockedReason?: string }) {
  const [offers, setOffers] = useState(initial)
  const [counter, setCounter] = useState<OfferRowView | null>(null)
  const [amount, setAmount] = useState('')
  const [toast, setToast] = useState('')
  async function act(o: OfferRowView, action: 'accept' | 'refuse' | 'counter') {
    const body = action === 'counter' ? { amountCents: Math.round(Number(amount.replace(/\D/g, '')) * 100) } : {}
    const res = await fetch(`/api/offers/${o.id}/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) { setToast(data.error ?? 'Não foi possível responder.'); return }
    setOffers(offers.map((x) => (x.id === o.id ? { ...x, open: action === 'counter', status: action === 'accept' ? 'ACCEPTED' : action === 'refuse' ? 'REFUSED' : 'NEGOTIATING', statusLabel: action === 'accept' ? 'Aceita · venda em andamento' : action === 'refuse' ? 'Recusada' : 'Em negociação', lastAuthor: action === 'counter' ? 'SELLER' : x.lastAuthor } : x)))
    setCounter(null)
    setToast(action === 'accept' ? 'Oferta aceita · o comprador tem 24 h para pagar em garantia' : action === 'refuse' ? 'Proposta recusada' : 'Contraproposta enviada')
  }
  return (
    <div className="ha-stack">
      <ul className="ha-list">
        {offers.length === 0 ? <li className="ha-muted">Nenhuma proposta ainda.</li> : null}
        {offers.map((o) => (
          <li key={o.id} className="ha-list__row" style={{ gridTemplateColumns: '40px 2fr 1fr auto' }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
            <span className="ha-wall ha-wall--40">{o.artworkCover ? <img alt="" src={o.artworkCover} /> : null}</span>
            <span><b>{o.artworkTitle}</b><br /><span className="ha-muted ha-sm">{o.buyer} · expira em {o.expiresIn} · {o.code}</span></span>
            <span><b className="ha-num">{formatBRL(BigInt(o.currentCents))}</b><br /><span className="ha-muted ha-sm">pedido {o.listPriceCents ? formatBRL(BigInt(o.listPriceCents)) : '—'} · {o.differenceLabel}</span></span>
            <span className="ha-row">
              {o.open && canAnswer ? (<>
                <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" onClick={() => act(o, 'refuse')}>Recusar</button>
                <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" onClick={() => { setCounter(o); setAmount('') }}>Contrapropor</button>
                <button type="button" className="ha-btn ha-btn--primary ha-btn--sm" disabled={o.status === 'NEGOTIATING' && o.lastAuthor !== 'BUYER'} onClick={() => act(o, 'accept')}>Aceitar</button>
              </>) : o.open ? <Badge tone="neutral">{o.statusLabel}</Badge> : <Badge tone={o.status === 'ACCEPTED' || o.status === 'IN_DEAL' || o.status === 'CONVERTED' ? 'verified' : 'neutral'}>{o.statusLabel}</Badge>}
            </span>
          </li>
        ))}
      </ul>
      {!canAnswer && blockedReason ? <p className="ha-callout ha-sm">{blockedReason}</p> : null}
      <p className="ha-muted ha-sm">{negotiatorLine}</p>
      <Modal open={!!counter} title="Contrapropor" onClose={() => setCounter(null)} footer={<button type="button" className="ha-btn ha-btn--primary ha-btn--md" disabled={!amount} onClick={() => counter && act(counter, 'counter')}>Enviar contraproposta</button>}>
        <p className="ha-muted ha-sm">{counter?.artworkTitle} · proposta atual {counter ? formatBRL(BigInt(counter.currentCents)) : ''}</p>
        <label className="ha-label">Valor da contraproposta (R$)<input className="ha-input ha-input--num" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
      </Modal>
      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  )
}
