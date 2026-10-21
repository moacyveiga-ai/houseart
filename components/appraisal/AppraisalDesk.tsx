'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ds/Badge'
import { Icon } from '@/components/ds/Icon'
import { Toast } from '@/components/ds/Toast'
import { formatBRL } from '@/lib/artworks/domain'
import type { Dossier, QueueItem } from '@/lib/appraisal/server'

const reais = (cents: string) => String(Math.round(Number(cents) / 100))
const toCents = (v: string) => Math.round(Number(v.replace(/\D/g, '')) * 100)

export function AppraisalDesk({ queue, dossier }: { queue: QueueItem[]; dossier: Dossier | null }) {
  const [min, setMin] = useState(dossier?.estimate ? reais(dossier.estimate.minCents) : '')
  const [sug, setSug] = useState(dossier?.estimate ? reais(dossier.estimate.suggestedCents) : '')
  const [max, setMax] = useState(dossier?.estimate ? reais(dossier.estimate.maxCents) : '')
  const [method, setMethod] = useState('Comparação direta com vendas registradas do mesmo artista, ajustada por técnica, dimensão e estado de conservação.')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [issued, setIssued] = useState(dossier?.issued ?? null)
  async function issue() {
    if (!dossier) return
    setBusy(true)
    const res = await fetch(`/api/appraisals/${dossier.request.id}/issue`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ minCents: toCents(min), suggestedCents: toCents(sug), maxCents: toCents(max), methodology: method }) })
    const data = await res.json().catch(() => ({})) as { code?: string; error?: string }
    setBusy(false)
    if (!res.ok) { setToast(data.error ?? 'Não foi possível emitir.'); return }
    setIssued({ code: data.code!, minCents: String(toCents(min)), suggestedCents: String(toCents(sug)), maxCents: String(toCents(max)), issuedAt: new Date().toISOString() })
    setToast(`Laudo ${data.code} emitido`)
  }
  const pct = (v: string) => { const a = Number(min || 0), b = Number(max || 0), x = Number(v || 0); return b > a ? Math.max(0, Math.min(100, Math.round(((x - a) / (b - a)) * 100))) : 50 }
  return (
    <div className="ha-split">
      <section className="ha-stack">
        <h1 className="ha-h1">Fila de laudos</h1>
        <ul className="ha-list">
          {queue.length === 0 ? <li className="ha-muted">Nenhum laudo na fila.</li> : null}
          {queue.map((q) => (
            <li key={q.id}>
              <Link href={`/appraisals?pedido=${q.id}`} className="ha-list__row ha-list__btn" style={{ gridTemplateColumns: '1fr auto', borderColor: dossier?.request.id === q.id ? 'var(--ha-ink-900)' : undefined }}>
                <span><b>{q.title}</b><br /><span className="ha-muted ha-sm">{q.who} · prazo {q.dueOn}</span></span>
                <Badge tone={q.overdue ? 'alert' : 'pending'}>{q.overdue ? 'Atrasado' : q.status === 'IN_PROGRESS' ? 'Em análise' : 'Na fila'}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      {dossier ? (
        <section className="ha-stack" style={{ gap: 'var(--ha-space-5)' }}>
          <div className="ha-eyebrow">Dossiê da obra</div>
          <div className="ha-row" style={{ alignItems: 'flex-start' }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
            <span className="ha-wall ha-wall--sq" style={{ width: 96 }}>{dossier.artwork.cover ? <img src={dossier.artwork.cover} alt="" /> : null}</span>
            <div><h2 className="ha-h2">{dossier.artwork.title}{dossier.artwork.year ? `, ${dossier.artwork.year}` : ''}</h2><p className="ha-muted">{dossier.artwork.artist} · {dossier.artwork.sheet}</p><p className="ha-muted ha-sm">{dossier.request.who} · {dossier.request.purposeLabel} · prazo {dossier.request.dueOn}</p></div>
          </div>
          <div className="ha-callout"><Icon name="verified" /><div>{dossier.provenanceLine}</div></div>
          <div className="ha-eyebrow">Comparáveis sugeridos</div>
          <ul className="ha-list">
            {dossier.comparables.length === 0 ? <li className="ha-muted">Sem vendas comparáveis registradas para este artista.</li> : null}
            {dossier.comparables.map((c, i) => <li key={i} className="ha-list__row" style={{ gridTemplateColumns: '2fr 1fr 1fr auto' }}><span>{c.label}</span><span className="ha-muted">{c.dimensions ?? '—'}</span><span className="ha-num">{formatBRL(BigInt(c.priceCents))}</span><span className="ha-muted ha-sm">{c.soldOn} · {c.sourceLabel}</span></li>)}
          </ul>
          {issued ? (
            <div className="ha-callout ha-callout--ok"><Icon name="task_alt" /><div>Laudo assinado · <b>{issued.code}</b> · {formatBRL(BigInt(issued.minCents))} — <b>{formatBRL(BigInt(issued.suggestedCents))}</b> — {formatBRL(BigInt(issued.maxCents))}<br /><a className="ha-link" href={`/verify/${issued.code}`} target="_blank" rel="noreferrer">PDF com QR para a página pública</a></div></div>
          ) : (
            <fieldset disabled={busy} className="ha-stack">
              <div className="ha-grid-cards ha-grid-cards--3">
                <label className="ha-label">Mínimo (R$)<input className="ha-input ha-input--num" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} /></label>
                <label className="ha-label">Sugerido (R$)<input className="ha-input ha-input--num" inputMode="numeric" value={sug} onChange={(e) => setSug(e.target.value.replace(/\D/g, ''))} /></label>
                <label className="ha-label">Máximo (R$)<input className="ha-input ha-input--num" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} /></label>
              </div>
              <div className="ha-progress" aria-hidden><span style={{ width: `${pct(sug)}%` }} /></div>
              {dossier.estimate ? <p className="ha-muted ha-sm">Estimativa de referência com base em {dossier.estimate.count} venda(s) comparável(is). Não é laudo.</p> : null}
              <label className="ha-label">Metodologia<textarea className="ha-input" rows={3} value={method} onChange={(e) => setMethod(e.target.value)} /></label>
              <div className="ha-callout"><Icon name="qr_code_2" /><div>Laudo assinado · PDF com QR para a página pública</div></div>
              <div className="ha-row ha-row--end"><button type="button" className="ha-btn ha-btn--primary ha-btn--md" onClick={issue} disabled={busy}>Assinar e emitir laudo</button></div>
            </fieldset>
          )}
        </section>
      ) : <section className="ha-stack"><p className="ha-muted">Selecione um pedido da fila.</p></section>}
      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  )
}
