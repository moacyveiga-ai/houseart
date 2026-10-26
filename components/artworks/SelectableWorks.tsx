'use client'
// "Minhas obras" with multi-select (handoff "Web Artista" › Minhas obras): a checkbox on
// each card, the dark bar "N obras selecionadas · Solicitar etiquetas · Listar no
// marketplace · ×", and the batch listing dialog. Decisions in select-core.ts.
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Badge } from '@/components/ds/Badge'
import { Modal } from '@/components/ds/Modal'
import { Toast } from '@/components/ds/Toast'
import { batchPayload, batchResultText, EMPTY_LISTABLE, EMPTY_MARKERS, summarize, type BatchRow, type SelectableWork } from './select-core'
import './selectable-works.css'

export interface SelectableCard extends SelectableWork {
  coverUrl: string | null
  /** Already formatted on the server: "Técnica · 60 × 80 cm". */
  subtitle: string
  priceText: string
  badge: { tone: 'verified' | 'pending' | 'neutral'; icon: string; label: string }
}

export function SelectableWorks({ items, markersOn }: { items: SelectableCard[]; markersOn: boolean }) {
  const [selected, setSelected] = useState<number[]>([])
  const [hint, setHint] = useState('')
  const [listing, setListing] = useState(false)
  const [toast, setToast] = useState('')
  const picked = useMemo(() => items.filter((a) => selected.includes(a.id)), [items, selected])
  const sum = useMemo(() => summarize(picked), [picked])

  function toggle(id: number) {
    setHint('')
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))
  }
  function clear() { setSelected([]); setHint('') }

  function requestMarkers() {
    if (!sum.markers) { setHint(EMPTY_MARKERS); return }
    // the kit is ordered on Certificação, which opens with this quantity (the order itself is one screen, one charge)
    window.location.assign(`/certification?qty=${sum.markers}`)
  }
  function openListing() {
    if (!sum.listable.length) { setHint(EMPTY_LISTABLE); return }
    setHint(sum.notListable ? `${sum.notListable} ${sum.notListable === 1 ? 'obra selecionada fica de fora' : 'obras selecionadas ficam de fora'}: só obras autenticadas com o selo verde vão ao marketplace.` : '')
    setListing(true)
  }

  return (
    <>
      {selected.length ? (
        <div className="ha-sel__bar" role="region" aria-label="Seleção">
          <span className="ha-sel__text" aria-live="polite">{sum.text}</span>
          <span className="ha-sel__actions">
            {markersOn ? <button type="button" className="ha-btn ha-btn--outline-paper ha-btn--sm" onClick={requestMarkers}>Solicitar etiquetas</button> : null}
            <button type="button" className="ha-btn ha-btn--paper ha-btn--sm" onClick={openListing}>Listar no marketplace</button>
            <button type="button" className="ha-sel__close" aria-label="Limpar seleção" onClick={clear}><Icon name="close" size={20} /></button>
          </span>
          {hint ? <span className="ha-sel__hint">{hint}</span> : null}
        </div>
      ) : null}
      <div className="ha-grid-cards">
        {items.map((a) => {
          const on = selected.includes(a.id)
          return (
            <div key={a.id} className={`ha-sel__item${on ? ' ha-sel__item--on' : ''}`}>
              <button type="button" className="ha-sel__check" aria-pressed={on} aria-label={`${on ? 'Desmarcar' : 'Selecionar'} ${a.title}`} onClick={() => toggle(a.id)}>
                {on ? <Icon name="check" size={18} /> : null}
              </button>
              <Link href={`/artworks/${a.id}/edit`} className="ha-card">
                <span className="ha-wall ha-wall--sq">{/* eslint-disable-next-line @next/next/no-img-element -- derivative served by the public store */}
                  {a.coverUrl ? <img src={a.coverUrl} alt={a.title} /> : <Icon name="imagesmode" size={28} />}</span>
                <div className="ha-card__body">
                  <div className="ha-title">{a.title}{a.year ? `, ${a.year}` : ''}</div>
                  <div className="ha-muted ha-sm">{a.subtitle}</div>
                  <div className="ha-row">
                    <Badge tone={a.badge.tone}><Icon name={a.badge.icon} size={14} /> {a.badge.label}</Badge>
                    <span className="ha-num">{a.priceText}</span>
                  </div>
                </div>
              </Link>
            </div>
          )
        })}
      </div>
      {listing ? <BatchListDialog works={sum.listable} onClose={() => setListing(false)} onDone={(ok, failed) => { setToast(batchResultText(ok, failed)); if (ok) window.setTimeout(() => window.location.reload(), 900) }} /> : null}
      <Toast message={toast} onDone={() => setToast('')} />
    </>
  )
}

/** "Listar no marketplace" for several works: price and floor per work, the negotiator shared. */
function BatchListDialog({ works, onClose, onDone }: { works: SelectableWork[]; onClose: () => void; onDone: (ok: number, failed: number) => void }) {
  const [rows, setRows] = useState<BatchRow[]>(works.map((w) => ({ id: w.id, listPrice: w.listPriceCents ? String(BigInt(w.listPriceCents) / 100n) : '', reservePrice: '' })))
  const [shared, setShared] = useState({ fixedPrice: false, autoNegotiatorOn: true, autoAcceptMin: '92' })
  const [error, setError] = useState('')
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({})
  const [done, setDone] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const titles = useMemo(() => new Map(works.map((w) => [w.id, `${w.title}${w.year ? `, ${w.year}` : ''}`])), [works])
  const pending = rows.filter((r) => !done.includes(r.id))

  function setRow(id: number, patch: Partial<BatchRow>) { setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r))) }

  async function submit() {
    setError('')
    const payload = batchPayload(pending, shared, titles)
    if (!payload.ok) { setError(payload.error); return }
    setBusy(true)
    const errs: Record<number, string> = {}
    const okIds: number[] = []
    // one at a time: each listing is its own transaction on the server, and a refusal names the work
    for (const it of payload.items) {
      try {
        const res = await fetch(`/api/artworks/${it.id}/list`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(it.body) })
        if (res.ok) okIds.push(it.id)
        else errs[it.id] = ((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Não foi possível listar.'
      } catch { errs[it.id] = 'Falha de rede. Tente de novo.' }
    }
    setBusy(false)
    setDone((d) => [...d, ...okIds])
    setRowErrors(errs)
    const failed = Object.keys(errs).length
    onDone(okIds.length, failed)
    if (!failed) onClose()
  }

  return (
    <Modal open title="Listar no marketplace" onClose={onClose} footer={<button type="button" className="ha-btn ha-btn--primary ha-btn--md" disabled={busy || pending.length === 0} onClick={submit}>{busy ? 'Listando…' : `Listar ${pending.length} ${pending.length === 1 ? 'obra' : 'obras'}`}</button>}>
      <p className="ha-muted ha-sm">Preço pedido e piso de cada obra, em reais. O piso só você vê.</p>
      <div className="ha-sel__rows">
        {rows.map((r) => {
          const isDone = done.includes(r.id)
          return (
            <div key={r.id} className={`ha-sel__row${isDone ? ' ha-sel__row--done' : ''}`}>
              <span className="ha-sel__row-title">{isDone ? '✓ ' : ''}{titles.get(r.id)}</span>
              <label className="ha-label">Preço (R$)<input className="ha-input ha-input--num" inputMode="numeric" disabled={isDone || busy} value={r.listPrice} onChange={(e) => setRow(r.id, { listPrice: e.target.value })} /></label>
              <label className="ha-label">Piso (R$)<input className="ha-input ha-input--num" inputMode="numeric" disabled={isDone || busy} value={r.reservePrice} onChange={(e) => setRow(r.id, { reservePrice: e.target.value })} /></label>
              {rowErrors[r.id] ? <span className="ha-sel__row-err" role="alert">{rowErrors[r.id]}</span> : null}
            </div>
          )
        })}
      </div>
      <label className="ha-row"><input type="checkbox" checked={shared.fixedPrice} disabled={busy} onChange={(e) => setShared({ ...shared, fixedPrice: e.target.checked })} /> Preço fixo (sem propostas)</label>
      {!shared.fixedPrice ? (<>
        <label className="ha-row"><input type="checkbox" checked={shared.autoNegotiatorOn} disabled={busy} onChange={(e) => setShared({ ...shared, autoNegotiatorOn: e.target.checked })} /> Negociador automático</label>
        <label className="ha-label">Aceita propostas a partir de (% do preço pedido)<input className="ha-input ha-input--num" inputMode="numeric" disabled={busy} value={shared.autoAcceptMin} onChange={(e) => setShared({ ...shared, autoAcceptMin: e.target.value })} /></label>
      </>) : null}
      {error ? <p className="ha-sm" role="alert" style={{ color: 'var(--ha-alert-500)' }}>{error}</p> : null}
    </Modal>
  )
}
