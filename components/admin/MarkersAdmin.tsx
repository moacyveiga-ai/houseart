'use client'
import { useState } from 'react'
import { Badge } from '@/components/ds/Badge'
import { Icon } from '@/components/ds/Icon'
import { Toast } from '@/components/ds/Toast'
import { BATCH_STATUS_LABELS } from '@/lib/physical-markers/domain'

export interface BatchRow { id: number; code: string; quantity: number; destination: string; linked: number; status: string }
export interface OrderRow { id: number; quantity: number; status: string; memberId: number; createdAt: string }

export function MarkersAdmin({ batches: initial, orders, found, query }: { batches: BatchRow[]; orders: OrderRow[]; found: { uid: string; status: string; artworkId: number | null; batch: string; readCounter: number } | null; query: string }) {
  const [batches, setBatches] = useState(initial)
  const [form, setForm] = useState({ code: '', quantity: 100, destination: '' })
  const [toast, setToast] = useState('')
  async function create(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/admin/markers/batches', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...form, quantity: Number(form.quantity) }) })
    const data = await res.json().catch(() => ({})) as { id?: number; error?: string }
    if (!res.ok) { setToast(data.error ?? 'Não foi possível criar o lote.'); return }
    setBatches([{ id: data.id!, code: form.code, quantity: Number(form.quantity), destination: form.destination, linked: 0, status: 'NEW' }, ...batches])
    setForm({ code: '', quantity: 100, destination: '' })
    setToast('Lote criado')
  }
  async function ship(orderId: number, batchId: number) {
    const res = await fetch(`/api/admin/markers/orders/${orderId}/ship`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ batchId }) })
    const data = await res.json().catch(() => ({})) as { error?: string }
    setToast(res.ok ? 'Pedido enviado' : data.error ?? 'Falha ao enviar')
    if (res.ok) window.location.reload()
  }
  return (
    <div className="ha-stack">
      <form className="ha-topbar__search" role="search" method="get">
        <Icon name="search" size={20} /><input name="q" className="ha-topbar__input" placeholder="UID da etiqueta ou ID da obra" defaultValue={query} />
      </form>
      {found ? <div className="ha-callout"><Icon name="sell" /><div>UID <b>{found.uid}</b> · lote {found.batch} · {found.status} · obra {found.artworkId ?? '—'} · contador {found.readCounter}</div></div> : null}
      {query && !found ? <p className="ha-muted">Nada encontrado para “{query}”.</p> : null}
      <section className="ha-table" style={{ '--ha-cols': '100px 80px 2fr 1fr 120px' } as React.CSSProperties}>
        <div className="ha-table__inner">
          <div className="ha-table__head"><div>Lote</div><div>Qtd.</div><div>Destino</div><div>Vinculadas</div><div>Status</div></div>
          {batches.map((b) => (
            <div key={b.id} className="ha-table__row">
              <div>{b.code}</div><div>{b.quantity.toLocaleString('pt-BR')}</div><div>{b.destination}</div>
              <div>{b.linked.toLocaleString('pt-BR')} · {b.quantity ? Math.round((b.linked / b.quantity) * 100) : 0}%</div>
              <div><Badge tone={b.status === 'EXHAUSTED' ? 'neutral' : b.status === 'NEW' ? 'pending' : 'verified'}>{BATCH_STATUS_LABELS[b.status as keyof typeof BATCH_STATUS_LABELS] ?? b.status}</Badge></div>
            </div>
          ))}
        </div>
      </section>
      <p className="ha-muted ha-sm">Etiquetas com chip NXP e criptografia por obra. Uma etiqueta removida invalida a leitura e abre alerta automático.</p>
      <h2 className="ha-h3">Pedidos de kit</h2>
      <ul className="ha-list">
        {orders.length === 0 ? <li className="ha-muted">Nenhum pedido.</li> : null}
        {orders.map((o) => (
          <li key={o.id} className="ha-list__row" style={{ gridTemplateColumns: '1fr auto auto' }}>
            <span>Pedido {o.id} · {o.quantity} etiqueta(s) · membro {o.memberId} · {new Date(o.createdAt).toLocaleDateString('pt-BR')}</span>
            <Badge tone={o.status === 'REQUESTED' ? 'pending' : 'verified'}>{o.status}</Badge>
            {o.status === 'REQUESTED' && batches.length ? (
              <select className="ha-select" defaultValue="" onChange={(e) => { if (e.target.value) void ship(o.id, Number(e.target.value)) }}>
                <option value="">Enviar do lote…</option>
                {batches.filter((b) => b.status !== 'EXHAUSTED').map((b) => <option key={b.id} value={b.id}>{b.code}</option>)}
              </select>
            ) : null}
          </li>
        ))}
      </ul>
      <h2 className="ha-h3">Novo lote</h2>
      <form className="ha-row" onSubmit={create}>
        <input className="ha-input" placeholder="2026-10" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
        <input className="ha-input ha-input--num" type="number" min={1} max={100000} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} required />
        <input className="ha-input" placeholder="Destino" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} required />
        <button className="ha-btn ha-btn--primary ha-btn--md" type="submit">Criar lote</button>
      </form>
      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  )
}
