'use client'
import { useState } from 'react'
import { Modal } from '@/components/ds/Modal'
import { Toast } from '@/components/ds/Toast'
import type { KanbanCard } from '@/lib/crm/server'
import type { Stage } from '@/lib/crm/core'

export function Kanban({ columns: initial }: { columns: { stage: Stage; label: string; cards: KanbanCard[] }[] }) {
  const [columns, setColumns] = useState(initial)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', interest: '', valueCents: '' })
  const [toast, setToast] = useState('')
  async function move(card: KanbanCard, stage: Stage) {
    const res = await fetch(`/api/crm/opportunities/${card.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stage, outcome: stage === 'CLOSED' ? 'WON' : null }) })
    if (!res.ok) { setToast('Não foi possível mover.'); return }
    setColumns(columns.map((c) => ({ ...c, cards: c.stage === stage ? [{ ...card, stage }, ...c.cards] : c.cards.filter((x) => x.id !== card.id) })))
  }
  async function add(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/crm/contacts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...form, valueCents: form.valueCents ? Math.round(Number(form.valueCents.replace(/\D/g, '')) * 100) : undefined }) })
    if (!res.ok) { setToast('Não foi possível adicionar.'); return }
    window.location.reload()
  }
  const stages = columns.map((c) => c.stage)
  return (
    <div className="ha-stack">
      <div className="ha-row ha-row--end"><button type="button" className="ha-btn ha-btn--primary ha-btn--sm" onClick={() => setAdding(true)}>+ Interessado</button></div>
      <div className="ha-kanban">
        {columns.map((col) => (
          <div key={col.stage} className="ha-kanban__col">
            <div className="ha-row"><b>{col.label}</b><span className="ha-nav-badge">{col.cards.length}</span></div>
            {col.cards.map((card) => (
              <div key={card.id} className="ha-kanban__card">
                <div className="ha-row"><span className="ha-avatar">{card.initials}</span><b>{card.name}</b></div>
                <div className="ha-sm">{card.interest}</div>
                <div className="ha-row"><span className="ha-num ha-sm">{card.value}</span><span className="ha-muted ha-sm">{card.when}</span></div>
                <select className="ha-select" value={card.stage} aria-label="Mover" onChange={(e) => move(card, e.target.value as Stage)}>
                  {stages.map((s) => <option key={s} value={s}>{columns.find((c) => c.stage === s)?.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        ))}
      </div>
      <Modal open={adding} title="Novo interessado" onClose={() => setAdding(false)} footer={<button type="submit" form="crm-add" className="ha-btn ha-btn--primary ha-btn--md">Adicionar</button>}>
        <form id="crm-add" className="ha-stack" onSubmit={add}>
          <label className="ha-label">Nome<input className="ha-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label className="ha-label">E-mail<input className="ha-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label className="ha-label">Interesse<input className="ha-input" placeholder="Consultora · abstração brasileira" value={form.interest} onChange={(e) => setForm({ ...form, interest: e.target.value })} /></label>
          <label className="ha-label">Orçamento (R$)<input className="ha-input ha-input--num" inputMode="numeric" value={form.valueCents} onChange={(e) => setForm({ ...form, valueCents: e.target.value })} /></label>
        </form>
      </Modal>
      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  )
}
