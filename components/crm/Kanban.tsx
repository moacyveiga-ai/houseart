'use client'
import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/ds/Modal'
import { Toast } from '@/components/ds/Toast'
import type { KanbanCard } from '@/lib/crm/server'
import type { Stage } from '@/lib/crm/core'
import { Icon } from '@/components/ds/Icon'
import { moveCard, neighbourStage, placeOf, stageAtPoint } from './kanban-core'

export function Kanban({ columns: initial }: { columns: { stage: Stage; label: string; cards: KanbanCard[] }[] }) {
  const [columns, setColumns] = useState(initial)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', interest: '', valueCents: '' })
  const [toast, setToast] = useState('')
  const [dragging, setDragging] = useState<number | null>(null)
  const [over, setOver] = useState<Stage | null>(null)
  const [live, setLive] = useState('')
  const pointer = useRef<{ id: number; pointerId: number; x: number; y: number; scroll: number } | null>(null)
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null)
  const board = useRef<HTMLDivElement>(null)
  const inFlight = useRef(new Set<number>())
  const refocus = useRef<number | null>(null)
  const labelOf = (st: Stage) => columns.find((c) => c.stage === st)?.label ?? st

  // a card that changes column is remounted by React: give the keyboard focus back to it
  useEffect(() => {
    if (refocus.current === null) return
    board.current?.querySelector<HTMLElement>(`[data-card="${refocus.current}"]`)?.focus()
    refocus.current = null
  }, [columns])

  // optimistic: the card moves now; a refusal puts it back where it was. One move per card at a time.
  async function move(cardId: number, stage: Stage, keepFocus = false) {
    if (inFlight.current.has(cardId)) return
    const from = placeOf(columns, cardId)
    if (!from || from.stage === stage) return
    inFlight.current.add(cardId)
    setColumns((cur) => moveCard(cur, cardId, stage))
    if (keepFocus) refocus.current = cardId
    const res = await fetch(`/api/crm/opportunities/${cardId}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stage, outcome: stage === 'CLOSED' ? 'WON' : null }) }).catch(() => null)
    inFlight.current.delete(cardId)
    if (res?.status === 409) {
      // someone else moved it: the board on screen is stale, read it again
      setToast('Este cartão mudou em outro lugar. Atualizando o quadro…')
      setLive('O cartão mudou em outro lugar. Atualizando o quadro.')
      window.location.reload()
      return
    }
    if (!res || !res.ok) {
      setColumns((cur) => moveCard(cur, cardId, from.stage, from.index))
      if (keepFocus) refocus.current = cardId
      setToast('Não foi possível mover. O cartão voltou para onde estava.')
      setLive('Não foi possível mover o cartão.')
      return
    }
    setLive(`Movido para ${labelOf(stage)}.`)
  }

  function endDrag() { setDragging(null); setOver(null); setOffset(null); pointer.current = null }
  // touch and pen: drag by the handle (mouse uses the browser's drag and drop on the whole card).
  // The column is found by the columns' boxes: the dragged card sits under the finger.
  function stageAt(x: number, y: number): Stage | null {
    const boxes = [...(board.current?.querySelectorAll<HTMLElement>('[data-stage]') ?? [])].map((el) => {
      const r = el.getBoundingClientRect()
      return { stage: el.dataset.stage as Stage, left: r.left, right: r.right, top: r.top, bottom: r.bottom }
    })
    return stageAtPoint(boxes, x, y)
  }
  function onHandleDown(e: React.PointerEvent, cardId: number) {
    if (e.pointerType === 'mouse') return
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    pointer.current = { id: cardId, pointerId: e.pointerId, x: e.clientX, y: e.clientY, scroll: board.current?.scrollLeft ?? 0 }
    setDragging(cardId)
  }
  function onHandleMove(e: React.PointerEvent) {
    const p = pointer.current
    const el = board.current
    if (!p || p.pointerId !== e.pointerId || !el) return
    // near the board's edge, scroll it so the columns off screen are reachable
    const r = el.getBoundingClientRect()
    if (e.clientX > r.right - 40) el.scrollLeft += 12
    else if (e.clientX < r.left + 40) el.scrollLeft -= 12
    setOffset({ x: e.clientX - p.x + (el.scrollLeft - p.scroll), y: e.clientY - p.y })
    setOver(stageAt(e.clientX, e.clientY))
  }
  function onHandleUp(e: React.PointerEvent) {
    const p = pointer.current
    if (!p || p.pointerId !== e.pointerId) return
    const target = stageAt(e.clientX, e.clientY)
    endDrag()
    if (target) void move(p.id, target)
  }
  function onCardKey(e: React.KeyboardEvent, card: KanbanCard) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const to = neighbourStage(columns, card.stage, e.key === 'ArrowLeft' ? -1 : 1)
    if (to) void move(card.id, to, true)
  }

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/crm/contacts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...form, valueCents: form.valueCents ? Math.round(Number(form.valueCents.replace(/\D/g, '')) * 100) : undefined }) })
    if (!res.ok) { setToast('Não foi possível adicionar.'); return }
    window.location.reload()
  }
  return (
    <div className="ha-stack">
      <div className="ha-row ha-row--end"><button type="button" className="ha-btn ha-btn--primary ha-btn--sm" onClick={() => setAdding(true)}>+ Interessado</button></div>
      <p id="crm-drag-help" className="ha-muted ha-sm">Arraste os cartões entre as colunas. No teclado, selecione o cartão e use as setas ← e →.</p>
      <div className="ha-kanban" ref={board}>
        {columns.map((col) => (
          <div key={col.stage} data-stage={col.stage} className={`ha-kanban__col${over === col.stage && dragging !== null ? ' ha-kanban__col--over' : ''}`}
            onDragOver={(e) => { if (dragging === null) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (over !== col.stage) setOver(col.stage) }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((o) => (o === col.stage ? null : o)) }}
            onDrop={(e) => { e.preventDefault(); const id = Number(e.dataTransfer.getData('text/plain')); endDrag(); if (id) void move(id, col.stage) }}>
            <div className="ha-row"><b>{col.label}</b><span className="ha-nav-badge">{col.cards.length}</span></div>
            {col.cards.map((card) => (
              <div key={card.id} data-card={card.id} className={`ha-kanban__card${dragging === card.id ? ' ha-kanban__card--dragging' : ''}`}
                draggable tabIndex={0} role="group" aria-describedby="crm-drag-help" aria-label={`${card.name}, ${col.label}`}
                style={dragging === card.id && offset ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined}
                onDragStart={(e) => { e.dataTransfer.setData('text/plain', String(card.id)); e.dataTransfer.effectAllowed = 'move'; setDragging(card.id) }}
                onDragEnd={endDrag}
                onKeyDown={(e) => onCardKey(e, card)}>
                <div className="ha-row">
                  <span className="ha-avatar">{card.initials}</span><b className="ha-kanban__name">{card.name}</b>
                  <button type="button" className="ha-kanban__handle" aria-hidden="true" tabIndex={-1}
                    onPointerDown={(e) => onHandleDown(e, card.id)} onPointerMove={onHandleMove} onPointerUp={onHandleUp} onPointerCancel={endDrag}>
                    <Icon name="drag_indicator" size={18} />
                  </button>
                </div>
                <div className="ha-sm">{card.interest}</div>
                <div className="ha-row"><span className="ha-num ha-sm">{card.value}</span><span className="ha-muted ha-sm">{card.when}</span></div>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="ha-sr" aria-live="polite">{live}</p>
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
