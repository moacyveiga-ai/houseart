'use client'
// Agenda do site (equipe da casa): feiras, exposições e aberturas da Home.
import { useCallback, useState } from 'react'
import { Badge } from '@/components/ds/Badge'
import { Button } from '@/components/ds/Button'
import { Field, SelectField } from '@/components/ds/Field'
import { Icon } from '@/components/ds/Icon'
import { Modal } from '@/components/ds/Modal'
import { Toast } from '@/components/ds/Toast'
import { AGENDA_KINDS, AGENDA_KIND_LABELS, type AgendaKind } from '@/lib/public-content/domain'
import type { AgendaRow } from '@/lib/public-content/editor-server'
import { callJson } from './parts'

interface Form { kind: string; title: string; venue: string; city: string; startsOn: string; endsOn: string; period: string; url: string }
const EMPTY: Form = { kind: 'EXHIBITION', title: '', venue: '', city: '', startsOn: '', endsOn: '', period: '', url: '' }
const formOf = (e: AgendaRow): Form => ({ kind: e.kind, title: e.title, venue: e.venue, city: e.city, startsOn: e.startsOn, endsOn: e.endsOn ?? '', period: e.period ?? '', url: e.url ?? '' })
const dayLabel = (d: string) => d.split('-').reverse().join('/')
const sortRows = (list: AgendaRow[]) => [...list].sort((a, b) => (a.startsOn === b.startsOn ? b.id - a.id : a.startsOn < b.startsOn ? 1 : -1))

export function AgendaEditor({ initial }: { initial: AgendaRow[] }) {
  const [rows, setRows] = useState(initial)
  const [editing, setEditing] = useState<{ id: number | null; form: Form } | null>(null)
  const [removing, setRemoving] = useState<AgendaRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])
  const setField = (patch: Partial<Form>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e))

  async function save() {
    if (!editing) return
    setBusy(true); setError('')
    const body = { ...editing.form, endsOn: editing.form.endsOn || null }
    const r = editing.id === null
      ? await callJson<{ event: AgendaRow }>('/api/admin/content/agenda', 'POST', body)
      : await callJson<{ event: AgendaRow }>(`/api/admin/content/agenda/${editing.id}`, 'PATCH', body)
    setBusy(false)
    if (!r.ok) { setError(r.error); return }
    const ev = r.data.event
    setRows((list) => sortRows(list.some((x) => x.id === ev.id) ? list.map((x) => (x.id === ev.id ? ev : x)) : [ev, ...list]))
    setEditing(null); setToast(editing.id === null ? 'Evento criado' : 'Evento salvo')
  }

  async function remove() {
    if (!removing) return
    setBusy(true)
    const r = await callJson(`/api/admin/content/agenda/${removing.id}`, 'DELETE')
    setBusy(false)
    if (!r.ok) { setToast(r.error); return }
    setRows((list) => list.filter((x) => x.id !== removing.id)); setRemoving(null); setToast('Evento apagado')
  }

  return (
    <div className="ha-ce">
      <div className="ha-ce__bar">
        <p className="ha-ce__lead">Feiras, exposições e aberturas que a Home mostra por mês.</p>
        <Button variant="primary" size="sm" icon="add" onClick={() => { setEditing({ id: null, form: { ...EMPTY } }); setError('') }}>Novo evento</Button>
      </div>
      {rows.length ? (
        <ul className="ha-ce-list">
          {rows.map((e) => (
            <li key={e.id} className="ha-ce-item ha-ce-item--noimg">
              <span className="ha-ce-item__txt">
                <span className="ha-ce-item__t">{e.title}</span>
                <span className="ha-ce-item__s">
                  <Badge tone="soft">{AGENDA_KIND_LABELS[e.kind as AgendaKind] ?? e.kind}</Badge>
                  <span>{dayLabel(e.startsOn)}{e.endsOn ? ` a ${dayLabel(e.endsOn)}` : ''} · {e.venue} · {e.city}</span>
                  {e.byGallery ? <Badge tone="neutral">Da galeria</Badge> : null}
                </span>
              </span>
              <span className="ha-ce-item__btns">
                <button type="button" className="ha-ce-icon" aria-label="Editar" onClick={() => { setEditing({ id: e.id, form: formOf(e) }); setError('') }}><Icon name="edit" size={20} /></button>
                <button type="button" className="ha-ce-icon ha-ce-icon--danger" aria-label="Apagar" onClick={() => setRemoving(e)}><Icon name="delete" size={20} /></button>
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="ha-ce__empty">Nenhum evento na agenda.</p>}

      <Modal open={!!editing} title={editing?.id === null ? 'Novo evento' : 'Editar evento'} onClose={() => setEditing(null)} footer={<>
        <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Cancelar</Button>
        <Button variant="ink" size="sm" icon="save" loading={busy} onClick={() => void save()}>Salvar</Button>
      </>}>
        {editing ? (
          <div className="ha-stack ha-stack--3">
            <div className="ha-ce-grid">
              <SelectField label="Tipo" value={editing.form.kind} onChange={(e) => setField({ kind: e.target.value })}>
                {AGENDA_KINDS.map((k) => <option key={k} value={k}>{AGENDA_KIND_LABELS[k]}</option>)}
              </SelectField>
              <Field label="Período (opcional)" value={editing.form.period} maxLength={40} placeholder="Até 20 dez" onChange={(e) => setField({ period: e.target.value })} />
              <div className="ha-ce-span"><Field label="Título" value={editing.form.title} maxLength={200} required onChange={(e) => setField({ title: e.target.value })} /></div>
              <Field label="Local" value={editing.form.venue} maxLength={160} required onChange={(e) => setField({ venue: e.target.value })} />
              <Field label="Cidade" value={editing.form.city} maxLength={80} required placeholder="Salvador/BA" onChange={(e) => setField({ city: e.target.value })} />
              <Field label="Início" type="date" value={editing.form.startsOn} required onChange={(e) => setField({ startsOn: e.target.value })} />
              <Field label="Fim (opcional)" type="date" value={editing.form.endsOn} min={editing.form.startsOn || undefined} onChange={(e) => setField({ endsOn: e.target.value })} />
              <div className="ha-ce-span"><Field label="Link (opcional)" type="url" value={editing.form.url} maxLength={500} placeholder="https://…" onChange={(e) => setField({ url: e.target.value })} /></div>
            </div>
            {error ? <p className="ha-ce__error" role="alert">{error}</p> : null}
          </div>
        ) : null}
      </Modal>

      <Modal open={!!removing} title="Apagar evento" onClose={() => setRemoving(null)} footer={<>
        <Button variant="ghost" size="sm" onClick={() => setRemoving(null)}>Cancelar</Button>
        <Button variant="ink" size="sm" icon="delete" loading={busy} onClick={() => void remove()}>Apagar</Button>
      </>}>
        <p className="ha-body">“{removing?.title}” sai da agenda do site. Não dá para desfazer.</p>
      </Modal>
      <Toast message={toast} onDone={clearToast} />
    </div>
  )
}
