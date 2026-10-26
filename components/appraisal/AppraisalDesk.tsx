'use client'
// The appraisal desk: the queue (filters as links, responsible and deadline per row), the
// dossier and "Assinar e emitir laudo" for the appraiser; for the team, assign/free an
// appraiser, move the deadline and cancel with a note (PATCH /api/appraisals/[id]).
import { useState } from 'react'
import Link from 'next/link'
import { Badge, type BadgeTone } from '@/components/ds/Badge'
import { Icon } from '@/components/ds/Icon'
import { Modal } from '@/components/ds/Modal'
import { Toast } from '@/components/ds/Toast'
import { formatBRL } from '@/lib/artworks/domain'
import type { Dossier, QueueItem } from '@/lib/appraisal/server'
import { CANCEL_NOTE_MAX, canIssue, canTake, daysLeft, DESK_STATE_LABELS, dueLabel, isOpen, type Actor, type DeskFilter, type DeskState } from '@/lib/appraisal/desk-core'

const reais = (cents: string) => String(Math.round(Number(cents) / 100))
const toCents = (v: string) => Math.round(Number(v.replace(/\D/g, '')) * 100)
const TONE: Record<DeskState, BadgeTone> = { QUEUED: 'pending', IN_PROGRESS: 'ink', OVERDUE: 'alert', ISSUED: 'verified', CANCELLED: 'neutral' }
type Patch = { action: 'take' } | { action: 'assign'; appraiserUserId: number | null } | { action: 'due'; dueDay: string } | { action: 'cancel'; note: string }
type PatchReply = { error?: string; assignedAppraiserId?: number | null; assignedName?: string | null; status?: string; dueOn?: string; dueDay?: string; dueOnIso?: string; orderStatus?: string | null; refunded?: boolean }

export function AppraisalDesk({ queue, dossier, selected: initialSelected, actor, manage, appraisers, filter, filters }: {
  queue: QueueItem[]; dossier: Dossier | null; selected: QueueItem | null; actor: Actor; manage: boolean
  appraisers: { id: number; name: string; open: number }[]; filter: DeskFilter; filters: { key: DeskFilter; label: string; count: number }[]
}) {
  const [rows, setRows] = useState(queue)
  const [sel, setSel] = useState(initialSelected)
  const [min, setMin] = useState(dossier?.estimate ? reais(dossier.estimate.minCents) : '')
  const [sug, setSug] = useState(dossier?.estimate ? reais(dossier.estimate.suggestedCents) : '')
  const [max, setMax] = useState(dossier?.estimate ? reais(dossier.estimate.maxCents) : '')
  const [method, setMethod] = useState('Comparação direta com vendas registradas do mesmo artista, ajustada por técnica, dimensão e estado de conservação.')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [issued, setIssued] = useState(dossier?.issued ?? null)
  const [who, setWho] = useState(initialSelected?.assignedAppraiserId ? String(initialSelected.assignedAppraiserId) : '')
  const [day, setDay] = useState(initialSelected?.dueDay ?? '')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const now = new Date()

  function applyRow(id: number, patch: Partial<QueueItem>) {
    const upd = (q: QueueItem) => (q.id === id ? { ...q, ...patch } : q)
    setRows((xs) => xs.map(upd))
    setSel((s) => (s && s.id === id ? { ...s, ...patch } : s))
  }

  async function patch(body: Patch): Promise<PatchReply | null> {
    if (!sel) return null
    setBusy(true); setErr('')
    const res = await fetch(`/api/appraisals/${sel.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
    const data = (await res?.json().catch(() => ({}))) as PatchReply
    setBusy(false)
    if (!res?.ok) { setErr(data.error ?? 'Não foi possível concluir.'); return null }
    return data
  }
  async function take() {
    const d = await patch({ action: 'take' }); if (!d || !sel) return
    applyRow(sel.id, { assignedAppraiserId: d.assignedAppraiserId ?? actor.userId, assignedName: d.assignedName ?? null, status: d.status ?? 'IN_PROGRESS', state: sel.overdue ? 'OVERDUE' : 'IN_PROGRESS', stateLabel: sel.overdue ? DESK_STATE_LABELS.OVERDUE : DESK_STATE_LABELS.IN_PROGRESS })
    setToast('Pedido assumido')
  }
  async function assign() {
    const id = who ? Number(who) : null
    const d = await patch({ action: 'assign', appraiserUserId: id }); if (!d || !sel) return
    const st: DeskState = sel.overdue ? 'OVERDUE' : d.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'QUEUED'
    applyRow(sel.id, { assignedAppraiserId: d.assignedAppraiserId ?? null, assignedName: d.assignedName ?? null, status: d.status ?? sel.status, state: st, stateLabel: DESK_STATE_LABELS[st] })
    setToast(id ? `Atribuído a ${d.assignedName}` : 'Pedido liberado para a fila')
  }
  async function due() {
    const d = await patch({ action: 'due', dueDay: day }); if (!d || !sel) return
    const iso = d.dueOnIso ?? sel.dueOnIso
    applyRow(sel.id, { dueOn: d.dueOn ?? sel.dueOn, dueDay: d.dueDay ?? sel.dueDay, dueOnIso: iso, overdue: false, state: sel.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'QUEUED', stateLabel: sel.status === 'IN_PROGRESS' ? DESK_STATE_LABELS.IN_PROGRESS : DESK_STATE_LABELS.QUEUED, daysLeft: daysLeft(iso, new Date()) })
    setToast(`Prazo: ${d.dueOn}`)
  }
  async function cancel() {
    const d = await patch({ action: 'cancel', note }); if (!d || !sel) return
    applyRow(sel.id, { status: 'CANCELLED', state: 'CANCELLED', stateLabel: DESK_STATE_LABELS.CANCELLED, overdue: false })
    setCancelOpen(false); setNote('')
    setToast(d.refunded ? 'Pedido cancelado · valor estornado' : d.orderStatus === 'PAID' ? 'Pedido cancelado · o estorno não saiu: fica para o financeiro' : 'Pedido cancelado')
  }
  async function issue() {
    if (!dossier) return
    setBusy(true); setErr('')
    const res = await fetch(`/api/appraisals/${dossier.request.id}/issue`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ minCents: toCents(min), suggestedCents: toCents(sug), maxCents: toCents(max), methodology: method }) })
    const data = await res.json().catch(() => ({})) as { code?: string; error?: string }
    setBusy(false)
    if (!res.ok) { setErr(data.error ?? 'Não foi possível emitir.'); return }
    setIssued({ code: data.code!, minCents: String(toCents(min)), suggestedCents: String(toCents(sug)), maxCents: String(toCents(max)), issuedAt: new Date().toISOString() })
    applyRow(dossier.request.id, { status: 'ISSUED', state: 'ISSUED', stateLabel: DESK_STATE_LABELS.ISSUED, overdue: false, issuedCode: data.code ?? null, assignedAppraiserId: actor.userId })
    setToast(`Laudo ${data.code} emitido`)
  }
  const pct = (v: string) => { const a = Number(min || 0), b = Number(max || 0), x = Number(v || 0); return b > a ? Math.max(0, Math.min(100, Math.round(((x - a) / (b - a)) * 100))) : 50 }
  const row = sel ? { id: sel.id, status: sel.status, dueOn: sel.dueOnIso, assignedAppraiserId: sel.assignedAppraiserId } : null
  const mayIssue = row ? canIssue(actor, row) : false
  const mayTake = row ? canTake(actor, row) : false
  const open = sel ? isOpen(sel.status) : false
  const heldByOther = !!sel && open && sel.assignedAppraiserId !== null && sel.assignedAppraiserId !== actor.userId

  return (
    <div className="ha-split ha-adesk">
      <section className="ha-stack">
        {!manage ? <h1 className="ha-h1">Fila de laudos</h1> : null}
        <nav className="ha-adesk__filters" aria-label="Filtros">
          {filters.map((f) => <Link key={f.key} href={`/appraisals?f=${f.key}`} className={`ha-chip${f.key === filter ? ' ha-chip--on' : ''}`} aria-current={f.key === filter ? 'page' : undefined}>{f.label} · {f.count}</Link>)}
        </nav>
        <ul className="ha-list">
          {rows.length === 0 ? <li className="ha-muted">Nenhum pedido neste filtro.</li> : null}
          {rows.map((q) => (
            <li key={q.id}>
              <Link href={`/appraisals?f=${filter}&pedido=${q.id}`} className="ha-list__row ha-list__btn ha-adesk__row" style={{ borderColor: sel?.id === q.id ? 'var(--ha-ink-900)' : undefined }}>
                <span className="ha-adesk__main"><b>{q.title}</b><span className="ha-muted ha-sm">{q.who} · prazo {q.dueOn}{isOpen(q.status) ? ` · ${dueLabel(q.dueOnIso, now, q.status)}` : ''}</span><span className="ha-muted ha-sm">{q.assignedName ? <><Icon name="person" /> {q.assignedAppraiserId === actor.userId ? 'você' : q.assignedName}</> : isOpen(q.status) ? 'sem avaliador' : q.issuedCode ?? ''}</span></span>
                <Badge tone={TONE[q.state]}>{q.stateLabel}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      {dossier && sel ? (
        <section className="ha-stack" style={{ gap: 'var(--ha-space-5)' }}>
          <div className="ha-eyebrow">Dossiê da obra</div>
          <div className="ha-row" style={{ alignItems: 'flex-start' }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
            <span className="ha-wall ha-wall--sq" style={{ width: 96 }}>{dossier.artwork.cover ? <img src={dossier.artwork.cover} alt="" /> : null}</span>
            <div><h2 className="ha-h2">{dossier.artwork.title}{dossier.artwork.year ? `, ${dossier.artwork.year}` : ''}</h2><p className="ha-muted">{dossier.artwork.artist} · {dossier.artwork.sheet}</p><p className="ha-muted ha-sm">{dossier.request.who} · {dossier.request.purposeLabel} · prazo {sel.dueOn}{open ? ` · ${dueLabel(sel.dueOnIso, now, sel.status)}` : ''}</p></div>
          </div>
          <div className="ha-adesk__hold">
            <Badge tone={TONE[sel.state]}>{sel.stateLabel}</Badge>
            <span className="ha-sm">{sel.assignedName ? <>Avaliador: <b>{sel.assignedAppraiserId === actor.userId ? 'você' : sel.assignedName}</b></> : open ? 'Sem avaliador' : null}</span>
            {mayTake ? <button type="button" className="ha-btn ha-btn--secondary ha-btn--sm" onClick={take} disabled={busy}>Assumir este pedido</button> : null}
          </div>
          {manage && open ? (
            <div className="ha-adesk__team">
              <div className="ha-eyebrow">Equipe</div>
              <div className="ha-adesk__ctl">
                <label className="ha-label">Avaliador<select className="ha-input" value={who} onChange={(e) => setWho(e.target.value)} disabled={busy}><option value="">— sem avaliador (na fila)</option>{sel.assignedAppraiserId !== null && !appraisers.some((a) => a.id === sel.assignedAppraiserId) ? <option value={sel.assignedAppraiserId} disabled>{sel.assignedName} · inativo</option> : null}{appraisers.map((a) => <option key={a.id} value={a.id}>{a.name}{a.open ? ` · ${a.open} aberto${a.open === 1 ? '' : 's'}` : ''}</option>)}</select></label>
                <button type="button" className="ha-btn ha-btn--secondary ha-btn--md" onClick={assign} disabled={busy || (who ? Number(who) : null) === sel.assignedAppraiserId}>{who ? 'Atribuir' : 'Liberar para a fila'}</button>
              </div>
              <div className="ha-adesk__ctl">
                <label className="ha-label">Prazo<input className="ha-input" type="date" value={day} onChange={(e) => setDay(e.target.value)} disabled={busy} /></label>
                <button type="button" className="ha-btn ha-btn--secondary ha-btn--md" onClick={due} disabled={busy || !day || day === sel.dueDay}>Mudar o prazo</button>
                <button type="button" className="ha-btn ha-btn--ghost ha-btn--md" onClick={() => setCancelOpen(true)} disabled={busy}>Cancelar pedido</button>
              </div>
              {appraisers.length === 0 ? <p className="ha-muted ha-sm">Nenhum avaliador ativo: crie a conta com o perfil Avaliador em Usuários e contas.</p> : null}
            </div>
          ) : null}
          <div className="ha-callout"><Icon name="verified" /><div>{dossier.provenanceLine}</div></div>
          <div className="ha-eyebrow">Comparáveis sugeridos</div>
          <ul className="ha-list">
            {dossier.comparables.length === 0 ? <li className="ha-muted">Sem vendas comparáveis registradas para este artista.</li> : null}
            {dossier.comparables.map((c, i) => <li key={i} className="ha-list__row" style={{ gridTemplateColumns: '2fr 1fr 1fr auto' }}><span>{c.label}</span><span className="ha-muted">{c.dimensions ?? '—'}</span><span className="ha-num">{formatBRL(BigInt(c.priceCents))}</span><span className="ha-muted ha-sm">{c.soldOn} · {c.sourceLabel}</span></li>)}
          </ul>
          {err ? <p className="ha-adesk__err" role="alert">{err}</p> : null}
          {issued ? (
            <div className="ha-callout ha-callout--ok"><Icon name="task_alt" /><div>Laudo assinado · <b>{issued.code}</b> · {formatBRL(BigInt(issued.minCents))} — <b>{formatBRL(BigInt(issued.suggestedCents))}</b> — {formatBRL(BigInt(issued.maxCents))}<br /><a className="ha-link" href={`/verify/${issued.code}`} target="_blank" rel="noreferrer">PDF com QR para a página pública</a></div></div>
          ) : sel.status === 'CANCELLED' ? (
            <div className="ha-callout"><Icon name="block" /><div>Pedido cancelado pela equipe.</div></div>
          ) : heldByOther && !manage ? (
            <div className="ha-callout"><Icon name="person" /><div>Este pedido está com <b>{sel.assignedName}</b>. Só a equipe pode reatribuí-lo.</div></div>
          ) : (
            <fieldset disabled={busy || !mayIssue} className="ha-stack">
              <div className="ha-grid-cards ha-grid-cards--3">
                <label className="ha-label">Mínimo (R$)<input className="ha-input ha-input--num" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} /></label>
                <label className="ha-label">Sugerido (R$)<input className="ha-input ha-input--num" inputMode="numeric" value={sug} onChange={(e) => setSug(e.target.value.replace(/\D/g, ''))} /></label>
                <label className="ha-label">Máximo (R$)<input className="ha-input ha-input--num" inputMode="numeric" value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} /></label>
              </div>
              <div className="ha-progress" aria-hidden><span style={{ width: `${pct(sug)}%` }} /></div>
              {dossier.estimate ? <p className="ha-muted ha-sm">Estimativa de referência com base em {dossier.estimate.count} venda(s) comparável(is). Não é laudo.</p> : null}
              <label className="ha-label">Metodologia<textarea className="ha-input" rows={3} value={method} onChange={(e) => setMethod(e.target.value)} /></label>
              <div className="ha-callout"><Icon name="qr_code_2" /><div>Laudo assinado · PDF com QR para a página pública{manage && heldByOther ? ` · assinado por você em nome da equipe, não por ${sel.assignedName}` : ''}</div></div>
              <div className="ha-row ha-row--end"><button type="button" className="ha-btn ha-btn--primary ha-btn--md" onClick={issue} disabled={busy || !mayIssue}>Assinar e emitir laudo</button></div>
            </fieldset>
          )}
        </section>
      ) : <section className="ha-stack"><p className="ha-muted">Selecione um pedido da fila.</p></section>}
      <Modal open={cancelOpen} title="Cancelar pedido de laudo" onClose={() => { if (!busy) setCancelOpen(false) }} footer={<><button type="button" className="ha-btn ha-btn--ghost ha-btn--md" onClick={() => setCancelOpen(false)} disabled={busy}>Voltar</button><button type="button" className="ha-btn ha-btn--primary ha-btn--md" onClick={cancel} disabled={busy || !note.trim()}>Cancelar pedido</button></>}>
        <p>Quem pediu recebe o aviso e o valor pago é estornado pelo mesmo meio; se o estorno não sair, a auditoria marca o pedido para o financeiro.</p>
        <label className="ha-adesk__field">Motivo<textarea className="ha-input" rows={3} maxLength={CANCEL_NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        {err ? <p className="ha-adesk__err" role="alert">{err}</p> : null}
      </Modal>
      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  )
}
