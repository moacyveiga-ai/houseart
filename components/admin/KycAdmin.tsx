'use client'
// Admin › KYC: filters as links, one row per verification (who, provider, score, PEP, state, dates,
// transfers waiting) and, for admin and manager, the decision — approve, reject with a note,
// revalidate — through POST /api/admin/kyc/[id] with a confirmation.
import { useState } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { Badge, type BadgeTone } from '@/components/ds/Badge'
import { Modal } from '@/components/ds/Modal'
import { Toast } from '@/components/ds/Toast'
import { dataBR } from '@/lib/timezone'
import { DECISION_NOTE_MAX, KYC_STATE_LABELS, type AdminKycRow, type KycFilter, type KycState } from '@/lib/admin-kyc/core'
import { Button } from '@/components/ds/Button'

type Action = 'approve' | 'reject' | 'revalidate'
type Pending = { row: AdminKycRow; action: Action }
const STATE_TONE: Record<KycState, BadgeTone> = { PENDING: 'pending', APPROVED: 'verified', EXPIRED: 'neutral', REJECTED: 'alert' }
const TITLE: Record<Action, string> = { approve: 'Aprovar identidade', reject: 'Reprovar identidade', revalidate: 'Pedir nova verificação' }
function explain(p: Pending): string {
  switch (p.action) {
    case 'approve': return `A identidade de ${p.row.name} fica aprovada por um ano.${p.row.waitingTransfers ? ` ${p.row.waitingTransfers === 1 ? 'A transferência que espera por ela segue' : `As ${p.row.waitingTransfers} transferências que esperam por ela seguem`}: a pessoa assina na próxima visita ao convite.` : ''}`
    case 'reject': return `${p.row.name} fica sem identidade aprovada${p.row.waitingTransfers ? ` e ${p.row.waitingTransfers === 1 ? 'a transferência que espera por ela' : `as ${p.row.waitingTransfers} transferências que esperam por ela`} passa${p.row.waitingTransfers === 1 ? '' : 'm'} a reprovada` : ''}. O motivo vai à auditoria; a pessoa pode verificar de novo.`
    case 'revalidate': return `A aprovação de ${p.row.name} vence agora: na próxima transferência a pessoa passa pela verificação de novo.`
  }
}

export function KycAdmin({ rows: initial, filter, filters, decides }: { rows: AdminKycRow[]; filter: KycFilter; filters: { key: KycFilter; label: string; count: number }[]; decides: boolean }) {
  const [rows, setRows] = useState(initial)
  const [pending, setPending] = useState<Pending | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  async function confirm() {
    if (!pending) return
    setBusy(true); setError('')
    const { row, action } = pending
    const res = await fetch(`/api/admin/kyc/${row.id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, note }) }).catch(() => null)
    const data = (await res?.json().catch(() => ({}))) as { error?: string; state?: KycState; expiresAt?: string; unblocked?: number } | undefined
    setBusy(false)
    if (!res?.ok) { setError(data?.error ?? 'Não foi possível concluir.'); return }
    const state = data?.state ?? row.state
    setRows((xs) => xs.map((r) => (r.id !== row.id ? r : { ...r, state, stateLabel: KYC_STATE_LABELS[state], expiresAt: action === 'approve' ? (data?.expiresAt ?? r.expiresAt) : action === 'revalidate' ? new Date().toISOString() : null, verifiedAt: action === 'approve' ? new Date().toISOString() : r.verifiedAt, waitingTransfers: action === 'approve' || action === 'reject' ? 0 : r.waitingTransfers, can: { approve: state !== 'APPROVED', reject: state !== 'REJECTED', revalidate: state === 'APPROVED' } })))
    setPending(null); setNote('')
    setToast(action === 'approve' ? `${row.name} aprovada${data?.unblocked ? ` · ${data.unblocked} ${data.unblocked === 1 ? 'transferência liberada' : 'transferências liberadas'}` : ''}` : action === 'reject' ? `${row.name} reprovada` : `${row.name} vai verificar de novo`)
  }

  return (
    <div className="ha-akyc">
      <nav className="ha-akyc__filters" aria-label="Filtros">
        {filters.map((f) => <Link key={f.key} href={`/admin/kyc?f=${f.key}`} className={`ha-chip${f.key === filter ? ' ha-chip--on' : ''}`} aria-current={f.key === filter ? 'page' : undefined}>{f.label} · {f.count}</Link>)}
      </nav>
      {!decides ? <p className="ha-muted ha-sm">Só admin e gestor decidem a identidade; aqui você acompanha a fila.</p> : null}
      <div className="ha-akyc__list">
        {rows.length === 0 ? <p className="ha-empty">Nenhuma verificação neste filtro.</p> : null}
        {rows.map((r) => (
          <article key={r.id} className={`ha-akyc__row${r.latest ? '' : ' ha-akyc__row--old'}`}>
            <div className="ha-akyc__who"><b>{r.name}</b><span className="ha-akyc__sub">{r.email} · <Link href={`/admin/users?q=%23${r.userId}`} className="ha-link">conta #{r.userId}</Link></span></div>
            <div className="ha-akyc__facts">
              <span>{r.providerLabel}{r.scoreBps !== null ? ` · biometria ${(r.scoreBps / 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : ''}{r.hasDocument ? ' · documento lido' : ' · sem documento'}</span>
              <span className="ha-akyc__sub">pedida {dataBR(r.createdAt)}{r.verifiedAt ? ` · aprovada ${dataBR(r.verifiedAt)}` : ''}{r.expiresAt ? ` · ${r.state === 'EXPIRED' ? 'venceu' : 'vence'} ${dataBR(r.expiresAt)}` : ''}{r.latest ? '' : ' · histórico'}</span>
            </div>
            <div className="ha-akyc__state">
              <Badge tone={STATE_TONE[r.state]}>{r.stateLabel}</Badge>
              {r.pepHit ? <span className="ha-akyc__flag"><Icon name="warning" size={16} />PEP</span> : null}
              {r.waitingTransfers && r.state === 'PENDING' ? <span className="ha-akyc__flag ha-akyc__flag--soft"><Icon name="swap_horiz" size={16} />{r.waitingTransfers} {r.waitingTransfers === 1 ? 'transferência espera' : 'transferências esperam'}</span> : null}
            </div>
            <div className="ha-akyc__actions">
              {decides && r.can.approve ? <button type="button" className="ha-btn ha-btn--primary ha-btn--sm" onClick={() => { setError(''); setNote(''); setPending({ row: r, action: 'approve' }) }}><Icon name="verified_user" size={18} />Aprovar</button> : null}
              {decides && r.can.reject ? <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" onClick={() => { setError(''); setNote(''); setPending({ row: r, action: 'reject' }) }}><Icon name="gpp_bad" size={18} />Reprovar</button> : null}
              {decides && r.can.revalidate ? <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" onClick={() => { setError(''); setNote(''); setPending({ row: r, action: 'revalidate' }) }}><Icon name="restart_alt" size={18} />Nova verificação</button> : null}
            </div>
          </article>
        ))}
      </div>

      <Modal open={!!pending} title={pending ? TITLE[pending.action] : ''} onClose={() => (busy ? null : setPending(null))}>
        {pending ? (
          <div className="ha-stack" style={{ gap: 12 }}>
            <p className="ha-sm">{explain(pending)}</p>
            <label className="ha-akyc__field">{pending.action === 'reject' ? 'Motivo (obrigatório)' : 'Observação (opcional)'}<input className="ha-input" value={note} maxLength={DECISION_NOTE_MAX} placeholder={pending.action === 'reject' ? 'Ex.: documento ilegível, nome diverge do CPF' : 'Ex.: conferido pelo atendimento'} onChange={(e) => setNote(e.target.value)} /></label>
            {error ? <p className="ha-akyc__err" role="alert">{error}</p> : null}
            <div className="ha-row" style={{ gap: 8 }}>
              <button type="button" className="ha-btn ha-btn--outline ha-btn--md" onClick={() => setPending(null)} disabled={busy}>Cancelar</button>
              <Button variant={pending.action === 'reject' ? 'danger' : 'primary'} size="md" loading={busy} disabled={pending.action === 'reject' && !note.trim()} onClick={confirm}>{TITLE[pending.action]}</Button>
            </div>
          </div>
        ) : null}
      </Modal>
      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  )
}
