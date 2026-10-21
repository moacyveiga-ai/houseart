'use client'
import { useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Modal } from '@/components/ds/Modal'
import { Toast } from '@/components/ds/Toast'
import { Badge } from '@/components/ds/Badge'
import { CERT_STAGES } from '@/lib/physical-markers/domain'

export interface CertItem { id: number; certificateId: number | null; title: string; publicId: string | null; cover: string | null; stage: number; label: string; action: string; status: string }
export interface CertOrder { id: number; quantity: number; status: string }

export function CertificationScreen({ items: initialItems, orders: initialOrders, canOrder }: { items: CertItem[]; orders: CertOrder[]; canOrder: boolean }) {
  const [items, setItems] = useState(initialItems)
  const [orders, setOrders] = useState(initialOrders)
  const [qty, setQty] = useState(10)
  const [signing, setSigning] = useState<CertItem | null>(null)
  const [signStep, setSignStep] = useState(0)
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)

  async function post(url: string, body?: unknown) {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
    return { res, data: await res.json().catch(() => ({})) as { error?: string } }
  }

  async function order() {
    setBusy(true)
    const { res, data } = await post('/api/markers/orders', { quantity: qty })
    setBusy(false)
    if (!res.ok) { setToast(data.error ?? 'Não foi possível pedir.'); return }
    setOrders([{ id: 0, quantity: qty, status: 'REQUESTED' }, ...orders])
    setItems(items.map((i) => (i.stage === 0 ? { ...i, stage: 1 } : i)))
    setToast('Pedido registrado · as etiquetas chegam pelo correio em até 5 dias úteis')
  }

  async function received(orderId: number) {
    const { res } = await post(`/api/markers/orders/${orderId}/delivered`)
    if (res.ok) { setOrders(orders.map((o) => (o.id === orderId ? { ...o, status: 'DELIVERED' } : o))); setItems(items.map((i) => (i.stage === 1 ? { ...i, stage: 2, label: 'Vincular no app', action: 'LINK_IN_APP' } : i))) }
  }

  async function confirmSign() {
    if (!signing?.certificateId) return
    setSignStep(1)
    const { res, data } = await post(`/api/certificates/${signing.certificateId}/sign`)
    setSignStep(0)
    if (!res.ok) { setToast(data.error ?? 'Não foi possível assinar.'); return }
    setItems(items.map((i) => (i.id === signing.id ? { ...i, stage: 4, label: 'Emitir', action: 'ISSUE' } : i)))
    setSigning(null)
    setToast('Assinado · carimbo do tempo aplicado. Falta emitir.')
  }

  async function issue(item: CertItem) {
    if (!item.certificateId) return
    setBusy(true)
    const { res, data } = await post(`/api/certificates/${item.certificateId}/issue`)
    setBusy(false)
    if (!res.ok) { setToast(data.error ?? 'Não foi possível emitir.'); return }
    setItems(items.map((i) => (i.id === item.id ? { ...i, stage: 5, label: 'Ver certificado', action: 'VIEW' } : i)))
    setToast(`Certificado emitido · ${item.title}`)
  }

  function act(item: CertItem) {
    if (item.action === 'SIGN') setSigning(item)
    else if (item.action === 'ISSUE') void issue(item)
    else if (item.action === 'LINK_IN_APP') setToast('Abra o app HouseArt e encoste o celular na etiqueta')
    else if (item.action === 'VIEW' && item.publicId) window.location.assign(`/verify/${item.publicId}`)
  }

  const pending = orders.filter((o) => o.status !== 'DELIVERED')
  return (
    <div className="ha-page">
      <div className="ha-page__head"><h1 className="ha-h1">Certificação</h1></div>
      {canOrder ? (
        <section className="ha-card ha-card--pad ha-row" style={{ gap: 24, flexWrap: 'wrap' }}>
          <Icon name="sell" size={28} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="ha-title">Kit de etiquetas de autenticação</div>
            <div className="ha-muted ha-sm">Chegam pelo correio em até 5 dias úteis, em envelope lacrado. Você vincula cada uma pelo app.</div>
          </div>
          <div className="ha-row">
            <button type="button" className="ha-iconbtn" aria-label="Menos" onClick={() => setQty(Math.max(1, qty - 1))}><Icon name="remove" /></button>
            <span className="ha-num" style={{ minWidth: 32, textAlign: 'center' }}>{qty}</span>
            <button type="button" className="ha-iconbtn" aria-label="Mais" onClick={() => setQty(Math.min(200, qty + 1))}><Icon name="add" /></button>
          </div>
          <button type="button" className="ha-btn ha-btn--primary ha-btn--md" disabled={busy} onClick={order}>Pedir etiquetas · R$ {(qty * 15).toLocaleString('pt-BR')}</button>
        </section>
      ) : null}
      {pending.length ? (
        <div className="ha-callout"><Icon name="local_shipping" />
          <div>{pending.map((o) => (
            <div key={o.id} className="ha-row">
              <span>{o.quantity} etiqueta(s) · {o.status === 'REQUESTED' ? 'pedido recebido' : 'enviadas pelo correio'}</span>
              {o.status === 'SHIPPED' && o.id ? <button type="button" className="ha-btn ha-btn--outline ha-btn--xs" onClick={() => received(o.id)}>Recebi o envelope</button> : null}
            </div>
          ))}</div>
        </div>
      ) : null}
      <section className="ha-table" style={{ '--ha-cols': '2fr 2fr 1fr 140px' } as React.CSSProperties}>
        <div className="ha-table__inner">
          <div className="ha-table__head"><div>Obra</div><div>Etiqueta pedida · recebida · vinculada · assinada · emitida</div><div>Status</div><div /></div>
          {items.length === 0 ? <div className="ha-table__row"><div className="ha-muted">Nenhuma obra enviada para certificação.</div></div> : null}
          {items.map((i) => (
            <div key={i.id} className="ha-table__row">
              <div className="ha-row"><span className="ha-wall ha-wall--40">{/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
                {i.cover ? <img src={i.cover} alt="" /> : null}</span><span><b>{i.title}</b><br /><span className="ha-muted ha-sm">{i.publicId ?? 'sem etiqueta'}</span></span></div>
              <div className="ha-dots" aria-label={`Etapa ${i.stage} de 5`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <span key={n} className="ha-row">
                    <span className={`ha-dots__dot${n <= i.stage ? ' ha-dots__dot--ok' : n === i.stage + 1 ? ' ha-dots__dot--on' : ''}`} />
                    {n < 5 ? <span className={`ha-dots__line${n < i.stage ? ' ha-dots__line--ok' : ''}`} /> : null}
                  </span>
                ))}
              </div>
              <div><Badge tone={i.stage === 5 ? 'verified' : 'pending'}>{CERT_STAGES[i.stage]}</Badge></div>
              <div><button type="button" className={`ha-btn ha-btn--sm ${i.action === 'SIGN' || i.action === 'ISSUE' ? 'ha-btn--primary' : 'ha-btn--outline'}`} disabled={busy || i.action === 'WAIT_MARKER'} onClick={() => act(i)}>{i.label}</button></div>
            </div>
          ))}
        </div>
      </section>
      <Modal open={!!signing} title="Assinar certificado" onClose={() => setSigning(null)} footer={<button type="button" className="ha-btn ha-btn--primary ha-btn--md" disabled={signStep === 1} onClick={confirmSign}>{signStep === 1 ? 'Assinando…' : 'Assinar digitalmente'}</button>}>
        <div className="ha-eyebrow">HouseSign</div>
        <p><b>{signing?.title}</b><br /><span className="ha-muted ha-sm">{signing?.publicId}</span></p>
        <p className="ha-muted ha-sm">Ao assinar, você declara ser a autora desta obra. O certificado recebe carimbo do tempo ICP-Brasil e não pode ser alterado; mudanças futuras viram novos eventos na cadeia de titularidade.</p>
      </Modal>
      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  )
}
