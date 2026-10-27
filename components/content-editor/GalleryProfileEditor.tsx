'use client'
// Perfil público da galeria (/e/gallery/[slug] e a lista /e/galleries): resumo,
// sobre, etiquetas, endereço e mapa, contatos, capa, os itens (marcos, equipe,
// fotos, vídeos, salas) e as publicações. Grava tudo de uma vez (PUT).
import Link from 'next/link'
import { useCallback, useState } from 'react'
import { Button, ButtonLink } from '@/components/ds/Button'
import { Field, SelectField, TextareaField } from '@/components/ds/Field'
import { Icon } from '@/components/ds/Icon'
import { Toast } from '@/components/ds/Toast'
import { GALLERY_ITEM_IMAGE_KINDS, GALLERY_ITEM_KIND_LABELS, GALLERY_ITEM_KINDS, GALLERY_ITEM_SUBTITLE_HINT, type GalleryItemKind } from '@/lib/public-content/domain'
import { MAX_GALLERY_ITEMS, MAX_TAGS } from '@/lib/public-content/editor-core'
import type { GalleryProfileView } from '@/lib/public-content/editor-server'
import { formatAnyPhoneInput } from '@/lib/sms/core'
import { callJson, ChipsInput, ImageInput, listOps, RowHead } from './parts'
import { PublicationsEditor, pubFormOf, pubsBody, type PubForm } from './PublicationsEditor'

interface ItemForm { kind: GalleryItemKind; title: string; subtitle: string; url: string | null; body: string; email: string; phone: string }
interface Form {
  name: string; city: string; uf: string; foundedYear: string; summary: string; about: string; tags: string[]
  street: string; district: string; lat: string; lng: string; coverUrl: string | null
  websiteUrl: string; instagram: string; email: string; phone: string; hours: string
  items: ItemForm[]; publications: PubForm[]
}
const s = (v: string | number | null) => (v === null ? '' : String(v))
const formOf = (v: GalleryProfileView): Form => ({
  name: v.name, city: s(v.city), uf: s(v.uf), foundedYear: s(v.foundedYear), summary: s(v.summary), about: s(v.about), tags: v.tags,
  street: s(v.street), district: s(v.district), lat: s(v.lat), lng: s(v.lng), coverUrl: v.coverUrl,
  websiteUrl: s(v.websiteUrl), instagram: v.instagram ? `@${v.instagram}` : '', email: s(v.email), phone: s(v.phone), hours: s(v.hours),
  items: v.items.map((i) => ({ kind: i.kind as GalleryItemKind, title: i.title, subtitle: s(i.subtitle), url: i.url, body: s(i.body), email: s(i.email), phone: s(i.phone) })),
  publications: v.publications.map(pubFormOf),
})

export function GalleryProfileEditor({ initial }: { initial: GalleryProfileView }) {
  const [view, setView] = useState(initial)
  const [form, setForm] = useState<Form>(() => formOf(initial))
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])
  const set = (patch: Partial<Form>) => { setForm((f) => ({ ...f, ...patch })); setDirty(true) }
  const upload = '/api/gallery/public-profile/images'

  async function save() {
    const pubs = pubsBody(form.publications)
    if (!pubs.ok) { setError(pubs.error); return }
    setBusy(true); setError('')
    const r = await callJson<{ profile: GalleryProfileView }>('/api/gallery/public-profile', 'PUT', { ...form, foundedYear: form.foundedYear || null, lat: form.lat || null, lng: form.lng || null, publications: pubs.value })
    setBusy(false)
    if (!r.ok) { setError(r.error); return }
    setView(r.data.profile); setForm(formOf(r.data.profile)); setDirty(false); setToast('Perfil da galeria salvo')
  }

  return (
    <div className="ha-ce">
      <div className="ha-ce__bar">
        <p className="ha-ce__lead">O que o público vê em Galerias e na página da galeria. As obras à venda entram sozinhas.</p>
        {view.slug ? <ButtonLink href={`/e/gallery/${view.slug}`} variant="ghost" size="sm" icon="open_in_new">Ver página pública</ButtonLink> : <span className="ha-caption">A página pública nasce no primeiro salvamento.</span>}
      </div>

      <section className="ha-card ha-card--pad ha-ce__section" aria-labelledby="ce-g-about">
        <h2 id="ce-g-about" className="ha-h3">A galeria</h2>
        <ImageInput label="Capa" value={form.coverUrl} uploadUrl={upload} onChange={(url) => set({ coverUrl: url })} hint="Foto da fachada ou de uma sala. JPEG, PNG ou WebP até 10 MB." />
        <div className="ha-ce-grid--3 ha-ce-grid">
          <Field label="Nome público" value={form.name} maxLength={120} required onChange={(e) => set({ name: e.target.value })} />
          <Field label="Cidade" value={form.city} maxLength={80} onChange={(e) => set({ city: e.target.value })} />
          <Field label="UF" value={form.uf} maxLength={2} placeholder="BA" onChange={(e) => set({ uf: e.target.value.toUpperCase() })} />
          <Field label="Fundada em" value={form.foundedYear} inputMode="numeric" maxLength={4} placeholder="2009" onChange={(e) => set({ foundedYear: e.target.value.replace(/\D/g, '') })} />
        </div>
        <Field label="Resumo" value={form.summary} maxLength={200} hint="Uma linha, na lista de Galerias." onChange={(e) => set({ summary: e.target.value })} />
        <TextareaField label="Sobre" value={form.about} maxLength={10000} rows={7} hint="Linha em branco separa os parágrafos." onChange={(e) => set({ about: e.target.value })} />
        <ChipsInput label="Etiquetas" values={form.tags} max={MAX_TAGS} placeholder="Contemporânea, Pintura…" onChange={(tags) => set({ tags })} />
      </section>

      <section className="ha-card ha-card--pad ha-ce__section" aria-labelledby="ce-g-visit">
        <div className="ha-ce__section-head"><h2 id="ce-g-visit" className="ha-h3">Visita e contato</h2><p>Coordenadas são opcionais: com elas, a página mostra o mapa.</p></div>
        <div className="ha-ce-grid">
          <Field label="Endereço" value={form.street} maxLength={160} placeholder="Rua, número" onChange={(e) => set({ street: e.target.value })} />
          <Field label="Bairro" value={form.district} maxLength={80} onChange={(e) => set({ district: e.target.value })} />
          <Field label="Latitude" value={form.lat} inputMode="decimal" placeholder="-12.97" onChange={(e) => set({ lat: e.target.value })} />
          <Field label="Longitude" value={form.lng} inputMode="decimal" placeholder="-38.51" onChange={(e) => set({ lng: e.target.value })} />
          <Field label="Horários" value={form.hours} maxLength={200} placeholder="Ter a sáb, 10h às 19h" className="" onChange={(e) => set({ hours: e.target.value })} />
          <Field label="Telefone" value={form.phone} maxLength={30} inputMode="tel" placeholder="(71) 3333-0000" onChange={(e) => set({ phone: formatAnyPhoneInput(e.target.value) })} />
          <Field label="E-mail" type="email" value={form.email} maxLength={254} onChange={(e) => set({ email: e.target.value })} />
          <Field label="Site" type="url" value={form.websiteUrl} maxLength={500} placeholder="https://…" onChange={(e) => set({ websiteUrl: e.target.value })} />
          <Field label="Instagram" value={form.instagram} maxLength={120} placeholder="@galeria" onChange={(e) => set({ instagram: e.target.value })} />
        </div>
      </section>

      <section className="ha-card ha-card--pad ha-ce__section" aria-labelledby="ce-g-items">
        <div className="ha-ce__section-head"><h2 id="ce-g-items" className="ha-h3">Marcos, equipe, fotos e salas</h2><p>A ordem aqui é a ordem na página.</p></div>
        {form.items.length ? (
          <ul className="ha-ce-rows">
            {form.items.map((it, i) => (
              <li key={i} className="ha-ce-row">
                <RowHead label={`${GALLERY_ITEM_KIND_LABELS[it.kind]} · ${i + 1}`} index={i} count={form.items.length} onMove={(to) => set({ items: listOps.move(form.items, i, to) })} onRemove={() => set({ items: listOps.remove(form.items, i) })} />
                <div className="ha-ce-grid--3 ha-ce-grid">
                  <SelectField label="Tipo" value={it.kind} onChange={(e) => set({ items: listOps.set(form.items, i, { kind: e.target.value as GalleryItemKind, url: null }) })}>
                    {GALLERY_ITEM_KINDS.map((k) => <option key={k} value={k}>{GALLERY_ITEM_KIND_LABELS[k]}</option>)}
                  </SelectField>
                  <Field label={it.kind === 'TEAM' ? 'Nome' : 'Título'} value={it.title} maxLength={160} required onChange={(e) => set({ items: listOps.set(form.items, i, { title: e.target.value }) })} />
                  <Field label="Subtítulo" value={it.subtitle} maxLength={120} placeholder={GALLERY_ITEM_SUBTITLE_HINT[it.kind]} onChange={(e) => set({ items: listOps.set(form.items, i, { subtitle: e.target.value }) })} />
                  {GALLERY_ITEM_IMAGE_KINDS.includes(it.kind)
                    ? <div className="ha-ce-span"><ImageInput label={it.kind === 'TEAM' ? 'Foto' : 'Imagem'} value={it.url} uploadUrl={upload} round={it.kind === 'TEAM'} onChange={(url) => set({ items: listOps.set(form.items, i, { url }) })} /></div>
                    : it.kind === 'VIDEO'
                      ? <div className="ha-ce-span"><Field label="Link do vídeo" type="url" value={it.url ?? ''} maxLength={500} placeholder="https://…" onChange={(e) => set({ items: listOps.set(form.items, i, { url: e.target.value || null }) })} /></div>
                      : null}
                  {it.kind === 'TEAM' ? (
                    <>
                      <div className="ha-ce-span"><TextareaField label="Bio" value={it.body} maxLength={400} rows={3} placeholder="Duas ou três linhas sobre a pessoa" onChange={(e) => set({ items: listOps.set(form.items, i, { body: e.target.value }) })} /></div>
                      <Field label="E-mail" type="email" value={it.email} maxLength={160} onChange={(e) => set({ items: listOps.set(form.items, i, { email: e.target.value }) })} />
                      <Field label="Telefone" type="tel" value={it.phone} maxLength={30} onChange={(e) => set({ items: listOps.set(form.items, i, { phone: e.target.value }) })} />
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="ha-ce__empty">Nenhum item ainda.</p>}
        <div className="ha-ce__actions">
          {(['MILESTONE', 'TEAM', 'PHOTO', 'ROOM', 'VIDEO'] as const).map((k) => (
            <Button key={k} variant="outline" size="xs" icon="add" disabled={form.items.length >= MAX_GALLERY_ITEMS} onClick={() => set({ items: [...form.items, { kind: k, title: '', subtitle: '', url: null, body: '', email: '', phone: '' }] })}>{GALLERY_ITEM_KIND_LABELS[k]}</Button>
          ))}
        </div>
      </section>

      <section className="ha-card ha-card--pad ha-ce__section" aria-labelledby="ce-g-pubs">
        <div className="ha-ce__section-head"><h2 id="ce-g-pubs" className="ha-h3">Publicações da galeria</h2><p>Catálogos de exposição, ensaios.</p></div>
        <PublicationsEditor value={form.publications} uploadUrl={upload} onChange={(publications) => set({ publications })} />
      </section>

      <section className="ha-card ha-card--pad ha-ce__section" aria-labelledby="ce-g-artists">
        <div className="ha-ce__section-head"><h2 id="ce-g-artists" className="ha-h3">Artistas sem conta</h2><p>A galeria edita o perfil público de quem ela representa e ainda não tem conta.</p></div>
        {view.artists.length ? (
          <ul className="ha-ce-list">
            {view.artists.map((a) => (
              <li key={a.id}>
                <Link href={`/gallery/public/artists/${a.id}`} className="ha-ce-item ha-ce-item--noimg ha-ce-link">
                  <span className="ha-ce-item__txt"><span className="ha-ce-item__t">{a.name}</span><span className="ha-ce-item__s">/e/artist/{a.slug}</span></span>
                  <Icon name="chevron_right" size={20} />
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="ha-ce__empty">Todos os artistas representados têm conta e editam o próprio perfil.</p>}
      </section>

      {error ? <p className="ha-ce__error" role="alert">{error}</p> : null}
      <div className="ha-ce__sticky">
        {dirty ? <span className="ha-caption">Alterações não salvas</span> : null}
        <Button variant="ink" size="md" icon="save" loading={busy} onClick={() => void save()}>Salvar perfil</Button>
      </div>
      <Toast message={toast} onDone={clearToast} />
    </div>
  )
}
