'use client'
// Admin · Etiquetas (HouseArt Web App.dc.html): batches with linked progress,
// kit orders to ship, a new batch from the supplier's UIDs. Every status the
// operator reads is in Portuguese; shipping asks for a confirmation.
import { useCallback, useState } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { Modal } from '@/components/ds/Modal'
import { Toast } from '@/components/ds/Toast'
import { BATCH_STATUS_LABELS, MARKER_ORDER_STATUS_LABELS, MARKER_STATUS_LABELS, READ_PURPOSE_LABELS } from '@/lib/physical-markers/domain'
import { reviewHref } from '@/lib/admin-review/core'

export interface BatchRow { id: number; code: string; quantity: number; destination: string; linked: number; status: string }
export interface OrderRow { id: number; quantity: number; status: string; who: string; createdAt: string }
/** A read whose chip reported tampering: the marker is REMOVED and a review item opened for the desk. */
export interface AlertRow { id: number; at: string; purpose: string; /** the read's CMAC checked out (the TT status is inside it; a forged `tt` is recorded but changes nothing) */ authenticated: boolean; uid: string; markerStatus: string; artwork: { publicId: string | null; title: string } | null; reviewOpen: boolean }
export interface FoundMarker { uid: string; status: string; artwork: { publicId: string | null; title: string } | null; batch: string; readCounter: number }

const PURPOSE_LABELS: Record<string, string> = READ_PURPOSE_LABELS
/** What the desk did with the read: open review, revoked tag (approved — the decision unlinks the tag from the work), or kept (rejected). */
function alertOutcome(al: AlertRow): { badge: string; tone: { bg: string; fg: string }; note: string | null } {
  if (al.reviewOpen) return { badge: 'Violação', tone: { bg: '--ha-alert-500', fg: '--ha-paper-50' }, note: null }
  if (al.markerStatus === 'REVOKED') return { badge: 'Revogada', tone: { bg: '--ha-paper-200', fg: '--ha-ink-900' }, note: 'revisão aprovada' }
  return { badge: 'Decidida', tone: { bg: '--ha-paper-200', fg: '--ha-ink-900' }, note: 'revisão decidida' }
}
const whenBR = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Bahia', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function ArtworkRef({ a }: { a: { publicId: string | null; title: string } | null }) {
  if (!a) return <>sem obra</>
  return a.publicId ? <Link href={`/verify/${a.publicId}`} className="ha-link">{a.title} · <span className="ha-id">{a.publicId}</span></Link> : <>{a.title}</>
}

const label = <T extends string>(map: Record<T, string>, v: string) => (map as Record<string, string>)[v] ?? v
const BATCH_TONE: Record<string, { bg: string; fg: string }> = {
  NEW: { bg: '--ha-pending-100', fg: '--ha-ink-900' },
  IN_USE: { bg: '--ha-verified-100', fg: '--ha-verified-500' },
  EXHAUSTED: { bg: '--ha-paper-200', fg: '--ha-ink-900' },
}
const UID_LINE = /^[0-9a-f]{14}$/i
const dateBR = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' })

export function MarkersAdmin({ batches: initial, orders, found, query, alerts }: { batches: BatchRow[]; orders: OrderRow[]; found: FoundMarker | null; query: string; alerts: AlertRow[] }) {
  const [batches, setBatches] = useState(initial)
  const [form, setForm] = useState({ code: '', quantity: 100, destination: '', uids: '' })
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState('')
  const [shipPick, setShipPick] = useState<Record<number, string>>({})
  const [shipping, setShipping] = useState<OrderRow | null>(null)
  const [shipBusy, setShipBusy] = useState(false)
  const [shipError, setShipError] = useState('')
  const [toast, setToast] = useState('')
  const uidList = form.uids.split(/[\s,;]+/).map((u) => u.trim()).filter(Boolean)
  const badUids = uidList.filter((u) => !UID_LINE.test(u))
  const closeShip = useCallback(() => { if (!shipBusy) { setShipping(null); setShipError('') } }, [shipBusy])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    if (badUids.length) { setFormError(`${badUids.length} UID(s) inválido(s). Cada UID tem 14 caracteres hexadecimais (7 bytes), um por linha.`); return }
    const quantity = uidList.length || Number(form.quantity)
    setCreating(true)
    const res = await fetch('/api/admin/markers/batches', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: form.code, quantity, destination: form.destination, ...(uidList.length ? { uids: uidList } : {}) }) })
    const data = await res.json().catch(() => ({})) as { id?: number; error?: string }
    setCreating(false)
    if (!res.ok) { setFormError(data.error ?? 'Não foi possível criar o lote.'); return }
    setBatches([{ id: data.id!, code: form.code, quantity, destination: form.destination, linked: 0, status: 'NEW' }, ...batches])
    setForm({ code: '', quantity: 100, destination: '', uids: '' })
    setToast('Lote criado')
  }

  async function ship() {
    if (!shipping) return
    const batchId = Number(shipPick[shipping.id])
    setShipBusy(true); setShipError('')
    const res = await fetch(`/api/admin/markers/orders/${shipping.id}/ship`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ batchId }) })
    const data = await res.json().catch(() => ({})) as { error?: string }
    setShipBusy(false)
    if (!res.ok) { setShipError(data.error ?? 'Não foi possível enviar o pedido.'); return }
    setShipping(null)
    setToast('Pedido enviado')
    window.location.reload()
  }

  const openBatches = batches.filter((b) => b.status !== 'EXHAUSTED')
  const shipBatch = shipping ? batches.find((b) => String(b.id) === shipPick[shipping.id]) : undefined

  return (
    <div className="ha-stack">
      {found ? (
        <div className="ha-callout"><Icon name="sell" /><div className="ha-sm">Etiqueta <span className="ha-id">{found.uid}</span> · lote {found.batch} · {label(MARKER_STATUS_LABELS, found.status)} · {found.artwork ? <>vinculada a <ArtworkRef a={found.artwork} /></> : 'sem obra'} · {found.readCounter} {found.readCounter === 1 ? 'leitura' : 'leituras'}</div></div>
      ) : null}
      {query && !found ? <p className="ha-muted">Nenhuma etiqueta encontrada para “{query}”. Busque pelo UID (14 caracteres) ou pelo ID da obra (HA-…).</p> : null}

      <div className="ha-markers" role="table" aria-label="Lotes de etiquetas">
        <div className="ha-markers__inner">
          <div className="ha-markers__head" role="row"><span role="columnheader">Lote</span><span role="columnheader">Qtd.</span><span role="columnheader">Destino</span><span role="columnheader">Vinculadas</span><span role="columnheader">Status</span></div>
          {batches.length === 0 ? <div className="ha-markers__empty">Nenhum lote ainda. Crie o primeiro abaixo com os UIDs do fornecedor.</div> : null}
          {batches.map((b) => {
            const pct = b.quantity ? Math.round((b.linked / b.quantity) * 100) : 0
            const tone = BATCH_TONE[b.status] ?? BATCH_TONE.EXHAUSTED
            return (
              <div key={b.id} className="ha-markers__row" role="row">
                <span role="cell" className="ha-id">{b.code}</span>
                <span role="cell" className="ha-markers__num">{b.quantity.toLocaleString('pt-BR')}</span>
                <span role="cell">{b.destination}</span>
                <span role="cell" className="ha-markers__bar"><span className="ha-markers__track"><span style={{ width: `${pct}%` }} /></span><span className="ha-markers__num">{b.linked.toLocaleString('pt-BR')}</span></span>
                <span role="cell"><span className="ha-review__kind" style={{ background: `var(${tone.bg})`, color: `var(${tone.fg})` }}>{label(BATCH_STATUS_LABELS, b.status)}</span></span>
              </div>
            )
          })}
        </div>
      </div>
      <p className="ha-muted ha-sm">Etiquetas com chip NXP e criptografia por obra. Uma etiqueta removida invalida a leitura e abre alerta automático.</p>

      <h2 className="ha-h3">Alertas de remoção</h2>
      <ul className="ha-list" aria-label="Leituras com violação do chip nos últimos 7 dias">
        {alerts.length === 0 ? <li className="ha-muted">Nenhuma leitura indicou violação do chip nos últimos 7 dias.</li> : null}
        {alerts.map((al) => {
          const o = alertOutcome(al)
          return (
            <li key={al.id} className="ha-list__row ha-markers__order">
              <span><b>{al.artwork ? <ArtworkRef a={al.artwork} /> : 'Obra desvinculada pela revisão'}</b><br /><span className="ha-muted ha-sm">etiqueta <span className="ha-id">{al.uid}</span> · {label(MARKER_STATUS_LABELS, al.markerStatus)} · {PURPOSE_LABELS[al.purpose] ?? al.purpose} · {whenBR(al.at)}{al.authenticated ? '' : ' · leitura não autenticada'}</span></span>
              <span className="ha-review__kind" style={{ background: `var(${o.tone.bg})`, color: `var(${o.tone.fg})` }}>{o.badge}</span>
              {al.reviewOpen ? <Link href={reviewHref('open', 'MARKER_REMOVED')} className="ha-btn ha-btn--ink ha-btn--xs">Abrir revisão</Link> : <span className="ha-muted ha-sm">{o.note}</span>}
            </li>
          )
        })}
        {alerts.length >= 20 ? <li className="ha-muted ha-sm">Mostrando as 20 leituras mais recentes.</li> : null}
      </ul>

      <h2 className="ha-h3">Pedidos de kit</h2>
      <ul className="ha-list">
        {orders.length === 0 ? <li className="ha-muted">Nenhum pedido de etiquetas.</li> : null}
        {orders.map((o) => (
          <li key={o.id} className="ha-list__row ha-markers__order">
            <span><b>{o.who}</b><br /><span className="ha-muted ha-sm">{o.quantity} {o.quantity === 1 ? 'etiqueta' : 'etiquetas'} · pedido em {dateBR(o.createdAt)}</span></span>
            <span className="ha-review__kind" style={{ background: `var(${o.status === 'REQUESTED' ? '--ha-pending-100' : '--ha-verified-100'})`, color: `var(${o.status === 'REQUESTED' ? '--ha-ink-900' : '--ha-verified-500'})` }}>{label(MARKER_ORDER_STATUS_LABELS, o.status)}</span>
            {o.status === 'REQUESTED' ? (
              openBatches.length ? (
                <span className="ha-row">
                  <select className="ha-select ha-select--sm" aria-label={`Lote para o pedido de ${o.who}`} value={shipPick[o.id] ?? ''} onChange={(e) => setShipPick({ ...shipPick, [o.id]: e.target.value })}>
                    <option value="">Escolher lote…</option>
                    {openBatches.map((b) => <option key={b.id} value={b.id}>{b.code} · {b.destination}</option>)}
                  </select>
                  <button type="button" className="ha-btn ha-btn--ink ha-btn--xs" disabled={!shipPick[o.id]} onClick={() => setShipping(o)}>Enviar</button>
                </span>
              ) : <span className="ha-muted ha-sm">Sem lote com estoque</span>
            ) : <span />}
          </li>
        ))}
      </ul>

      <h2 className="ha-h3">Novo lote</h2>
      <form className="ha-markers__form" onSubmit={create}>
        <label className="ha-label">Código do lote<input className="ha-input" placeholder="2026-11" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required minLength={7} maxLength={20} /></label>
        <label className="ha-label">Destino<input className="ha-input" placeholder="Envios avulsos · artistas" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} required maxLength={120} /></label>
        <label className="ha-label">Quantidade<input className="ha-input ha-input--num" type="number" min={1} max={100000} value={uidList.length || form.quantity} disabled={uidList.length > 0} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} required /></label>
        <label className="ha-label ha-markers__uids">UIDs do fornecedor <span className="ha-muted ha-sm" style={{ fontWeight: 400 }}>Cole a coluna do CSV, um por linha. Em branco, o sistema gera UIDs de teste.</span>
          <textarea className="ha-textarea" rows={4} value={form.uids} onChange={(e) => setForm({ ...form, uids: e.target.value })} placeholder={'04a1b2c3d4e5f6\n04a1b2c3d4e5f7'} spellCheck={false} />
          {uidList.length ? <span className="ha-sm ha-muted">{uidList.length} {uidList.length === 1 ? 'UID' : 'UIDs'}{badUids.length ? ` · ${badUids.length} inválido(s)` : ''}</span> : null}
        </label>
        {formError ? <p className="ha-field-error" role="alert">{formError}</p> : null}
        <div><button className={`ha-btn ha-btn--primary ha-btn--md${creating ? ' ha-btn--loading' : ''}`} type="submit" disabled={creating} aria-busy={creating || undefined}>{creating ? <span className="ha-spinner" aria-hidden="true" /> : null}{creating ? 'Criando' : 'Criar lote'}</button></div>
      </form>

      <Modal open={shipping !== null} onClose={closeShip} title="Enviar pedido de etiquetas"
        footer={<>
          <button type="button" className="ha-btn ha-btn--ghost ha-btn--md" onClick={closeShip} disabled={shipBusy}>Cancelar</button>
          <button type="button" className={`ha-btn ha-btn--ink ha-btn--md${shipBusy ? ' ha-btn--loading' : ''}`} onClick={ship} disabled={shipBusy}>{shipBusy ? <span className="ha-spinner" aria-hidden="true" /> : null}{shipBusy ? 'Enviando' : 'Confirmar envio'}</button>
        </>}>
        {shipping ? (
          <div className="ha-stack">
            <p className="ha-sm">{shipping.quantity} {shipping.quantity === 1 ? 'etiqueta sai' : 'etiquetas saem'} do lote <b>{shipBatch?.code}</b> para <b>{shipping.who}</b>.</p>
            <p className="ha-muted ha-sm">As etiquetas ficam reservadas para este pedido e passam a contar como enviadas. O pedido muda para Enviado.</p>
            {shipError ? <p className="ha-field-error" role="alert">{shipError}</p> : null}
          </div>
        ) : null}
      </Modal>
      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  )
}
