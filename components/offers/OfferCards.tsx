'use client'
// Negócios › Ofertas as cards (HouseArt Web Galeria.dc.html; also the collector's
// "Vendas · oferta recebida"): artwork, value and share of the price, the
// proponent with initials, their message, other offers on the same work,
// Aceitar · Contrapropor · Recusar, and "Conversar com …".
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Modal } from '@/components/ds/Modal'
import { Toast } from '@/components/ds/Toast'
import { formatBRL } from '@/lib/artworks/domain'
import { PixKeyForm } from '@/components/sales/PixKeyForm'
import '@/components/sales/payout.css'

/** "Cadastre o Pix para receber antes de aceitar" (App Colecionador › Vendas): when the seller has no way
 *  to receive yet, Aceitar opens the Pix form first and accepts right after the key is saved. */
export interface PayoutGate { ready: boolean; holderName: string; cpfMask: string | null }

export interface OfferCardView {
  id: number; code: string; artworkId: number; artworkTitle: string; artworkCover: string | null; listPriceCents: string | null; currentCents: string
  status: string; statusLabel: string; buyer: string; buyerFirstName: string; buyerInitials: string
  expiresIn: string; open: boolean; lastAuthor: string | null; pctOfPrice: number | null; buyerMessage: string | null
}

const pctTone = (p: number | null) => (p === null ? 'var(--ha-ink-500)' : p >= 90 ? 'var(--ha-verified-500)' : p >= 75 ? 'var(--ha-pending-500)' : 'var(--ha-alert-500)')
const digits = (s: string) => s.replace(/\D/g, '')
const maskBRL = (s: string) => { const d = digits(s); return d ? Number(d).toLocaleString('pt-BR') : '' }

export function OfferCards({ offers: initial, negotiatorLine, canAnswer = true, blockedReason, payout }: { offers: OfferCardView[]; negotiatorLine: string; canAnswer?: boolean; blockedReason?: string; payout?: PayoutGate }) {
  const router = useRouter()
  const [offers, setOffers] = useState(initial)
  const [counter, setCounter] = useState<OfferCardView | null>(null)
  const [payoutReady, setPayoutReady] = useState(payout?.ready ?? true)
  const [pixFor, setPixFor] = useState<OfferCardView | null>(null)
  const [pixSaving, setPixSaving] = useState(false)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const open = offers.filter((o) => o.open)
  const best = open.reduce<number | null>((m, o) => (o.pctOfPrice !== null && (m === null || o.pctOfPrice > m) ? o.pctOfPrice : m), null)
  const othersOn = (o: OfferCardView) => open.filter((x) => x.artworkId === o.artworkId && x.id !== o.id).length

  function startCounter(o: OfferCardView) {
    // pre-filled at the midpoint between the offer and the asking price, in reais (the prototype's behaviour)
    const cur = BigInt(o.currentCents), list = o.listPriceCents ? BigInt(o.listPriceCents) : cur
    const mid = (cur + list) / 2n
    setAmount(maskBRL(String(mid / 100n)))
    setCounter(o)
  }

  function accept(o: OfferCardView) {
    if (!payoutReady) { setPixFor(o); return }
    void act(o, 'accept')
  }

  async function act(o: OfferCardView, action: 'accept' | 'refuse' | 'counter') {
    const body = action === 'counter' ? { amountCents: Number(digits(amount)) * 100 } : {}
    setBusy(`${o.id}:${action}`)
    let res: Response, data: { error?: string }
    try {
      res = await fetch(`/api/offers/${o.id}/${action}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      data = await res.json().catch(() => ({})) as { error?: string }
    } catch { setToast('Sem conexão. Tente de novo.'); return } finally { setBusy(null) }
    if (!res.ok) { setToast(data.error ?? 'Não foi possível responder.'); return }
    setOffers(offers.map((x) => (x.id === o.id ? { ...x, open: action === 'counter', status: action === 'accept' ? 'ACCEPTED' : action === 'refuse' ? 'REFUSED' : 'NEGOTIATING', statusLabel: action === 'accept' ? 'Aceita · venda em andamento' : action === 'refuse' ? 'Recusada' : 'Contraproposta enviada', lastAuthor: action === 'counter' ? 'SELLER' : x.lastAuthor, currentCents: action === 'counter' ? String(Number(digits(amount)) * 100) : x.currentCents } : x)))
    setCounter(null)
    setToast(action === 'accept' ? 'Oferta aceita · o comprador tem 24 h para pagar em garantia' : action === 'refuse' ? 'Proposta recusada' : 'Contraproposta enviada')
  }

  async function talk(o: OfferCardView) {
    setBusy(`${o.id}:talk`)
    // The conversation is opened BY THE OFFER: the server finds the proponent (their id never reaches the page).
    const res = await fetch(`/api/offers/${o.id}/conversation`, { method: 'POST' })
    const data = await res.json().catch(() => ({})) as { id?: number; error?: string }
    setBusy(null)
    if (!res.ok || !data.id) { setToast(data.error ?? 'Não foi possível abrir a conversa.'); return }
    router.push(`/messages/${data.id}`)
  }

  return (
    <div className="ha-stack">
      {open.length ? (
        <div className="ha-offer-insight"><span className="ha-icon" aria-hidden="true">insights</span><span>{open.length} {open.length === 1 ? 'oferta aberta' : 'ofertas abertas'}{best !== null ? ` · a melhor chega a ${best}% do preço` : ''}</span></div>
      ) : null}
      <div className="ha-offer-grid">
        {offers.length === 0 ? <p className="ha-muted">Nenhuma oferta aberta agora.</p> : null}
        {offers.map((o) => {
          const pending = o.open && canAnswer
          const others = othersOn(o)
          const waitingBuyer = o.status === 'NEGOTIATING' && o.lastAuthor !== 'BUYER'
          return (
            <article key={o.id} className={`ha-offer${o.open ? ' ha-offer--open' : ''}`}>
              <div className="ha-offer__top">
                <span className="ha-offer__thumb">
                  {/* eslint-disable-next-line @next/next/no-img-element -- public derivative */}
                  {o.artworkCover ? <img src={o.artworkCover} alt="" /> : null}
                </span>
                <span className="ha-offer__work"><i>{o.artworkTitle}</i><span>Preço {o.listPriceCents ? formatBRL(BigInt(o.listPriceCents)) : 'sob consulta'}</span></span>
                <span className="ha-offer__value"><b>{formatBRL(BigInt(o.currentCents))}</b>{o.pctOfPrice !== null ? <span style={{ color: pctTone(o.pctOfPrice) }}>{o.pctOfPrice}% do preço</span> : null}</span>
              </div>
              <div className="ha-offer__who">
                <span className="ha-avatar ha-avatar--32">{o.buyerInitials || '?'}</span>
                <span className="ha-offer__name"><b>{o.buyer}</b><span>{o.code}</span></span>
                {o.open ? <span className="ha-offer__deadline">expira em {o.expiresIn}</span> : null}
              </div>
              {o.buyerMessage ? <p className="ha-offer__msg">“{o.buyerMessage}”</p> : null}
              {others > 0 && o.open ? <span className="ha-offer__others"><span className="ha-icon" aria-hidden="true">stacked_line_chart</span>{others === 1 ? 'Mais 1 oferta nesta obra' : `Mais ${others} ofertas nesta obra`}</span> : null}
              {pending ? (
                waitingBuyer
                  ? <span className="ha-offer__status">Contraproposta enviada · aguardando {o.buyerFirstName}</span>
                  : (
                    <div className="ha-offer__actions">
                      <button type="button" className="ha-btn ha-btn--primary ha-btn--sm" disabled={busy !== null} onClick={() => accept(o)}>{busy === `${o.id}:accept` ? 'Aceitando' : 'Aceitar'}</button>
                      <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" disabled={busy !== null} onClick={() => startCounter(o)}>Contrapropor</button>
                      <button type="button" className="ha-btn ha-btn--sm ha-offer__refuse" disabled={busy !== null} onClick={() => act(o, 'refuse')}>{busy === `${o.id}:refuse` ? 'Recusando' : 'Recusar'}</button>
                    </div>
                  )
              ) : <span className="ha-offer__status">{o.statusLabel}</span>}
              {canAnswer ? <button type="button" className="ha-offer__talk" disabled={busy !== null} onClick={() => talk(o)}><span className="ha-icon" aria-hidden="true">chat_bubble</span>Conversar com {o.buyerFirstName}</button> : null}
            </article>
          )
        })}
      </div>
      {!canAnswer && blockedReason ? <p className="ha-callout ha-sm">{blockedReason}</p> : null}
      <p className="ha-muted ha-sm">{negotiatorLine}</p>
      <Modal open={!!counter} title="Contrapropor" onClose={() => setCounter(null)} footer={<button type="button" className="ha-btn ha-btn--primary ha-btn--md" disabled={!digits(amount) || busy !== null} onClick={() => counter && act(counter, 'counter')}>{busy?.endsWith(':counter') ? 'Enviando' : 'Enviar contraproposta'}</button>}>
        {counter ? <p className="ha-muted ha-sm"><i>{counter.artworkTitle}</i> · oferta de {formatBRL(BigInt(counter.currentCents))}{counter.listPriceCents ? ` · preço ${formatBRL(BigInt(counter.listPriceCents))}` : ''}</p> : null}
        <label className="ha-label">Valor da contraproposta
          <span className="ha-input-money"><span>R$</span><input className="ha-input ha-input--num" inputMode="numeric" value={amount} onChange={(e) => setAmount(maskBRL(e.target.value))} aria-describedby="ha-counter-hint" /></span>
        </label>
        <p id="ha-counter-hint" className="ha-caption">Sugerimos o meio-termo entre a oferta e o preço.</p>
      </Modal>
      {payout ? (
        <Modal open={!!pixFor} title="Cadastre o Pix para receber" onClose={() => { if (!pixSaving) setPixFor(null) }}>
          {pixFor ? <p className="ha-muted ha-sm">Antes de aceitar a oferta de {formatBRL(BigInt(pixFor.currentCents))} em <i>{pixFor.artworkTitle}</i>, diga para onde vai o valor da venda.</p> : null}
          <PixKeyForm holderName={payout.holderName} cpfMask={payout.cpfMask} submitLabel="Cadastrar Pix e aceitar" onSavingChange={setPixSaving} onSaved={async () => { setPayoutReady(true); const o = pixFor; setPixFor(null); if (o) await act(o, 'accept') }} />
        </Modal>
      ) : null}
      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  )
}
