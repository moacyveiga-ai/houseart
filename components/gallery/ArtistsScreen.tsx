'use client'
// Artistas representados (handoff "HouseArt App Galeria" › Conta › Artistas, `lsItens`):
// one row per artist (initials, name, works · contract line, tag), the contract sheet
// (kind, gallery share, validity, end representation) and "Convidar artista".
import { useCallback, useState } from 'react'
import { Modal } from '@/components/ds/Modal'
import { Toast } from '@/components/ds/Toast'
import { Field, SelectField } from '@/components/ds/Field'
import { Button } from '@/components/ds/Button'
import { initialsOf } from '@/lib/profiles/core'
import { CONTRACT_KINDS, CONTRACT_KIND_LABELS, type ContractKind } from '@/lib/gallery/domain'
import type { RepresentedArtist } from '@/lib/gallery/artists-server'

type Reply = { ok?: boolean; artists?: RepresentedArtist[]; error?: string }
const pctOf = (bps: number) => String(Math.round(bps / 100))
const bpsOf = (pct: string) => Math.round(Number(pct.replace(',', '.')) * 100)

interface Form { name: string; kind: ContractKind; pct: string; validUntil: string; email: string }
const EMPTY: Form = { name: '', kind: 'REPRESENTED', pct: '50', validUntil: '', email: '' }

export function ArtistsScreen({ artists: initial }: { artists: RepresentedArtist[] }) {
  const [artists, setArtists] = useState(initial)
  const [open, setOpen] = useState<RepresentedArtist | null>(null)
  const [edit, setEdit] = useState<{ kind: ContractKind; pct: string; validUntil: string }>({ kind: 'REPRESENTED', pct: '50', validUntil: '' })
  const [ending, setEnding] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [form, setForm] = useState<Form>(EMPTY)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])

  async function call(url: string, init: RequestInit, done: string): Promise<boolean> {
    setBusy(true)
    const res = await fetch(url, { ...init, headers: { 'content-type': 'application/json' } })
    const data = await res.json().catch(() => ({})) as Reply
    setBusy(false)
    if (!res.ok) { setToast(data.error ?? 'Não foi possível concluir.'); return false }
    if (data.artists) setArtists(data.artists)
    setToast(done)
    return true
  }

  function openArtist(a: RepresentedArtist) {
    setOpen(a); setEnding(false); setError('')
    setEdit({ kind: a.contract?.kind ?? 'REPRESENTED', pct: pctOf(a.contract?.galleryBps ?? 5000), validUntil: a.contract?.validUntil ?? '' })
  }
  const checkPct = (pct: string) => { const bps = bpsOf(pct); return Number.isFinite(bps) && bps >= 0 && bps <= 10000 }

  async function saveContract() {
    if (!open) return
    if (!checkPct(edit.pct)) { setError('A divisão da galeria fica entre 0 e 100 %.'); return }
    setError('')
    if (await call(`/api/gallery/artists/${open.id}`, { method: 'PATCH', body: JSON.stringify({ kind: edit.kind, galleryBps: bpsOf(edit.pct), validUntil: edit.validUntil || null }) }, `Contrato de ${open.name.split(' ')[0]} atualizado`)) setOpen(null)
  }
  async function endRepresentation() {
    if (!open) return
    if (await call(`/api/gallery/artists/${open.id}`, { method: 'DELETE' }, `Representação de ${open.name} encerrada`)) setOpen(null)
  }
  async function invite() {
    if (form.name.trim().length < 2) { setError('Informe o nome do artista.'); return }
    if (!checkPct(form.pct)) { setError('A divisão da galeria fica entre 0 e 100 %.'); return }
    const email = form.email.trim()
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setError('Informe um e-mail válido ou deixe em branco.'); return }
    setError('')
    const done = email ? 'Convite enviado · o artista cria a conta e aceita o contrato' : `${form.name.trim()} entrou nos artistas representados`
    if (await call('/api/gallery/artists', { method: 'POST', body: JSON.stringify({ name: form.name.trim(), kind: form.kind, galleryBps: bpsOf(form.pct), validUntil: form.validUntil || null, inviteEmail: email || null }) }, done)) { setInviting(false); setForm(EMPTY) }
  }

  return (
    <div className="ha-artists">
      <p className="ha-artists__sub">A divisão de cada venda sai automática pelo contrato. O artista assina o certificado digitalmente.</p>
      <ul className="ha-artists-list">
        {artists.map((a) => (
          <li key={a.id}>
            <button type="button" className="ha-artists-row" onClick={() => openArtist(a)} aria-haspopup="dialog">
              <span className="ha-artists-av">{initialsOf(a.name)}</span>
              <span className="ha-stack ha-artists-row__txt">
                <span className="ha-artists-row__n">{a.name}{!a.hasAccount ? <span className="ha-artists-chip">Sem conta</span> : null}</span>
                <span className="ha-artists-row__s">{a.sub}</span>
              </span>
              <span className="ha-artists-tag">{a.contract ? a.contract.kindLabel : 'Sem contrato'}</span>
            </button>
          </li>
        ))}
        {artists.length === 0 ? <li className="ha-artists-empty">Nenhum artista representado ainda.</li> : null}
      </ul>
      <div className="ha-artists-foot">
        <Button variant="ink" size="md" icon="add" className="ha-artists-cta" onClick={() => { setInviting(true); setError(''); setForm(EMPTY) }}>Convidar artista</Button>
      </div>

      <Modal open={!!open} title={open?.name ?? ''} onClose={() => setOpen(null)} footer={ending ? undefined : <><Button variant="outline" size="sm" onClick={() => setOpen(null)}>Cancelar</Button><Button variant="ink" size="sm" loading={busy} onClick={saveContract}>Salvar contrato</Button></>}>
        {open ? (
          ending ? (
            <div className="ha-artists-confirm">
              <p className="ha-sm" style={{ margin: 0 }}>O contrato com {open.name} é encerrado agora. As obras ficam no acervo e as vendas em andamento seguem pela divisão combinada.</p>
              <div className="ha-artists-confirm__btns">
                <Button variant="outline" size="sm" onClick={() => setEnding(false)}>Voltar</Button>
                <button type="button" className="ha-artists-danger" disabled={busy} onClick={endRepresentation}>Encerrar representação</button>
              </div>
            </div>
          ) : (
            <>
              <p className="ha-caption" style={{ margin: 0 }}>{open.works} {open.works === 1 ? 'obra' : 'obras'} no acervo · {open.forSale} à venda{!open.hasAccount ? ' · sem conta na HouseArt' : ''}</p>
              <a className="ha-link ha-sm" href={`/e/artist/${encodeURIComponent(open.slug)}`} target="_blank" rel="noreferrer">Ver perfil público →</a>
              <SelectField label="Tipo de contrato" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value as ContractKind })}>
                {CONTRACT_KINDS.map((k) => <option key={k} value={k}>{CONTRACT_KIND_LABELS[k]}</option>)}
              </SelectField>
              <Field label="Divisão da galeria (% do líquido)" inputMode="decimal" value={edit.pct} onChange={(e) => setEdit({ ...edit, pct: e.target.value })} error={error || undefined} hint="O restante vai ao artista em cada venda, já com a taxa HouseArt descontada." />
              <Field label="Validade do contrato" type="date" value={edit.validUntil} onChange={(e) => setEdit({ ...edit, validUntil: e.target.value })} hint="Em branco: sem prazo." />
              <button type="button" className="ha-artists-danger" onClick={() => setEnding(true)}>Encerrar representação</button>
            </>
          )
        ) : null}
      </Modal>

      <Modal open={inviting} title="Convidar artista" onClose={() => setInviting(false)} footer={<><Button variant="outline" size="sm" onClick={() => setInviting(false)}>Cancelar</Button><Button variant="ink" size="sm" loading={busy} onClick={invite}>{form.email.trim() ? 'Enviar convite' : 'Adicionar artista'}</Button></>}>
        <Field label="Nome do artista" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Como aparece nas obras" autoFocus />
        <SelectField label="Tipo de contrato" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as ContractKind })}>
          {CONTRACT_KINDS.map((k) => <option key={k} value={k}>{CONTRACT_KIND_LABELS[k]}</option>)}
        </SelectField>
        <Field label="Divisão da galeria (% do líquido)" inputMode="decimal" value={form.pct} onChange={(e) => setForm({ ...form, pct: e.target.value })} />
        <Field label="Validade do contrato" type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} hint="Em branco: sem prazo." />
        <Field label="E-mail do artista (opcional)" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="artista@email.com" error={error || undefined} hint="Com e-mail, o artista recebe o convite para criar a conta e aceitar o contrato." />
      </Modal>
      <Toast message={toast} onDone={clearToast} />
    </div>
  )
}
