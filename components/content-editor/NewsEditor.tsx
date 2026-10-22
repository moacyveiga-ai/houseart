'use client'
// Notícias do site (equipe da casa): a lista (rascunho/publicada, destaque) e o
// formulário. Publicar grava a data da primeira publicação; despublicar volta a
// rascunho. O destaque é um só (a Home mostra um).
import { useCallback, useState } from 'react'
import { Badge } from '@/components/ds/Badge'
import { Button, ButtonLink } from '@/components/ds/Button'
import { Field, SelectField, TextareaField } from '@/components/ds/Field'
import { Icon } from '@/components/ds/Icon'
import { Modal } from '@/components/ds/Modal'
import { Toast } from '@/components/ds/Toast'
import { Toggle } from '@/components/ds/Toggle'
import { NEWS_CATEGORIES } from '@/lib/public-content/domain'
import { NEWS_STATE_LABELS } from '@/lib/public-content/editor-core'
import type { NewsRow } from '@/lib/public-content/editor-server'
import { callJson, ImageInput } from './parts'

interface Form { title: string; category: string; slug: string; summary: string; body: string; imageUrl: string | null; sourceName: string; sourceUrl: string; featured: boolean }
const EMPTY: Form = { title: '', category: NEWS_CATEGORIES[0], slug: '', summary: '', body: '', imageUrl: null, sourceName: '', sourceUrl: '', featured: false }
const formOf = (n: NewsRow): Form => ({ title: n.title, category: n.category, slug: n.slug, summary: n.summary ?? '', body: n.body ?? '', imageUrl: n.imageUrl, sourceName: n.sourceName ?? '', sourceUrl: n.sourceUrl ?? '', featured: n.featured })
const dateOf = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Bahia' })

export function NewsEditor({ initial }: { initial: NewsRow[] }) {
  const [rows, setRows] = useState(initial)
  const [editing, setEditing] = useState<{ id: number | null; form: Form } | null>(null)
  const [removing, setRemoving] = useState<NewsRow | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])

  const upsert = (n: NewsRow) => setRows((list) => {
    const others = n.featured ? list.map((x) => (x.id !== n.id && x.featured ? { ...x, featured: false } : x)) : list
    return others.some((x) => x.id === n.id) ? others.map((x) => (x.id === n.id ? n : x)) : [n, ...others]
  })
  const setField = (patch: Partial<Form>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e))

  async function save() {
    if (!editing) return
    setBusy(true); setError('')
    const r = editing.id === null
      ? await callJson<{ news: NewsRow }>('/api/admin/content/news', 'POST', editing.form)
      : await callJson<{ news: NewsRow }>(`/api/admin/content/news/${editing.id}`, 'PATCH', editing.form)
    setBusy(false)
    if (!r.ok) { setError(r.error); return }
    upsert(r.data.news); setEditing(null); setToast(editing.id === null ? 'Notícia criada como rascunho' : 'Notícia salva')
  }

  async function toggle(n: NewsRow, what: 'publish' | 'feature') {
    const body = what === 'publish' ? { published: n.state === 'DRAFT' } : { featured: !n.featured }
    const r = await callJson<{ news: NewsRow }>(`/api/admin/content/news/${n.id}/${what}`, 'POST', body)
    if (!r.ok) { setToast(r.error); return }
    upsert(r.data.news)
    setToast(what === 'publish' ? (r.data.news.state === 'DRAFT' ? 'Voltou a rascunho' : 'Publicada') : r.data.news.featured ? 'Em destaque na Home' : 'Destaque retirado')
  }

  async function remove() {
    if (!removing) return
    setBusy(true)
    const r = await callJson(`/api/admin/content/news/${removing.id}`, 'DELETE')
    setBusy(false)
    if (!r.ok) { setToast(r.error); return }
    setRows((list) => list.filter((x) => x.id !== removing.id)); setRemoving(null); setToast('Notícia apagada')
  }

  if (editing) {
    const f = editing.form
    return (
      <div className="ha-ce">
        <div className="ha-ce__bar">
          <Button variant="ghost" size="sm" icon="arrow_back" onClick={() => { setEditing(null); setError('') }}>Voltar à lista</Button>
          {editing.id !== null && rows.find((x) => x.id === editing.id)?.state === 'PUBLISHED' ? <ButtonLink href={`/e/news/${f.slug}`} variant="ghost" size="sm" icon="open_in_new">Ver no site</ButtonLink> : null}
        </div>
        <section className="ha-card ha-card--pad ha-ce__section" aria-labelledby="ce-news">
          <h2 id="ce-news" className="ha-h3">{editing.id === null ? 'Nova notícia' : 'Editar notícia'}</h2>
          <div className="ha-ce-grid">
            <div className="ha-ce-span"><Field label="Título" value={f.title} maxLength={200} required onChange={(e) => setField({ title: e.target.value })} /></div>
            <SelectField label="Categoria" value={f.category} onChange={(e) => setField({ category: e.target.value })}>
              {NEWS_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </SelectField>
            <Field label="Endereço (slug)" value={f.slug} maxLength={60} placeholder="Gerado pelo título" hint={f.slug ? `/e/news/${f.slug}` : 'Vazio: gerado pelo título.'} onChange={(e) => setField({ slug: e.target.value })} />
          </div>
          <TextareaField label="Resumo" value={f.summary} maxLength={400} rows={2} hint="Aparece no cartão da Home e abre a leitura." onChange={(e) => setField({ summary: e.target.value })} />
          <TextareaField label="Texto" value={f.body} maxLength={20000} rows={12} hint="Linha em branco separa os parágrafos." onChange={(e) => setField({ body: e.target.value })} />
          <ImageInput label="Imagem" value={f.imageUrl} uploadUrl="/api/admin/content/images" onChange={(url) => setField({ imageUrl: url })} />
          <div className="ha-ce-grid">
            <Field label="Fonte" value={f.sourceName} maxLength={120} placeholder="Nome do veículo" onChange={(e) => setField({ sourceName: e.target.value })} />
            <Field label="Link da fonte" type="url" value={f.sourceUrl} maxLength={500} placeholder="https://…" onChange={(e) => setField({ sourceUrl: e.target.value })} />
          </div>
          <label className="ha-ce-switch"><Toggle on={f.featured} label="Destaque na Home" onChange={(featured) => setField({ featured })} />Destaque na Home (tira o destaque das outras)</label>
        </section>
        {error ? <p className="ha-ce__error" role="alert">{error}</p> : null}
        <div className="ha-ce__sticky">
          <Button variant="ghost" size="md" onClick={() => { setEditing(null); setError('') }}>Cancelar</Button>
          <Button variant="ink" size="md" icon="save" loading={busy} onClick={() => void save()}>{editing.id === null ? 'Criar rascunho' : 'Salvar'}</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="ha-ce">
      <div className="ha-ce__bar">
        <p className="ha-ce__lead">Notícias da Home e de /e/news. Rascunho não aparece no site.</p>
        <Button variant="primary" size="sm" icon="add" onClick={() => { setEditing({ id: null, form: { ...EMPTY } }); setError('') }}>Nova notícia</Button>
      </div>
      {rows.length ? (
        <ul className="ha-ce-list">
          {rows.map((n) => (
            <li key={n.id} className="ha-ce-item">
              {/* eslint-disable-next-line @next/next/no-img-element -- public derivative */}
              {n.imageUrl ? <img src={n.imageUrl} alt="" className="ha-ce-item__thumb" /> : <span className="ha-ce-item__thumb" aria-hidden="true" />}
              <span className="ha-ce-item__txt">
                <span className="ha-ce-item__t">{n.title}</span>
                <span className="ha-ce-item__s">
                  <Badge tone={n.state === 'PUBLISHED' ? 'verified' : n.state === 'SCHEDULED' ? 'pending' : 'neutral'}>{NEWS_STATE_LABELS[n.state]}</Badge>
                  {n.featured ? <Badge tone="ink">Destaque</Badge> : null}
                  <span>{n.category} · {dateOf(n.publishedAt ?? n.createdAt)}</span>
                </span>
              </span>
              <span className="ha-ce-item__btns">
                <button type="button" className={`ha-ce-icon${n.featured ? ' ha-ce-icon--on' : ''}`} aria-label={n.featured ? 'Tirar o destaque' : 'Marcar como destaque'} aria-pressed={n.featured} onClick={() => void toggle(n, 'feature')}><Icon name="star" size={20} /></button>
                <button type="button" className="ha-ce-icon" aria-label={n.state === 'DRAFT' ? 'Publicar' : 'Despublicar'} onClick={() => void toggle(n, 'publish')}><Icon name={n.state === 'DRAFT' ? 'publish' : 'unpublished'} size={20} /></button>
                <button type="button" className="ha-ce-icon" aria-label="Editar" onClick={() => { setEditing({ id: n.id, form: formOf(n) }); setError('') }}><Icon name="edit" size={20} /></button>
                <button type="button" className="ha-ce-icon ha-ce-icon--danger" aria-label="Apagar" onClick={() => setRemoving(n)}><Icon name="delete" size={20} /></button>
              </span>
            </li>
          ))}
        </ul>
      ) : <p className="ha-ce__empty">Nenhuma notícia ainda.</p>}
      <Modal open={!!removing} title="Apagar notícia" onClose={() => setRemoving(null)} footer={<>
        <Button variant="ghost" size="sm" onClick={() => setRemoving(null)}>Cancelar</Button>
        <Button variant="ink" size="sm" icon="delete" loading={busy} onClick={() => void remove()}>Apagar</Button>
      </>}>
        <p className="ha-body">“{removing?.title}” sai do site e da lista. Não dá para desfazer.</p>
      </Modal>
      <Toast message={toast} onDone={clearToast} />
    </div>
  )
}
