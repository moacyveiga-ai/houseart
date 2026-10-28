'use client'
// Admin › Negócios: the filters as links, one row per deal (who, what, phase, guarantee, total) that
// opens to the split lines with the payout state; "Tentar de novo" calls the retry the sellers already
// have (POST /api/deals/[id]/payout/retry, the team by its total scope) and "Marcar como pago" records
// a Pix made by hand (POST /api/admin/deals/[id]/splits/[splitId]/paid, with a note).
import { useState } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { Badge, type BadgeTone } from '@/components/ds/Badge'
import { Modal } from '@/components/ds/Modal'
import { Toast } from '@/components/ds/Toast'
import { formatBRL } from '@/lib/artworks/domain'
import { dataBR } from '@/lib/timezone'
import { canMarkPaid, exceptionLabel, isOwed, MANUAL_NOTE_MAX, type AdminDealRow, type AdminSplitLine, type DealFilter } from '@/lib/admin-deals/core'
import { Button } from '@/components/ds/Button'

const brl = (cents: string) => formatBRL(BigInt(cents))
const SELLER_KIND: Record<string, string> = { ARTIST: 'artista', GALLERY_STAFF: 'galeria', ADVISOR: 'consultor', COLLECTOR: 'colecionador' }
const PAYOUT_TONE: Record<AdminSplitLine['payoutState'], BadgeTone> = { PLATFORM: 'soft', HELD: 'neutral', STRIPE_PAID: 'verified', MANUAL_PAID: 'verified', PENDING: 'pending', FAILED: 'alert', AWAITING_ACCOUNT: 'pending', MANUAL: 'ink' }

export function DealsAdmin({ rows: initial, filter, filters, openId = null }: { rows: AdminDealRow[]; filter: DealFilter; filters: { key: DealFilter; label: string; count: number }[]; openId?: number | null }) {
  const [rows, setRows] = useState(initial)
  const [open, setOpen] = useState<number | null>(openId)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const [paying, setPaying] = useState<{ deal: AdminDealRow; line: AdminSplitLine } | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  async function retry(d: AdminDealRow) {
    setBusy(`r${d.id}`)
    const res = await fetch(`/api/deals/${d.id}/payout/retry`, { method: 'POST' }).catch(() => null)
    const data = (await res?.json().catch(() => ({}))) as { paid?: number; error?: string } | undefined
    setBusy(null)
    if (!res?.ok) { setToast(data?.error ?? 'Não foi possível repassar agora.'); return }
    setToast(data?.paid ? `${data.paid} ${data.paid === 1 ? 'repasse feito' : 'repasses feitos'} pela Stripe` : 'Nada a repassar pela Stripe agora: quem não conectou a conta recebe por Pix')
    window.location.reload()
  }

  async function confirmPaid() {
    if (!paying) return
    setBusy(`p${paying.line.id}`); setError('')
    const res = await fetch(`/api/admin/deals/${paying.deal.id}/splits/${paying.line.id}/paid`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ note }) }).catch(() => null)
    const data = (await res?.json().catch(() => ({}))) as { amount?: string; error?: string } | undefined
    setBusy(null)
    if (!res?.ok) { setError(data?.error ?? 'Não foi possível registrar.'); return }
    const { deal, line } = paying
    setRows((xs) => xs.map((d) => (d.id !== deal.id ? d : { ...d, splits: d.splits.map((s) => (s.id !== line.id ? s : { ...s, status: 'PAID', payoutState: 'MANUAL_PAID', payoutLabel: `pago por Pix · ${note.trim().slice(0, MANUAL_NOTE_MAX)}`, payoutError: null, stripePays: false })) })))
    setPaying(null); setNote('')
    setToast(`${data?.amount ?? brl(line.amountCents)} registrado como pago a ${line.payee ?? line.label}`)
  }

  return (
    <div className="ha-adeals">
      <nav className="ha-adeals__filters" aria-label="Filtros">
        {filters.map((f) => <Link key={f.key} href={`/admin/deals?f=${f.key}`} className={`ha-chip${f.key === filter ? ' ha-chip--on' : ''}`} aria-current={f.key === filter ? 'page' : undefined}>{f.label} · {f.count}</Link>)}
      </nav>
      <div className="ha-adeals__list">
        {rows.length === 0 ? <p className="ha-empty">Nenhum negócio neste filtro.</p> : null}
        {rows.map((d) => {
          const ab = open === d.id
          const failed = d.splits.some((s) => s.payoutState === 'FAILED')
          const released = d.splits.filter(isOwed)
          const tone: BadgeTone = d.exception === 'CANCELLED' ? 'neutral' : d.exception === 'DISPUTE' ? 'alert' : d.phase === 'COMPLETED' ? 'verified' : 'pending'
          return (
            <article key={d.id} className={`ha-adeals__row${ab ? ' ha-adeals__row--open' : ''}`}>
              <button type="button" className="ha-adeals__head" aria-expanded={ab} onClick={() => setOpen(ab ? null : d.id)}>
                <span className="ha-adeals__code">{d.code}<span className="ha-adeals__when">{dataBR(d.createdAt)}</span></span>
                <span className="ha-adeals__what"><b>{d.artworkTitle}</b><span className="ha-adeals__sub">{d.artist} · vendida por {d.seller} ({SELLER_KIND[d.sellerKind] ?? d.sellerKind}) a {d.buyer} · {d.market === 'SECONDARY' ? 'secundário' : 'primário'}</span></span>
                <span className="ha-adeals__state">
                  <Badge tone={tone}>{exceptionLabel(d.exception) ?? d.phaseLabel}</Badge>
                  <span className={`ha-adeals__escrow ha-adeals__escrow--${d.escrow.state.toLowerCase()}`}><Icon name={d.escrow.state === 'PAID' ? 'lock' : d.escrow.state === 'PENDING' ? 'hourglass_top' : 'lock_open'} size={16} />{d.escrow.label}</span>
                  {failed ? <span className="ha-adeals__flag"><Icon name="error" size={16} />repasse com falha</span> : released.length ? <span className="ha-adeals__flag ha-adeals__flag--soft"><Icon name="payments" size={16} />{released.length} {released.length === 1 ? 'repasse a fazer' : 'repasses a fazer'}</span> : null}
                </span>
                <span className="ha-adeals__total">{brl(d.totalCents)}</span>
                <Icon name={ab ? 'expand_less' : 'expand_more'} size={22} />
              </button>
              {ab ? (
                <div className="ha-adeals__body">
                  <div className="ha-adeals__meta">
                    <span>Obra <Link href={`/artworks?open=${d.artworkId}`} className="ha-link">{d.artworkTitle}</Link></span>
                    <span>Valor da obra {brl(d.amountCents)} · total com frete e seguro {brl(d.totalCents)}</span>
                    {d.completedAt ? <span>Concluído em {dataBR(d.completedAt)}</span> : null}
                  </div>
                  <table className="ha-adeals__splits">
                    <thead><tr><th>Parte</th><th>Quem recebe</th><th>Valor</th><th>Repasse</th><th /></tr></thead>
                    <tbody>
                      {d.splits.map((s) => (
                        <tr key={s.id}>
                          <td>{s.label}</td>
                          <td>{s.payee ?? (s.payoutState === 'PLATFORM' ? 'HouseArt' : '—')}</td>
                          <td className="ha-adeals__num">{brl(s.amountCents)}</td>
                          <td><Badge tone={PAYOUT_TONE[s.payoutState]}>{s.payoutLabel || 'da casa'}</Badge>{s.payoutError ? <span className="ha-adeals__err"> · {s.payoutError}</span> : null}</td>
                          <td className="ha-adeals__act">{canMarkPaid(s) ? <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" disabled={busy !== null} onClick={() => { setPaying({ deal: d, line: s }); setNote(''); setError('') }}>Marcar como pago</button> : null}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {d.phase === 'COMPLETED' && d.exception !== 'CANCELLED' && released.length ? (
                    <div className="ha-row" style={{ gap: 8 }}>
                      <Button variant="primary" size="sm" icon="refresh" loading={busy === `r${d.id}`} disabled={busy !== null} onClick={() => retry(d)}>Tentar de novo pela Stripe</Button>
                      <span className="ha-muted ha-sm">Paga agora as linhas liberadas de quem tem a conta Stripe ativa; as outras ficam para o Pix manual.</span>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          )
        })}
      </div>

      <Modal open={!!paying} title="Marcar repasse como pago" onClose={() => (busy ? null : setPaying(null))}>
        {paying ? (
          <div className="ha-stack" style={{ gap: 12 }}>
            <p className="ha-sm">{brl(paying.line.amountCents)} · {paying.line.label} de {paying.deal.code}{paying.line.payee ? ` · ${paying.line.payee}` : ''}. Registre só depois de o Pix ter saído da conta da HouseArt.</p>
            <label className="ha-adeals__field">Como foi pago<input className="ha-input" value={note} maxLength={MANUAL_NOTE_MAX} placeholder="Ex.: Pix 26/10 · comprovante 1234" onChange={(e) => setNote(e.target.value)} /></label>
            {error ? <p className="ha-adeals__err" role="alert">{error}</p> : null}
            <div className="ha-row" style={{ gap: 8 }}>
              <button type="button" className="ha-btn ha-btn--outline ha-btn--md" onClick={() => setPaying(null)}>Cancelar</button>
              <Button variant="primary" size="md" disabled={busy !== null || !note.trim()} onClick={confirmPaid} loading={busy !== null}>{busy ? 'Registrando…' : 'Registrar pagamento'}</Button>
            </div>
          </div>
        ) : null}
      </Modal>
      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  )
}
