'use client'
// Admin › Usuários e contas: filters as links, one row per account (who, login profile, product
// profiles, member and KYC, state, last sign-in) that opens to the actions the server allows for
// this viewer: block/unblock, staff role, password link, team invite — every one through
// POST /api/admin/users/[id] with a confirmation.
import { useState } from 'react'
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { Badge, type BadgeTone } from '@/components/ds/Badge'
import { Modal } from '@/components/ds/Modal'
import { Toast } from '@/components/ds/Toast'
import { dataBR } from '@/lib/timezone'
import { ACCOUNT_STATE_LABELS, KYC_LABELS, MEMBER_KIND_LABELS, MEMBER_STATUS_LABELS, PROFILE_KIND_LABELS, STAFF_PROFILE_OPTIONS, LOGIN_PROFILE_LABELS, type AdminUserRow, type UserFilter } from '@/lib/admin-users/core'

type Pending = { row: AdminUserRow; action: 'block' | 'unblock' | 'reset' | 'invite' | 'profile'; profile?: string }
const STATE_TONE: Record<AdminUserRow['state'], BadgeTone> = { ACTIVE: 'verified', BLOCKED: 'alert', DELETION: 'pending' }
const KYC_TONE: Record<string, BadgeTone> = { APPROVED: 'verified', PENDING: 'pending', REJECTED: 'alert', EXPIRED: 'pending' }
const SOCIAL: Record<string, string> = { GOOGLE: 'Google', APPLE: 'Apple', FACEBOOK: 'Facebook', LINKEDIN: 'LinkedIn', MOCK: 'social (mock)' }

const TITLE: Record<Pending['action'], string> = { block: 'Bloquear conta', unblock: 'Desbloquear conta', reset: 'Enviar link de senha', invite: 'Reenviar convite', profile: 'Trocar o papel' }
function explain(p: Pending): string {
  switch (p.action) {
    case 'block': return `${p.row.name} perde o acesso agora: as sessões abertas são encerradas e a pessoa não consegue entrar até ser desbloqueada. Obras, negócios e escrituras ficam como estão.`
    case 'unblock': return `${p.row.name} volta a poder entrar com a senha de sempre.`
    case 'reset': return `${p.row.email} recebe o mesmo e-mail de "Esqueci minha senha", com um link que vale 1 hora. A senha atual continua válida até a pessoa trocar.`
    case 'invite': return `${p.row.email} recebe de novo o convite para a equipe de ${p.row.pendingInvite?.gallery ?? 'galeria'}, com link novo (o anterior deixa de valer) por 7 dias.`
    case 'profile': return `${p.row.name} passa de ${LOGIN_PROFILE_LABELS[p.row.profile] ?? p.row.profile} a ${LOGIN_PROFILE_LABELS[p.profile ?? ''] ?? p.profile}. As sessões abertas são encerradas; o novo alcance vale no próximo login.`
  }
}

export function UsersAdmin({ rows: initial, filter, filters, query, viewerId }: { rows: AdminUserRow[]; filter: UserFilter; filters: { key: UserFilter; label: string; count: number }[]; query: string; viewerId: number }) {
  const [rows, setRows] = useState(initial)
  const [open, setOpen] = useState<number | null>(null)
  const [pending, setPending] = useState<Pending | null>(null)
  const [pick, setPick] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const href = (f: UserFilter) => `/admin/users?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(f !== 'all' ? { f } : {}) })}`

  async function confirm() {
    if (!pending) return
    setBusy(true); setError('')
    const { row, action, profile } = pending
    const res = await fetch(`/api/admin/users/${row.id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, profile }) }).catch(() => null)
    const data = (await res?.json().catch(() => ({}))) as { error?: string; active?: boolean; profile?: string; gallery?: string } | undefined
    setBusy(false)
    if (!res?.ok) { setError(data?.error ?? 'Não foi possível concluir.'); return }
    setPending(null)
    if (action === 'block' || action === 'unblock') {
      const active = action === 'unblock'
      setRows((xs) => xs.map((r) => (r.id !== row.id ? r : { ...r, active, state: active ? (r.state === 'BLOCKED' ? 'ACTIVE' : r.state) : 'BLOCKED', can: { ...r.can, reset: active && r.can.reset } })))
      setToast(active ? `${row.name} desbloqueada` : `${row.name} bloqueada e sessões encerradas`)
    } else if (action === 'profile') {
      setRows((xs) => xs.map((r) => (r.id !== row.id ? r : { ...r, profile: data?.profile ?? r.profile, profileLabel: LOGIN_PROFILE_LABELS[data?.profile ?? r.profile] ?? r.profile })))
      setToast(`${row.name} agora é ${LOGIN_PROFILE_LABELS[data?.profile ?? ''] ?? data?.profile}`)
    } else if (action === 'reset') setToast(`Link de senha enviado a ${row.email}`)
    else setToast(`Convite reenviado a ${row.email}`)
  }

  return (
    <div className="ha-ausers">
      <nav className="ha-ausers__filters" aria-label="Filtros">
        {filters.map((f) => <Link key={f.key} href={href(f.key)} className={`ha-chip${f.key === filter ? ' ha-chip--on' : ''}`} aria-current={f.key === filter ? 'page' : undefined}>{f.label} · {f.count}</Link>)}
      </nav>
      <div className="ha-ausers__list">
        {rows.length === 0 ? <p className="ha-muted ha-sm">Nenhuma conta neste filtro.</p> : null}
        {rows.map((r) => {
          const ab = open === r.id
          const me = r.id === viewerId
          return (
            <article key={r.id} className="ha-ausers__row">
              <button type="button" className="ha-ausers__head" aria-expanded={ab} onClick={() => setOpen(ab ? null : r.id)}>
                <span className="ha-ausers__who"><b>{r.name}{me ? <span className="ha-muted"> · você</span> : null}</b><span className="ha-ausers__sub">{r.email} · #{r.id}</span></span>
                <span className="ha-ausers__kinds">
                  <Badge tone="ink">{r.profileLabel}</Badge>
                  {r.kinds.map((k) => <Badge key={k} tone="soft">{PROFILE_KIND_LABELS[k] ?? k}</Badge>)}
                  {r.member ? <span className="ha-ausers__member">{MEMBER_KIND_LABELS[r.member.kind] ?? r.member.kind} · {r.member.tenant}{r.member.status !== 'ACTIVE' ? ` · ${MEMBER_STATUS_LABELS[r.member.status] ?? r.member.status}` : ''}</span> : null}
                </span>
                <span className="ha-ausers__state">
                  <Badge tone={STATE_TONE[r.state]}>{ACCOUNT_STATE_LABELS[r.state]}</Badge>
                  {r.kyc ? <Badge tone={KYC_TONE[r.kyc] ?? 'neutral'}>{KYC_LABELS[r.kyc] ?? r.kyc}</Badge> : null}
                  {!r.emailVerified ? <span className="ha-ausers__flag"><Icon name="mark_email_unread" size={16} />e-mail não confirmado</span> : null}
                  {r.pendingInvite ? <span className="ha-ausers__flag ha-ausers__flag--soft"><Icon name="mail" size={16} />convite pendente</span> : null}
                </span>
                <span className="ha-ausers__when">{r.lastLoginAt ? `entrou ${dataBR(r.lastLoginAt)}` : 'nunca entrou'}<span className="ha-ausers__sub">desde {dataBR(r.createdAt)}</span></span>
                <Icon name={ab ? 'expand_less' : 'expand_more'} size={22} />
              </button>
              {ab ? (
                <div className="ha-ausers__body">
                  <dl className="ha-ausers__facts">
                    <div><dt>Entrada</dt><dd>{[r.hasPassword ? 'senha' : null, ...r.socialLogins.map((s) => SOCIAL[s] ?? s), r.phoneVerified ? 'celular confirmado' : null].filter(Boolean).join(' · ') || 'só por código no e-mail'}</dd></div>
                    {r.member ? <div><dt>Membro</dt><dd>{MEMBER_KIND_LABELS[r.member.kind] ?? r.member.kind} de {r.member.tenant} · {MEMBER_STATUS_LABELS[r.member.status] ?? r.member.status}{r.member.role ? ` · ${r.member.role}` : ''}</dd></div> : null}
                    {r.pendingInvite ? <div><dt>Convite</dt><dd>equipe de {r.pendingInvite.gallery} · {r.pendingInvite.role} · vale até {dataBR(r.pendingInvite.expiresAt)}</dd></div> : null}
                    {r.state === 'DELETION' ? <div><dt>Exclusão</dt><dd>pedida pela pessoa; a conta é encerrada pelo atendimento</dd></div> : null}
                  </dl>
                  <div className="ha-ausers__actions">
                    {r.can.block ? <button type="button" className={`ha-btn ha-btn--sm ${r.active ? 'ha-btn--outline' : 'ha-btn--primary'}`} onClick={() => { setError(''); setPending({ row: r, action: r.active ? 'block' : 'unblock' }) }}><Icon name={r.active ? 'block' : 'lock_open'} size={18} />{r.active ? 'Bloquear' : 'Desbloquear'}</button> : null}
                    {r.can.reset ? <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" onClick={() => { setError(''); setPending({ row: r, action: 'reset' }) }}><Icon name="key" size={18} />Enviar link de senha</button> : null}
                    {r.can.invite ? <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" onClick={() => { setError(''); setPending({ row: r, action: 'invite' }) }}><Icon name="forward_to_inbox" size={18} />Reenviar convite</button> : null}
                    {r.can.profile ? (
                      <span className="ha-ausers__role">
                        <select className="ha-select ha-select--sm" aria-label="Papel na equipe" value={pick[r.id] ?? r.profile} onChange={(e) => setPick((p) => ({ ...p, [r.id]: e.target.value }))}>
                          {STAFF_PROFILE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                        <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" disabled={(pick[r.id] ?? r.profile) === r.profile} onClick={() => { setError(''); setPending({ row: r, action: 'profile', profile: pick[r.id] }) }}>Trocar papel</button>
                      </span>
                    ) : null}
                    {!r.can.block && !r.can.reset && !r.can.invite && !r.can.profile ? <span className="ha-muted ha-sm">{me ? 'A própria conta se edita em Conta.' : r.state === 'DELETION' ? 'A pessoa pediu a exclusão: a conta é encerrada pelo atendimento, não reaberta aqui.' : 'Esta conta está acima do seu papel: nada a fazer aqui.'}</span> : null}
                  </div>
                </div>
              ) : null}
            </article>
          )
        })}
      </div>

      <Modal open={!!pending} title={pending ? TITLE[pending.action] : ''} onClose={() => (busy ? null : setPending(null))}>
        {pending ? (
          <div className="ha-stack" style={{ gap: 12 }}>
            <p className="ha-sm">{explain(pending)}</p>
            {error ? <p className="ha-ausers__err" role="alert">{error}</p> : null}
            <div className="ha-row" style={{ gap: 8 }}>
              <button type="button" className="ha-btn ha-btn--outline ha-btn--md" onClick={() => setPending(null)} disabled={busy}>Cancelar</button>
              <button type="button" className={`ha-btn ha-btn--md ${pending.action === 'block' ? 'ha-btn--danger' : 'ha-btn--primary'}`} disabled={busy} onClick={confirm}>{busy ? 'Aguarde…' : TITLE[pending.action]}</button>
            </div>
          </div>
        ) : null}
      </Modal>
      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  )
}
