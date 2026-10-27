'use client'
// Admin · Obras e certificados › Fila de revisão (HouseArt Web App.dc.html).
// Each decision opens a confirmation that states its effect (core.ts) and asks
// for a reason when it undoes something; nothing leaves the list until the
// server says the decision was recorded.
import Link from 'next/link'
import { useCallback, useState } from 'react'
import { Modal } from '@/components/ds/Modal'
import { Toast } from '@/components/ds/Toast'
import { decidedLine, needsReason, REVIEW_EFFECTS, REVIEW_KIND_LABELS, REVIEW_KIND_TONES, type ReviewDecision, type ReviewKind } from '@/lib/admin-review/core'

export interface QueueItem {
  id: number; kind: ReviewKind; reason: string; ago: string
  artwork: { id: number; title: string; year: number | null; publicId: string | null; artist: string; cover: string | null } | null
  /** The history views: who decided, when, and the note. */
  decided?: { decision: ReviewDecision; by: string | null; ago: string; note: string | null } | null
}

const DECISION_LABELS: Record<ReviewDecision, string> = { APPROVED: 'Aprovar', REJECTED: 'Rejeitar' }

export function ReviewQueue({ items, readOnly = false, detailLinks = true }: { items: QueueItem[]; readOnly?: boolean; /** the row links to its detail page (off on the detail page itself) */ detailLinks?: boolean }) {
  const [decided, setDecided] = useState<Record<number, ReviewDecision>>({})
  const [pending, setPending] = useState<{ item: QueueItem; decision: ReviewDecision } | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const close = useCallback(() => { if (!busy) { setPending(null); setNote(''); setError('') } }, [busy])

  async function confirm() {
    if (!pending) return
    const { item, decision } = pending
    if (needsReason(item.kind, decision) && !note.trim()) { setError('Escreva o motivo da decisão.'); return }
    setBusy(true); setError('')
    const res = await fetch(`/api/admin/review/${item.id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ decision, note: note.trim() || undefined }) })
    const data = await res.json().catch(() => ({})) as { error?: string }
    setBusy(false)
    if (!res.ok) { setError(data.error ?? 'Não foi possível gravar a decisão. Tente de novo.'); return }
    setDecided((d) => ({ ...d, [item.id]: decision }))
    setPending(null); setNote('')
    setToast(decision === 'APPROVED' ? 'Aprovado' : 'Rejeitado')
  }

  return (
    <>
      <div className="ha-review" role="table" aria-label="Fila de revisão">
        <div className="ha-review__inner">
          <div className="ha-review__head" role="row"><span role="columnheader">Tipo</span><span role="columnheader">Obra</span><span role="columnheader">Motivo</span><span role="columnheader">Aberto</span><span role="columnheader">{readOnly ? 'Decisão' : <span className="ha-sr">Ações</span>}</span></div>
          {items.length === 0 ? <div className="ha-review__empty">{readOnly ? 'Nenhuma decisão neste filtro.' : 'A fila está vazia. Novos itens aparecem aqui quando o sistema detecta duplicidade, contestação, emissor novo ou etiqueta removida.'}</div> : null}
          {items.map((i) => {
            const tone = REVIEW_KIND_TONES[i.kind]
            const done = decided[i.id]
            return (
              <div key={i.id} className="ha-review__row" role="row">
                <span role="cell"><span className="ha-review__kind" style={{ background: `var(${tone.bg})`, color: `var(${tone.fg})` }}>{REVIEW_KIND_LABELS[i.kind]}</span></span>
                <span role="cell" className="ha-review__work">
                  <span className="ha-review__thumb">
                    {/* eslint-disable-next-line @next/next/no-img-element -- public derivative */}
                    {i.artwork?.cover ? <img src={i.artwork.cover} alt="" /> : null}
                  </span>
                  {i.artwork ? (
                    <span>
                      {i.artwork.publicId ? <Link href={`/verify/${i.artwork.publicId}`} className="ha-review__title"><i>{i.artwork.title}</i>{i.artwork.year ? `, ${i.artwork.year}` : ''}</Link> : <span className="ha-review__title"><i>{i.artwork.title}</i>{i.artwork.year ? `, ${i.artwork.year}` : ''}</span>}
                      <span className="ha-review__who">{i.artwork.artist}</span>
                    </span>
                  ) : <span className="ha-review__who">Sem obra vinculada</span>}
                </span>
                <span role="cell" className="ha-review__reason">{i.reason}{detailLinks ? <Link href={`/admin/review/${i.id}`} className="ha-review__open">Ver detalhe →</Link> : null}</span>
                <span role="cell" className="ha-review__ago">{i.ago}</span>
                <span role="cell" className="ha-review__actions">
                  {i.decided ? (
                    <span className="ha-review__done" title={i.decided.note ?? undefined}>{decidedLine(i.decided.decision, i.decided.by, i.decided.ago)}{i.decided.note ? <span className="ha-review__who">“{i.decided.note}”</span> : null}</span>
                  ) : done ? <span className="ha-review__done">{done === 'APPROVED' ? 'Aprovado' : 'Rejeitado'}</span> : readOnly ? null : (<>
                    <button type="button" className="ha-btn ha-btn--outline ha-btn--xs" onClick={() => setPending({ item: i, decision: 'REJECTED' })}>Rejeitar</button>
                    <button type="button" className="ha-btn ha-btn--ink ha-btn--xs" onClick={() => setPending({ item: i, decision: 'APPROVED' })}>Aprovar</button>
                  </>)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <Modal open={pending !== null} onClose={close} title={pending ? `${DECISION_LABELS[pending.decision]} · ${REVIEW_KIND_LABELS[pending.item.kind]}` : ''}
        footer={pending ? (<>
          <button type="button" className="ha-btn ha-btn--ghost ha-btn--md" onClick={close} disabled={busy}>Cancelar</button>
          <button type="button" className={`ha-btn ha-btn--${pending.decision === 'APPROVED' ? 'ink' : 'outline'} ha-btn--md${busy ? ' ha-btn--loading' : ''}`} onClick={confirm} disabled={busy} aria-busy={busy || undefined}>
            {busy ? <span className="ha-spinner" aria-hidden="true" /> : null}{busy ? 'Gravando' : `Confirmar: ${DECISION_LABELS[pending.decision].toLowerCase()}`}
          </button>
        </>) : null}>
        {pending ? (
          <div className="ha-stack">
            {pending.item.artwork ? <p className="ha-sm"><i>{pending.item.artwork.title}</i> · {pending.item.artwork.artist}</p> : null}
            <p className="ha-muted ha-sm">{pending.item.reason}</p>
            <div className="ha-callout"><span className="ha-icon" aria-hidden="true">info</span><p className="ha-sm" style={{ margin: 0 }}>{REVIEW_EFFECTS[pending.item.kind][pending.decision]}</p></div>
            <label className="ha-label">
              Motivo{needsReason(pending.item.kind, pending.decision) ? '' : ' (opcional)'}
              <textarea className="ha-textarea" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Fica registrado na auditoria." />
            </label>
            {error ? <p className="ha-field-error" role="alert">{error}</p> : null}
          </div>
        ) : null}
      </Modal>
      <Toast message={toast} onDone={() => setToast('')} />
    </>
  )
}
