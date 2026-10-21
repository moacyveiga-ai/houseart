'use client'
import { useState } from 'react'
import { Badge } from '@/components/ds/Badge'
import type { ReviewKind } from '@/lib/admin-review/server'

export interface QueueItem { id: number; kind: ReviewKind; kindLabel: string; reason: string; createdAt: string; artwork: { id: number; title: string; artist: string; cover: string | null } | null }

export function ReviewQueue({ items: initial }: { items: QueueItem[] }) {
  const [items, setItems] = useState(initial)
  const [decided, setDecided] = useState<Record<number, string>>({})
  async function decide(id: number, decision: 'APPROVED' | 'REJECTED') {
    const res = await fetch(`/api/admin/review/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ decision }) })
    if (res.ok) setDecided({ ...decided, [id]: decision === 'APPROVED' ? 'Aprovado' : 'Rejeitado' })
    else setItems(items.filter((i) => i.id !== id))
  }
  const tone = (k: ReviewKind) => (k === 'CONTESTATION' || k === 'MARKER_REMOVED' ? 'alert' : k === 'DUPLICATE' ? 'pending' : 'neutral')
  return (
    <section className="ha-table" style={{ '--ha-cols': '140px 2fr 2fr 100px 200px' } as React.CSSProperties}>
      <div className="ha-table__inner">
        <div className="ha-table__head"><div>Tipo</div><div>Obra</div><div>Motivo</div><div>Aberto</div><div /></div>
        {items.length === 0 ? <div className="ha-table__row"><div className="ha-muted">Fila vazia.</div></div> : null}
        {items.map((i) => (
          <div key={i.id} className="ha-table__row">
            <div><Badge tone={tone(i.kind)}>{i.kindLabel}</Badge></div>
            <div>{i.artwork ? <><b>{i.artwork.title}</b><br /><span className="ha-muted ha-sm">{i.artwork.artist}</span></> : <span className="ha-muted">—</span>}</div>
            <div className="ha-sm">{i.reason}</div>
            <div className="ha-muted ha-sm">{new Date(i.createdAt).toLocaleDateString('pt-BR')}</div>
            <div className="ha-row">
              {decided[i.id] ? <Badge tone="neutral">{decided[i.id]}</Badge> : (<>
                <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" onClick={() => decide(i.id, 'REJECTED')}>Rejeitar</button>
                <button type="button" className="ha-btn ha-btn--ink ha-btn--sm" onClick={() => decide(i.id, 'APPROVED')}>Aprovar</button>
              </>)}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
