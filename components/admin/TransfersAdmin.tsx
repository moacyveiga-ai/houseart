'use client'
// Admin › Transferências: filters as links, one row per off-platform transfer (artwork, seller →
// buyer, step, what it waits for, days in the step) that opens to the facts and, for admin and
// manager, the actions — resend the buyer's invite, cancel with a note — through
// POST /api/admin/transfers/[id] with a confirmation. The tap is never supplied here.
import { useState } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { Badge, type BadgeTone } from '@/components/ds/Badge'
import { Modal } from '@/components/ds/Modal'
import { Toast } from '@/components/ds/Toast'
import { dataBR } from '@/lib/timezone'
import { formatBRL } from '@/lib/artworks/domain'
import { NOTE_MAX, STATUS_LABELS, WAITING_LABELS, type AdminTransferRow, type TransferFilter, type WaitingFor } from '@/lib/admin-transfers/core'

type Action = 'resend' | 'cancel' | 'refund'
type Pending = { row: AdminTransferRow; action: Action }
const WAIT_TONE: Record<WaitingFor, BadgeTone> = { BUYER_ACCEPT: 'pending', KYC: 'alert', KYC_REJECTED: 'alert', BUYER_SIGNATURE: 'pending', SELLER_SIGNATURE: 'pending', FEE: 'ink', TAP: 'ink', DONE: 'verified', CANCELLED: 'neutral' }
const TITLE: Record<Action, string> = { resend: 'Reenviar o convite', cancel: 'Cancelar transferência', refund: 'Tentar estornar de novo' }
function explain(p: Pending): string {
  switch (p.action) {
    case 'resend': return `${p.row.buyer.email} recebe de novo o convite para “${p.row.artworkTitle}”, com link novo; o anterior deixa de valer.`
    case 'refund': return `A taxa de ${formatBRL(BigInt(p.row.feeCents))} paga por ${p.row.seller.name} é estornada pela Stripe pelo mesmo meio de pagamento. Se a Stripe recusar de novo, o estorno sai pelo painel da Stripe.`
    case 'cancel': return `A transferência de “${p.row.artworkTitle}” de ${p.row.seller.name} para ${p.row.buyer.name} é encerrada: a escritura fica com o titular atual e o convite deixa de valer.${p.row.feePaidAt ? ' A taxa paga é estornada pelo mesmo meio; se o estorno não sair, a auditoria marca para o financeiro.' : ''} Os dois lados são avisados; o motivo vai à auditoria.`
  }
}

export function TransfersAdmin({ rows: initial, filter, filters, manages }: { rows: AdminTransferRow[]; filter: TransferFilter; filters: { key: TransferFilter; label: string; count: number }[]; manages: boolean }) {
  const [rows, setRows] = useState(initial)
  const [open, setOpen] = useState<number | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  async function confirm() {
    if (!pending) return
    setBusy(true); setError('')
    const { row, action } = pending
    const res = await fetch(`/api/admin/transfers/${row.id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, note }) }).catch(() => null)
    const data = (await res?.json().catch(() => ({}))) as { error?: string; refunded?: boolean; refundPending?: boolean } | undefined
    setBusy(false)
    if (!res?.ok) { setError(data?.error ?? 'Não foi possível concluir.'); return }
    if (action === 'cancel') setRows((xs) => xs.map((r) => (r.id !== row.id ? r : { ...r, status: 'CANCELLED', statusLabel: STATUS_LABELS.CANCELLED, waiting: 'CANCELLED' as const, waitingLabel: WAITING_LABELS.CANCELLED, stuck: false, feeRefundPending: !!data?.refundPending, can: { resend: false, cancel: false, refund: !!data?.refundPending } })))
    if (action === 'refund') setRows((xs) => xs.map((r) => (r.id !== row.id ? r : { ...r, feeRefundPending: false, can: { ...r.can, refund: false } })))
    setPending(null); setNote('')
    setToast(action === 'resend' ? `Convite reenviado a ${row.buyer.email}` : action === 'refund' ? 'Taxa estornada' : data?.refunded ? 'Transferência cancelada · taxa estornada' : data?.refundPending ? 'Transferência cancelada · o estorno não saiu: fica para o financeiro' : 'Transferência cancelada')
  }

  return (
    <div className="ha-atransfers">
      <nav className="ha-atransfers__filters" aria-label="Filtros">
        {filters.map((f) => <Link key={f.key} href={`/admin/transfers?f=${f.key}`} className={`ha-chip${f.key === filter ? ' ha-chip--on' : ''}`} aria-current={f.key === filter ? 'page' : undefined}>{f.label} · {f.count}</Link>)}
      </nav>
      {!manages ? <p className="ha-muted ha-sm">Só admin e gestor reenviam convite ou cancelam; aqui você acompanha.</p> : null}
      <div className="ha-atransfers__list">
        {rows.length === 0 ? <p className="ha-empty">Nenhuma transferência neste filtro.</p> : null}
        {rows.map((r) => {
          const isOpen = open === r.id
          return (
            <article key={r.id} className={`ha-atransfers__row${r.stuck ? ' ha-atransfers__row--stuck' : ''}`}>
              <button type="button" className="ha-atransfers__head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.id)}>
                <span className="ha-atransfers__who"><b>{r.artworkTitle}</b><span className="ha-atransfers__sub">{r.artworkPublicId ?? `obra ${r.artworkId}`} · #{r.id}</span></span>
                <span className="ha-atransfers__who"><span>{r.seller.name} <Icon name="arrow_forward" /> {r.buyer.name}</span><span className="ha-atransfers__sub">{r.priceSealed ? 'valor sigiloso' : r.priceCents ? formatBRL(BigInt(r.priceCents)) : 'sem valor'}{BigInt(r.royaltyCents) > 0n ? ` · sequência ${formatBRL(BigInt(r.royaltyCents))}` : ''}</span></span>
                <span className="ha-atransfers__state"><Badge tone={WAIT_TONE[r.waiting]}>{r.waiting === 'DONE' || r.waiting === 'CANCELLED' ? r.statusLabel : `Falta: ${r.waitingLabel}`}</Badge>{r.stuck ? <span className="ha-atransfers__flag"><Icon name="hourglass_top" /> {r.daysInStep} dias parada</span> : null}{r.feeRefundPending ? <span className="ha-atransfers__flag"><Icon name="paid" /> estorno pendente</span> : r.feePaidAt && r.status !== 'COMPLETED' && r.status !== 'CANCELLED' ? <span className="ha-atransfers__flag ha-atransfers__flag--soft"><Icon name="paid" /> taxa paga</span> : null}</span>
                <Icon name={isOpen ? 'expand_less' : 'expand_more'} />
              </button>
              {isOpen ? (
                <div className="ha-atransfers__body">
                  <dl className="ha-atransfers__dl">
                    <dt>Passo</dt><dd>{r.statusLabel} · há {r.daysInStep} {r.daysInStep === 1 ? 'dia' : 'dias'} · falta {r.waitingLabel}</dd>
                    <dt>Vendedor</dt><dd>{r.seller.name} · <Link href={`/admin/users?q=%23${r.seller.id}`} className="ha-link">conta #{r.seller.id}</Link>{r.sellerSignedAt ? ` · assinou em ${dataBR(r.sellerSignedAt)}` : ' · não assinou'}</dd>
                    <dt>Comprador</dt><dd>{r.buyer.name} · {r.buyer.email}{r.buyer.id ? <> · <Link href={`/admin/users?q=%23${r.buyer.id}`} className="ha-link">conta #{r.buyer.id}</Link></> : ' · ainda sem conta'}{r.buyerSignedAt ? ` · assinou em ${dataBR(r.buyerSignedAt)}` : ' · não assinou'}</dd>
                    <dt>Identidade</dt><dd>{r.kycStatus ? `KYC ${r.kycStatus === 'APPROVED' ? 'aprovado' : r.kycStatus === 'REJECTED' ? 'reprovado' : 'pendente'}` : 'ainda não verificada'}{r.kycWaiting ? <> · <Link href="/admin/kyc" className="ha-link">decidir em KYC</Link></> : null}</dd>
                    <dt>Taxa</dt><dd>{formatBRL(BigInt(r.feeCents))}{r.feePaidAt ? ` · paga em ${dataBR(r.feePaidAt)}` : ' · não paga'}{r.feeRefundPending ? ' · estorno não saiu' : ''}</dd>
                    <dt>Última mudança</dt><dd>{dataBR(r.updatedAt)}{r.completedAt ? ` · concluída em ${dataBR(r.completedAt)}` : ''}</dd>
                  </dl>
                  {r.waiting === 'KYC_REJECTED' ? <p className="ha-muted ha-sm">A identidade do comprador foi reprovada pela mesa: cancele, ou peça nova verificação em <Link href="/admin/kyc" className="ha-link">KYC</Link>.</p> : null}
                  {r.waiting === 'TAP' ? <p className="ha-muted ha-sm">O toque na etiqueta é do comprador, com a obra em mãos: a equipe não conclui por ele. Se a obra não chegou, o caminho é cancelar.</p> : null}
                  {manages && (r.can.resend || r.can.cancel || r.can.refund) ? (
                    <div className="ha-atransfers__actions">
                      {r.can.resend ? <button type="button" className="ha-btn ha-btn--secondary ha-btn--sm" onClick={() => setPending({ row: r, action: 'resend' })}>Reenviar convite</button> : null}
                      {r.can.cancel ? <button type="button" className="ha-btn ha-btn--ghost ha-btn--sm" onClick={() => setPending({ row: r, action: 'cancel' })}>Cancelar</button> : null}
                      {r.can.refund ? <button type="button" className="ha-btn ha-btn--secondary ha-btn--sm" onClick={() => setPending({ row: r, action: 'refund' })}>Tentar estornar de novo</button> : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
      <Modal open={!!pending} title={pending ? TITLE[pending.action] : ''} onClose={() => { if (!busy) { setPending(null); setNote(''); setError('') } }} footer={pending ? <><button type="button" className="ha-btn ha-btn--ghost ha-btn--md" onClick={() => { setPending(null); setNote('') }} disabled={busy}>Voltar</button><button type="button" className="ha-btn ha-btn--primary ha-btn--md" onClick={confirm} disabled={busy || (pending.action === 'cancel' && !note.trim())}>{TITLE[pending.action]}</button></> : null}>
        {pending ? <p>{explain(pending)}</p> : null}
        {pending?.action === 'cancel' ? <label className="ha-atransfers__field">Motivo<textarea className="ha-input" rows={3} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} /></label> : null}
        {error ? <p className="ha-atransfers__err" role="alert">{error}</p> : null}
      </Modal>
      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  )
}
