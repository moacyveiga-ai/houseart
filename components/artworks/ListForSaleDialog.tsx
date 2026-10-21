'use client'
import { useState } from 'react'
import { Modal } from '@/components/ds/Modal'
import { Toast } from '@/components/ds/Toast'

/** "Listar no marketplace": list price, floor (seller only), negotiator. */
export function ListForSaleDialog({ artworkId, title, defaultPrice, listed }: { artworkId: number; title: string; defaultPrice: string; listed: boolean }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ listPrice: defaultPrice, reservePrice: '', autoNegotiatorOn: true, autoAcceptMin: '92', fixedPrice: false })
  const [toast, setToast] = useState('')
  async function submit() {
    const body = { listPriceCents: Math.round(Number(form.listPrice.replace(/\D/g, '')) * 100), reservePriceCents: Math.round(Number(form.reservePrice.replace(/\D/g, '')) * 100), autoNegotiatorOn: form.autoNegotiatorOn, autoAcceptMinBps: Math.round(Number(form.autoAcceptMin) * 100), fixedPrice: form.fixedPrice }
    const res = await fetch(`/api/artworks/${artworkId}/list`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) { setToast(data.error ?? 'Não foi possível listar.'); return }
    setOpen(false); setToast('Obra listada no marketplace'); window.setTimeout(() => window.location.reload(), 700)
  }
  async function unlist() {
    const res = await fetch(`/api/artworks/${artworkId}/unlist`, { method: 'POST' })
    setToast(res.ok ? 'Obra retirada do marketplace' : 'Não foi possível retirar.')
    if (res.ok) window.setTimeout(() => window.location.reload(), 700)
  }
  return (
    <>
      {listed ? <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" onClick={unlist}>Retirar do marketplace</button> : <button type="button" className="ha-btn ha-btn--ink ha-btn--sm" onClick={() => setOpen(true)}>Listar no marketplace</button>}
      <Modal open={open} title="Listar no marketplace" onClose={() => setOpen(false)} footer={<button type="button" className="ha-btn ha-btn--primary ha-btn--md" onClick={submit}>Listar</button>}>
        <p className="ha-muted ha-sm">{title}</p>
        <label className="ha-label">Preço pedido (R$)<input className="ha-input ha-input--num" inputMode="numeric" value={form.listPrice} onChange={(e) => setForm({ ...form, listPrice: e.target.value })} /></label>
        <label className="ha-label">Piso — só você vê (R$)<input className="ha-input ha-input--num" inputMode="numeric" value={form.reservePrice} onChange={(e) => setForm({ ...form, reservePrice: e.target.value })} /></label>
        <label className="ha-row"><input type="checkbox" checked={form.fixedPrice} onChange={(e) => setForm({ ...form, fixedPrice: e.target.checked })} /> Preço fixo (sem propostas)</label>
        {!form.fixedPrice ? (<>
          <label className="ha-row"><input type="checkbox" checked={form.autoNegotiatorOn} onChange={(e) => setForm({ ...form, autoNegotiatorOn: e.target.checked })} /> Negociador automático</label>
          <label className="ha-label">Aceita propostas a partir de (% do preço pedido)<input className="ha-input ha-input--num" inputMode="numeric" value={form.autoAcceptMin} onChange={(e) => setForm({ ...form, autoAcceptMin: e.target.value })} /></label>
        </>) : null}
      </Modal>
      <Toast message={toast} onDone={() => setToast('')} />
    </>
  )
}
