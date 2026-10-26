'use client'
// Admin › Galerias e contas: filters as links, one row per tenant (kind, state, plan, who runs
// it) that opens to the facts (team, contracts, inventory, legal identity as a mask) and, for
// admin and manager, the actions — courtesy plan, suspend with a note, reinstate — through
// POST /api/admin/tenants/[id] with a confirmation.
import { useState } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { Badge, type BadgeTone } from '@/components/ds/Badge'
import { Modal } from '@/components/ds/Modal'
import { Toast } from '@/components/ds/Toast'
import { dataBR } from '@/lib/timezone'
import { formatBRL } from '@/lib/artworks/domain'
import { NOTE_MAX, SUBSCRIPTION_LABELS, TENANT_STATUS_LABELS, type AdminTenantRow, type TenantFilter } from '@/lib/admin-tenants/core'
import type { PlanOption } from '@/lib/admin-tenants/server'

type Action = 'plan' | 'suspend' | 'reinstate'
type Pending = { row: AdminTenantRow; action: Action; code?: string }
const STATE_TONE: Record<string, BadgeTone> = { ACTIVE: 'verified', SUSPENDED: 'alert' }
const TITLE: Record<Action, string> = { plan: 'Conceder plano', suspend: 'Suspender conta', reinstate: 'Reativar conta' }
function explain(p: Pending, plans: PlanOption[]): string {
  switch (p.action) {
    case 'plan': { const pl = plans.find((x) => x.code === p.code); return `${p.row.name} passa ao plano ${pl?.name ?? p.code} por 30 dias sem cobrança e sem fatura: a assinatura atual é encerrada. O motivo vai à auditoria.` }
    case 'suspend': return `${p.row.name} perde o painel agora (as sessões das pessoas da conta são encerradas) e as obras saem do site público. Obras, negócios e escrituras ficam como estão. O motivo vai à auditoria.`
    case 'reinstate': return `${p.row.name} volta a entrar no painel e as obras anunciadas voltam ao site.`
  }
}

export function TenantsAdmin({ rows: initial, plans, filter, filters, query, manages }: { rows: AdminTenantRow[]; plans: PlanOption[]; filter: TenantFilter; filters: { key: TenantFilter; label: string; count: number }[]; query: string; manages: boolean }) {
  const [rows, setRows] = useState(initial)
  const [open, setOpen] = useState<number | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [pick, setPick] = useState<Record<number, string>>({})
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const href = (f: TenantFilter) => `/admin/tenants?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(f !== 'all' ? { f } : {}) })}`

  async function confirm() {
    if (!pending) return
    setBusy(true); setError('')
    const { row, action, code } = pending
    const res = await fetch(`/api/admin/tenants/${row.id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, code, note }) }).catch(() => null)
    const data = (await res?.json().catch(() => ({}))) as { error?: string; status?: string; code?: string; name?: string; periodEnd?: string; closedSessions?: number } | undefined
    setBusy(false)
    if (!res?.ok) { setError(data?.error ?? 'Não foi possível concluir.'); return }
    setRows((xs) => xs.map((r) => {
      if (r.id !== row.id) return r
      if (action === 'plan') { const pl = plans.find((x) => x.code === (data?.code ?? code)); return { ...r, plan: { code: data?.code ?? code ?? r.plan.code, name: data?.name ?? pl?.name ?? r.plan.name, priceCents: pl?.priceCents ?? r.plan.priceCents, subscription: 'ACTIVE', periodEnd: data?.periodEnd ?? null, paid: !!pl && BigInt(pl.priceCents) > 0n } } }
      const status = data?.status ?? (action === 'suspend' ? 'SUSPENDED' : 'ACTIVE')
      return { ...r, status, statusLabel: TENANT_STATUS_LABELS[status] ?? status, can: { plan: status === 'ACTIVE', suspend: status === 'ACTIVE', reinstate: status === 'SUSPENDED' } }
    }))
    setPending(null); setNote('')
    setToast(action === 'plan' ? `${row.name} · plano ${data?.name ?? code}` : action === 'suspend' ? `${row.name} suspensa${data?.closedSessions ? ` · ${data.closedSessions} ${data.closedSessions === 1 ? 'sessão encerrada' : 'sessões encerradas'}` : ''}` : `${row.name} reativada`)
  }

  return (
    <div className="ha-atenants">
      <nav className="ha-atenants__filters" aria-label="Filtros">
        {filters.map((f) => <Link key={f.key} href={href(f.key)} className={`ha-chip${f.key === filter ? ' ha-chip--on' : ''}`} aria-current={f.key === filter ? 'page' : undefined}>{f.label} · {f.count}</Link>)}
      </nav>
      {!manages ? <p className="ha-muted ha-sm">Só admin e gestor concedem plano ou suspendem; aqui você acompanha as contas.</p> : null}
      <div className="ha-atenants__list">
        {rows.length === 0 ? <p className="ha-muted ha-sm">Nenhuma conta neste filtro.</p> : null}
        {rows.map((r) => {
          const isOpen = open === r.id
          const options = plans.filter((p) => p.audience === r.audience)
          const chosen = pick[r.id] ?? ''
          return (
            <article key={r.id} className={`ha-atenants__row${r.status === 'SUSPENDED' ? ' ha-atenants__row--off' : ''}`}>
              <button type="button" className="ha-atenants__head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : r.id)}>
                <span className="ha-atenants__who"><b>{r.name}</b><span className="ha-atenants__sub">{r.kindLabel} · #{r.id} · /{r.slug}{r.cnpjMask ? ` · CNPJ ${r.cnpjMask}` : ''}</span></span>
                <span className="ha-atenants__facts">
                  <span>{r.kind === 'GALLERY' ? `${r.members.staff} na equipe · ${r.contracts} ${r.contracts === 1 ? 'artista representado' : 'artistas representados'}` : [r.members.artists ? 'artista' : null, r.members.advisors ? 'consultor' : null, r.members.collectors ? 'colecionador' : null].filter(Boolean).join(' · ') || 'sem membro'}</span>
                  <span className="ha-atenants__sub">{r.artworks} {r.artworks === 1 ? 'obra' : 'obras'} · {r.listed} à venda · {r.certificates} certificadas · {r.openDeals} {r.openDeals === 1 ? 'negócio aberto' : 'negócios abertos'}</span>
                </span>
                <span className="ha-atenants__plan"><span>{r.plan.name}{r.plan.paid ? ` · ${formatBRL(BigInt(r.plan.priceCents))}/mês` : ''}</span><span className="ha-atenants__sub">{SUBSCRIPTION_LABELS[r.plan.subscription]}{r.plan.periodEnd ? ` até ${dataBR(r.plan.periodEnd)}` : ''}</span></span>
                <span className="ha-atenants__state"><Badge tone={STATE_TONE[r.status] ?? 'neutral'}>{r.statusLabel}</Badge>{r.team.pendingInvites ? <span className="ha-atenants__flag ha-atenants__flag--soft"><Icon name="mail" /> {r.team.pendingInvites} {r.team.pendingInvites === 1 ? 'convite' : 'convites'}</span> : null}{r.members.pending ? <span className="ha-atenants__flag"><Icon name="hourglass_top" /> {r.members.pending} em análise</span> : null}</span>
                <Icon name={isOpen ? 'expand_less' : 'expand_more'} />
              </button>
              {isOpen ? (
                <div className="ha-atenants__body">
                  <dl className="ha-atenants__dl">
                    <dt>Quem administra</dt><dd>{r.admin ? <>{r.admin.name} · {r.admin.email} · <Link href={`/admin/users?q=%23${r.admin.id}`} className="ha-link">conta #{r.admin.id}</Link></> : 'sem administrador ativo'}</dd>
                    {r.kind === 'GALLERY' ? <><dt>Equipe</dt><dd>{r.team.admin} admin · {r.team.sales} vendas · {r.team.inventory} acervo{r.team.pendingInvites ? ` · ${r.team.pendingInvites} ${r.team.pendingInvites === 1 ? 'convite pendente' : 'convites pendentes'}` : ''}</dd></> : null}
                    {r.kind === 'GALLERY' ? <><dt>Razão social</dt><dd>{r.legalName ?? 'não informada'}{r.cnpjMask ? ` · CNPJ ${r.cnpjMask}` : ' · sem CNPJ'}</dd></> : null}
                    <dt>Membros</dt><dd>{r.members.artists} {r.members.artists === 1 ? 'artista' : 'artistas'} · {r.members.advisors} {r.members.advisors === 1 ? 'consultor' : 'consultores'} · {r.members.collectors} {r.members.collectors === 1 ? 'colecionador' : 'colecionadores'}{r.members.pending ? ` · ${r.members.pending} em análise` : ''}</dd>
                    <dt>Página pública</dt><dd>{r.publicSlug ? <a className="ha-link" href={`/e/gallery/${r.publicSlug}`} target="_blank" rel="noreferrer">/e/gallery/{r.publicSlug}</a> : 'sem página pública'}</dd>
                    <dt>Desde</dt><dd>{dataBR(r.createdAt)}</dd>
                  </dl>
                  {manages ? (
                    <div className="ha-atenants__actions">
                      {r.can.plan ? (
                        <span className="ha-atenants__role">
                          <select className="ha-input ha-select" aria-label="Plano" value={chosen} onChange={(e) => setPick((m) => ({ ...m, [r.id]: e.target.value }))}>
                            <option value="">Conceder plano…</option>
                            {options.map((p) => <option key={p.code} value={p.code} disabled={p.code === r.plan.code && r.plan.subscription === 'ACTIVE'}>{p.name}{BigInt(p.priceCents) > 0n ? ` · ${formatBRL(BigInt(p.priceCents))}/mês` : ' · grátis'}</option>)}
                          </select>
                          <button type="button" className="ha-btn ha-btn--secondary ha-btn--sm" disabled={!chosen} onClick={() => setPending({ row: r, action: 'plan', code: chosen })}>Conceder</button>
                        </span>
                      ) : null}
                      {r.can.suspend ? <button type="button" className="ha-btn ha-btn--ghost ha-btn--sm" onClick={() => setPending({ row: r, action: 'suspend' })}>Suspender</button> : null}
                      {r.can.reinstate ? <button type="button" className="ha-btn ha-btn--primary ha-btn--sm" onClick={() => setPending({ row: r, action: 'reinstate' })}>Reativar</button> : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          )
        })}
      </div>
      <Modal open={!!pending} title={pending ? TITLE[pending.action] : ''} onClose={() => { if (!busy) { setPending(null); setNote(''); setError('') } }} footer={pending ? <><button type="button" className="ha-btn ha-btn--ghost ha-btn--md" onClick={() => { setPending(null); setNote('') }} disabled={busy}>Voltar</button><button type="button" className="ha-btn ha-btn--primary ha-btn--md" onClick={confirm} disabled={busy || (pending.action !== 'reinstate' && !note.trim())}>{TITLE[pending.action]}</button></> : null}>
        {pending ? <p>{explain(pending, plans)}</p> : null}
        {pending && pending.action !== 'reinstate' ? <label className="ha-atenants__field">Motivo<textarea className="ha-input" rows={3} maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} /></label> : null}
        {error ? <p className="ha-atenants__err" role="alert">{error}</p> : null}
      </Modal>
      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  )
}
