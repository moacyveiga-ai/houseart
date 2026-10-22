'use client'
// Equipe (handoff "HouseArt App Galeria" › Conta › Equipe, `lsItens`): one row per
// person (initials, name, role line, tag) and "Convidar pessoa". A member opens the
// role sheet (Admin · Vendas · Acervo + remove); an invite opens "Revogar convite".
// Only the tenant ADMIN writes — the others read the notice (403 from the API too).
import { useCallback, useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Modal } from '@/components/ds/Modal'
import { Toast } from '@/components/ds/Toast'
import { Field, SelectField } from '@/components/ds/Field'
import { Button } from '@/components/ds/Button'
import { initialsOf } from '@/lib/profiles/core'
import { TEAM_ROLES, TEAM_ROLE_LABELS, type TeamRole } from '@/lib/gallery/domain'
import type { TeamPerson } from '@/lib/gallery/team-server'

const NO_PERMISSION = 'Só o administrador da galeria gere a equipe.'
type Reply = { ok?: boolean; people?: TeamPerson[]; error?: string }

export function TeamScreen({ people: initial, canManage }: { people: TeamPerson[]; canManage: boolean }) {
  const [people, setPeople] = useState(initial)
  const [open, setOpen] = useState<TeamPerson | null>(null)
  const [confirm, setConfirm] = useState<'remove' | 'revoke' | null>(null)
  const [inviting, setInviting] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<TeamRole>('SALES')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [denied, setDenied] = useState(!canManage)
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])

  async function call(url: string, init: RequestInit, done: string): Promise<boolean> {
    setBusy(true)
    const res = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...(init.headers ?? {}) } })
    const data = await res.json().catch(() => ({})) as Reply
    setBusy(false)
    if (res.status === 403) { setDenied(true); setToast(NO_PERMISSION); return false }
    if (!res.ok) { setToast(data.error ?? 'Não foi possível concluir.'); return false }
    if (data.people) setPeople(data.people)
    setToast(done)
    return true
  }

  function openPerson(p: TeamPerson) { if (denied) { setToast(NO_PERMISSION); return } setOpen(p); setConfirm(null) }
  function close() { setOpen(null); setConfirm(null) }

  async function changeRole(next: TeamRole) {
    if (!open || open.kind !== 'MEMBER' || open.role === next) return
    if (await call(`/api/gallery/team/${open.id}`, { method: 'PATCH', body: JSON.stringify({ role: next }) }, `${open.name.split(' ')[0]} agora é ${TEAM_ROLE_LABELS[next].name}`)) close()
  }
  async function remove() {
    if (!open) return
    const ok = open.kind === 'MEMBER'
      ? await call(`/api/gallery/team/${open.id}`, { method: 'DELETE' }, `${open.name} saiu da equipe`)
      : await call(`/api/gallery/team/invites/${open.id}`, { method: 'DELETE' }, 'Convite revogado')
    if (ok) close()
  }
  async function sendInvite() {
    const v = email.trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { setError('Informe um e-mail válido.'); return }
    setError('')
    if (await call('/api/gallery/team', { method: 'POST', body: JSON.stringify({ email: v, role }) }, 'Convite enviado por e-mail')) { setInviting(false); setEmail(''); setRole('SALES') }
  }

  const tagTone = (p: TeamPerson) => p.kind === 'INVITE' ? 'ha-team-tag--pending' : p.role === 'ADMIN' ? 'ha-team-tag--admin' : ''

  return (
    <div className="ha-team">
      <p className="ha-team__sub">Cada pessoa vê só o que o papel permite.</p>
      {denied ? <div className="ha-callout"><Icon name="lock" size={20} /><p className="ha-sm" style={{ margin: 0 }}>{NO_PERMISSION}</p></div> : null}
      <ul className="ha-team-list">
        {people.map((p) => (
          <li key={`${p.kind}-${p.id}`}>
            <button type="button" className="ha-team-row" onClick={() => openPerson(p)} aria-haspopup="dialog">
              <span className={`ha-team-av${p.kind === 'INVITE' ? ' ha-team-av--pending' : p.role === 'ADMIN' ? ' ha-team-av--admin' : ''}`}>{p.kind === 'INVITE' ? initialsOf(p.name.split('@')[0].replace(/[._-]+/g, ' ')) : initialsOf(p.name)}</span>
              <span className="ha-stack ha-team-row__txt">
                <span className="ha-team-row__n">{p.name}{p.isSelf ? <span className="ha-team-row__me"> · você</span> : null}</span>
                <span className="ha-team-row__s">{p.sub}</span>
              </span>
              <span className={`ha-team-tag ${tagTone(p)}`}>{p.roleLabel}</span>
            </button>
          </li>
        ))}
        {people.length === 0 ? <li className="ha-team-empty">Ninguém na equipe ainda.</li> : null}
      </ul>
      <div className="ha-team-foot">
        <Button variant="ink" size="md" icon="add" className="ha-team-cta" onClick={() => { if (denied) { setToast(NO_PERMISSION); return } setInviting(true); setError('') }}>Convidar pessoa</Button>
      </div>

      <Modal open={!!open} title={open?.kind === 'INVITE' ? 'Convite pendente' : open?.name ?? ''} onClose={close}>
        {open?.kind === 'MEMBER' ? (
          confirm === 'remove' ? (
            <div className="ha-team-confirm">
              <p className="ha-sm" style={{ margin: 0 }}>{open.name} perde o acesso à galeria agora. As obras e vendas continuam com a galeria.</p>
              <div className="ha-team-confirm__btns">
                <Button variant="outline" size="sm" onClick={() => setConfirm(null)}>Voltar</Button>
                <button type="button" className="ha-team-danger" disabled={busy} onClick={remove}>Remover da equipe</button>
              </div>
            </div>
          ) : (
            <>
              <p className="ha-team-sheet__k">Papel na galeria</p>
              <div className="ha-team-roles" role="radiogroup" aria-label="Papel">
                {TEAM_ROLES.map((r) => (
                  <button key={r} type="button" role="radio" aria-checked={open.role === r} disabled={busy || open.isSelf} className={`ha-team-role${open.role === r ? ' ha-team-role--on' : ''}`} onClick={() => changeRole(r)}>
                    <span className="ha-stack"><span className="ha-team-role__n">{TEAM_ROLE_LABELS[r].name}</span><span className="ha-team-role__s">{TEAM_ROLE_LABELS[r].sub}</span></span>
                    {open.role === r ? <Icon name="check" size={18} /> : null}
                  </button>
                ))}
              </div>
              {open.isSelf ? <p className="ha-caption" style={{ margin: 0 }}>Você não muda o próprio papel nem sai da equipe por aqui — outro administrador faz isso.</p> : (
                <button type="button" className="ha-team-danger" onClick={() => setConfirm('remove')}>Remover da equipe</button>
              )}
            </>
          )
        ) : open ? (
          <>
            <p className="ha-sm" style={{ margin: 0 }}>{open.email} · papel {TEAM_ROLE_LABELS[open.role].name}. {open.sub}. Vale por 7 dias.</p>
            {confirm === 'revoke' ? (
              <div className="ha-team-confirm__btns">
                <Button variant="outline" size="sm" onClick={() => setConfirm(null)}>Voltar</Button>
                <button type="button" className="ha-team-danger" disabled={busy} onClick={remove}>Confirmar revogação</button>
              </div>
            ) : <button type="button" className="ha-team-danger" onClick={() => setConfirm('revoke')}>Revogar convite</button>}
          </>
        ) : null}
      </Modal>

      <Modal open={inviting} title="Convidar pessoa" onClose={() => setInviting(false)} footer={<><Button variant="outline" size="sm" onClick={() => setInviting(false)}>Cancelar</Button><Button variant="ink" size="sm" loading={busy} onClick={sendInvite}>Enviar convite</Button></>}>
        <Field label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@galeria.com.br" error={error || undefined} autoFocus />
        <SelectField label="Papel" value={role} onChange={(e) => setRole(e.target.value as TeamRole)} hint={TEAM_ROLE_LABELS[role].sub}>
          {TEAM_ROLES.map((r) => <option key={r} value={r}>{TEAM_ROLE_LABELS[r].name}</option>)}
        </SelectField>
        <p className="ha-caption" style={{ margin: 0 }}>A pessoa recebe um link por e-mail, entra (ou cria a conta com esse e-mail) e aceita em até 7 dias.</p>
      </Modal>
      <Toast message={toast} onDone={clearToast} />
    </div>
  )
}
