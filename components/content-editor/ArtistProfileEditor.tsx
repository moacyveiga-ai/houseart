'use client'
// Perfil público do artista (/e/artist/[slug]): quem é, a foto com crédito, a
// biografia, as linguagens, a trajetória (por tipo) e as publicações. Grava tudo
// de uma vez (PUT). Usado pelo próprio artista e pela galeria (artista sem conta).
import { useCallback, useState } from 'react'
import { Button, ButtonLink } from '@/components/ds/Button'
import { Field, SelectField, TextareaField } from '@/components/ds/Field'
import { Toast } from '@/components/ds/Toast'
import { ARTIST_ENTRY_KINDS, ARTIST_ENTRY_KIND_LABELS } from '@/lib/public-content/domain'
import { MAX_ENTRIES, MAX_LANGUAGES } from '@/lib/public-content/editor-core'
import type { ArtistProfileView } from '@/lib/public-content/editor-server'
import { callJson, ChipsInput, ImageInput, listOps, RowHead } from './parts'
import { PublicationsEditor, pubFormOf, pubsBody, type PubForm } from './PublicationsEditor'

interface EntryForm { kind: string; year: string; title: string; venue: string; city: string }
interface Form {
  fullName: string; birthPlace: string; livesIn: string; nationality: string; quote: string; bio: string
  languages: string[]; photoUrl: string | null; photoCredit: string
  entries: EntryForm[]; publications: PubForm[]
}

const formOf = (v: ArtistProfileView): Form => ({
  fullName: v.fullName ?? '', birthPlace: v.birthPlace ?? '', livesIn: v.livesIn ?? '', nationality: v.nationality ?? '', quote: v.quote ?? '', bio: v.bio ?? '',
  languages: v.languages, photoUrl: v.photoUrl, photoCredit: v.photoCredit ?? '',
  entries: v.entries.map((e) => ({ kind: e.kind, year: e.year, title: e.title, venue: e.venue ?? '', city: e.city ?? '' })),
  publications: v.publications.map(pubFormOf),
})

export function ArtistProfileEditor({ initial, saveUrl, uploadUrl, publicHref, intro }: { initial: ArtistProfileView; saveUrl: string; uploadUrl: string; publicHref: string; intro: string }) {
  const [form, setForm] = useState<Form>(() => formOf(initial))
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])
  const set = (patch: Partial<Form>) => { setForm((f) => ({ ...f, ...patch })); setDirty(true) }

  async function save() {
    const pubs = pubsBody(form.publications)
    if (!pubs.ok) { setError(pubs.error); return }
    setBusy(true); setError('')
    const r = await callJson<{ profile: ArtistProfileView }>(saveUrl, 'PUT', { ...form, publications: pubs.value })
    setBusy(false)
    if (!r.ok) { setError(r.error); return }
    setForm(formOf(r.data.profile)); setDirty(false); setToast('Perfil público salvo')
  }

  return (
    <div className="ha-ce">
      <div className="ha-ce__bar">
        <p className="ha-ce__lead">{intro}</p>
        <ButtonLink href={publicHref} variant="ghost" size="sm" icon="open_in_new">Ver página pública</ButtonLink>
      </div>

      <section className="ha-card ha-card--pad ha-ce__section" aria-labelledby="ce-who">
        <h2 id="ce-who" className="ha-h3">Quem é</h2>
        <ImageInput label="Foto" value={form.photoUrl} uploadUrl={uploadUrl} round onChange={(url) => set({ photoUrl: url })} hint="Retrato do artista. JPEG, PNG ou WebP até 10 MB." />
        <div className="ha-ce-grid">
          <Field label="Crédito da foto" value={form.photoCredit} maxLength={120} placeholder="Foto: Nome do fotógrafo" disabled={!form.photoUrl} onChange={(e) => set({ photoCredit: e.target.value })} />
          <Field label="Nome completo" value={form.fullName} maxLength={160} onChange={(e) => set({ fullName: e.target.value })} />
          <Field label="Local de nascimento" value={form.birthPlace} maxLength={80} placeholder="Salvador/BA" onChange={(e) => set({ birthPlace: e.target.value })} />
          <Field label="Vive e trabalha em" value={form.livesIn} maxLength={80} placeholder="Salvador/BA" onChange={(e) => set({ livesIn: e.target.value })} />
          <Field label="Nacionalidade" value={form.nationality} maxLength={60} placeholder="Brasileira" onChange={(e) => set({ nationality: e.target.value })} />
        </div>
        <TextareaField label="Frase" value={form.quote} maxLength={300} rows={2} placeholder="Uma frase sua que abre a página." onChange={(e) => set({ quote: e.target.value })} />
        <TextareaField label="Biografia" value={form.bio} maxLength={10000} rows={8} hint="Linha em branco separa os parágrafos." onChange={(e) => set({ bio: e.target.value })} />
        <ChipsInput label="Linguagens" values={form.languages} max={MAX_LANGUAGES} placeholder="Pintura, Óleo sobre linho…" onChange={(languages) => set({ languages })} />
      </section>

      <section className="ha-card ha-card--pad ha-ce__section" aria-labelledby="ce-path">
        <div className="ha-ce__section-head"><h2 id="ce-path" className="ha-h3">Trajetória</h2><p>Exposições, prêmios, formação e acervos.</p></div>
        {form.entries.length ? (
          <ul className="ha-ce-rows">
            {form.entries.map((e, i) => (
              <li key={i} className="ha-ce-row">
                <RowHead label={`Linha ${i + 1}`} index={i} count={form.entries.length} onMove={(to) => set({ entries: listOps.move(form.entries, i, to) })} onRemove={() => set({ entries: listOps.remove(form.entries, i) })} />
                <div className="ha-ce-grid--3 ha-ce-grid">
                  <SelectField label="Tipo" value={e.kind} onChange={(ev) => set({ entries: listOps.set(form.entries, i, { kind: ev.target.value }) })}>
                    {ARTIST_ENTRY_KINDS.map((k) => <option key={k} value={k}>{ARTIST_ENTRY_KIND_LABELS[k]}</option>)}
                  </SelectField>
                  <Field label="Ano" value={e.year} maxLength={20} placeholder="2026" required onChange={(ev) => set({ entries: listOps.set(form.entries, i, { year: ev.target.value }) })} />
                  <Field label="Título" value={e.title} maxLength={200} required onChange={(ev) => set({ entries: listOps.set(form.entries, i, { title: ev.target.value }) })} />
                  <Field label="Local" value={e.venue} maxLength={160} placeholder="Museu, galeria, instituição" onChange={(ev) => set({ entries: listOps.set(form.entries, i, { venue: ev.target.value }) })} />
                  <Field label="Cidade" value={e.city} maxLength={80} onChange={(ev) => set({ entries: listOps.set(form.entries, i, { city: ev.target.value }) })} />
                </div>
              </li>
            ))}
          </ul>
        ) : <p className="ha-ce__empty">Nada na trajetória ainda.</p>}
        <div><Button variant="outline" size="sm" icon="add" disabled={form.entries.length >= MAX_ENTRIES} onClick={() => set({ entries: [...form.entries, { kind: 'SOLO', year: '', title: '', venue: '', city: '' }] })}>Adicionar linha</Button></div>
      </section>

      <section className="ha-card ha-card--pad ha-ce__section" aria-labelledby="ce-pubs">
        <div className="ha-ce__section-head"><h2 id="ce-pubs" className="ha-h3">Publicações</h2><p>Catálogos, ensaios, entrevistas.</p></div>
        <PublicationsEditor value={form.publications} uploadUrl={uploadUrl} onChange={(publications) => set({ publications })} />
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
