'use client'
// "Venda · data" (handoff "HouseArt Web Galeria" › Negócios › Vendas › venda): the sale in the side
// panel — work, buyer with "Conversar", the step it is at, the six steps, Financeiro and the
// seller's next action (sign the cession, register the shipment). Same API as the timeline.
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ds/Icon'
import { Toast } from '@/components/ds/Toast'
import { SidePanel } from '@/components/ds/SidePanel'
import { formatBRL } from '@/lib/artworks/domain'
import { saleAction, saleStage, saleStageTitle, saleSteps, SALE_STAGES } from '@/lib/deals/sale-progress-core'
import type { SerializableDeal } from '@/components/deals/deal-view'

export interface FinanceRow { label: string; cents: string; sign: string; strong: boolean }

const day = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Bahia' })
const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('') || '?'

export function SaleDetail({ deal, finance, payoutNote, canAnswer, closeHref, workHref }: { deal: SerializableDeal; finance: FinanceRow[]; payoutNote: string | null; canAnswer: boolean; closeHref: string; workHref: string | null }) {
  const router = useRouter()
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [ship, setShip] = useState({ carrier: '', tracking: '', insurer: '' })
  const act = saleAction({ phase: deal.phase, sellerSigned: deal.sellerSigned, exception: deal.exception })
  const stage = saleStage(deal.phase)
  const first = deal.buyerName.split(/\s+/)[0] ?? deal.buyerName
  const statusText = deal.exception ? 'A equipe da HouseArt acompanha este negócio.' : stage < 0 ? 'O comprador tem 24 h para pagar em garantia. Você é avisado quando o valor estiver retido.'
    : stage === 5 ? `Venda concluída. ${payoutNote ?? 'Valores liberados.'}`
    : stage === 3 ? (deal.shipping ? `${deal.shipping.carrier} · rastreio ${deal.shipping.tracking}${deal.shipping.insurer ? ` · seguro ${deal.shipping.insurer}` : ''}.` : SALE_STAGES[3]!.sub + '.')
    : `${SALE_STAGES[Math.min(stage + 1, 5)]!.sub}.`

  async function post(path: string, body: unknown, done: string) {
    setBusy(path)
    const res = await fetch(`/api/deals/${deal.id}/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({})) as { error?: string }
    setBusy(null)
    if (!res.ok) { setToast(data.error ?? 'Não foi possível registrar.'); return }
    setToast(done)
    router.refresh()
  }
  async function talk() {
    setBusy('talk')
    const res = await fetch(`/api/offers/${deal.offerId}/conversation`, { method: 'POST' })
    const data = await res.json().catch(() => ({})) as { id?: number; error?: string }
    setBusy(null)
    if (!res.ok || !data.id) { setToast(data.error ?? 'Não foi possível abrir a conversa.'); return }
    router.push(`/messages/${data.id}`)
  }

  const footer = (
    <>
      {act.kind === 'sign' ? <button type="button" className="ha-sd__btn ha-sd__btn--primary" disabled={busy !== null} onClick={() => post('sign', {}, 'Termo assinado · o comprador foi avisado')}><Icon name="draw" size={20} />Assinar o termo de transferência</button> : null}
      {act.kind === 'ship' ? (
        <div className="ha-sd__ship">
          <input className="ha-input" placeholder="Transportadora" aria-label="Transportadora" value={ship.carrier} onChange={(e) => setShip({ ...ship, carrier: e.target.value })} />
          <input className="ha-input" placeholder="Código de rastreio" aria-label="Código de rastreio" value={ship.tracking} onChange={(e) => setShip({ ...ship, tracking: e.target.value })} />
          <input className="ha-input" placeholder="Seguradora (opcional)" aria-label="Seguradora" value={ship.insurer} onChange={(e) => setShip({ ...ship, insurer: e.target.value })} />
          <button type="button" className="ha-sd__btn ha-sd__btn--primary" disabled={busy !== null || !ship.carrier.trim() || !ship.tracking.trim()} onClick={() => post('shipping', { carrier: ship.carrier.trim(), tracking: ship.tracking.trim(), insurer: ship.insurer.trim() || undefined }, `Envio registrado · ${first} recebeu o rastreio`)}><Icon name="local_shipping" size={20} />Registrar envio</button>
        </div>
      ) : null}
      {/* Concluída · "Baixar comprovante" (the PDF of the Financeiro; there is no fiscal note in the platform) */}
      {stage === 5 && !deal.exception ? <a href={`/api/deals/${deal.id}/receipt`} download className="ha-sd__btn"><Icon name="download" size={20} />Baixar comprovante</a> : null}
      {canAnswer ? <button type="button" className="ha-sd__btn" disabled={busy !== null} onClick={talk}><Icon name="chat_bubble" size={20} />Conversar com {first}</button> : null}
    </>
  )

  return (
    <SidePanel title={`Venda · ${day(deal.createdAt)}`} closeHref={closeHref} footer={footer}>
      {(() => {
        const inner = (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
            <span className="ha-sd__wall">{deal.cover ? <img src={deal.cover} alt="" /> : null}</span>
            <span className="ha-stack" style={{ gap: 2 }}><i>{deal.artworkTitle}</i><span className="ha-muted ha-sm">{deal.artist} · {deal.code}</span></span>
          </>
        )
        return workHref ? <Link href={workHref} className="ha-sd__work">{inner}</Link> : <div className="ha-sd__work">{inner}</div>
      })()}
      <div className="ha-sd__buyer">
        <span className="ha-sd__av" aria-hidden="true">{initials(deal.buyerName)}</span>
        <span className="ha-stack" style={{ flex: 1, minWidth: 0, gap: 0 }}><b className="ha-sm">{deal.buyerName}</b><span className="ha-muted ha-sm">Comprador{deal.buyerCity ? ` · ${deal.buyerCity}` : ''}{deal.market === 'SECONDARY' ? ' · revenda' : ''}</span></span>
        {canAnswer ? <button type="button" className="ha-sd__chat" aria-label={`Conversar com ${first}`} disabled={busy !== null} onClick={talk}><Icon name="chat_bubble" size={20} /></button> : null}
      </div>
      <div className="ha-sd__status"><b>{saleStageTitle(deal.phase, deal.exception)}</b><span>{statusText}</span></div>
      <ol className="ha-sd__steps">
        {saleSteps(deal.phase).map(({ stage: s, state }) => (
          <li key={s.title} className={`ha-sd__step ha-sd__step--${state}`}>
            <span className="ha-sd__rail"><span className="ha-sd__dot"><Icon name={state === 'done' ? 'check' : s.icon} size={16} /></span><span className="ha-sd__line" /></span>
            <span className="ha-sd__txt"><b>{s.title}</b><span>{s.sub}</span></span>
          </li>
        ))}
      </ol>
      <div className="ha-sd__fin">
        <h3>Financeiro</h3>
        {finance.map((l) => <div key={l.label} className={`ha-sd__row${l.strong ? ' ha-sd__row--strong' : ''}`}><span>{l.label}</span><span>{l.sign ? `${l.sign} ` : ''}{formatBRL(BigInt(l.cents))}</span></div>)}
      </div>
      <Toast message={toast} onDone={() => setToast('')} />
    </SidePanel>
  )
}
