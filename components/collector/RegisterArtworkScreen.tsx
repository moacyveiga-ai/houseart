'use client'
// Cadastrar obra do colecionador (handoff "HouseArt App Colecionador" › cadobra): five steps and the
// "Pronto" screen. 1 Origem (the cards of ACQUISITION_KIND_CARDS) · 2 Artista (public search, or
// "não está na lista: escrever o nome") → the draft is born (POST /api/collector/artworks) and the
// URL carries it (?draft=<id>) · 3 Fotos guiadas (MediaStep: the ten slots, the guided camera and,
// after each shot, the editor — luz, cor, recorte, reflexo; the original is kept) · 4 Ficha (title,
// year, the chip groups Técnica / Suporte / Edição / Assinatura / Estado de conservação, dimensions,
// the acquisition and "Preencher com as fotos") · 5 Revisão → "Concluir cadastro" → Pronto with the
// next steps and the services. Out (no domain yet): reading an existing HouseArt tag on step 1 and
// the documents of the prototype (nota fiscal, certificado anterior, catálogo, foto antiga).
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { Toast } from '@/components/ds/Toast'
import { MediaStep } from '@/components/artworks/MediaStep'
import { ACQUISITION_KIND_CARDS, CONDITION_GRADES, CONDITION_GRADE_LABELS, REQUIRED_MEDIA_SLOTS } from '@/lib/artworks/domain'
import { categoryOfTechnique, cmOf, dimensionsLabel, EDITION_CHIPS, editionChipOf, NEXT_STEPS, REGISTER_STEPS, resumeStep, sheetMessage, sheetProblems, SIGNATURE_CHIPS, signatureChipOf, SUPPORT_CHIPS, supportChipOf, TECHNIQUE_CHIPS, techniqueChipOf, yearOf, yearPatch, type RegisterStep } from '@/lib/collectors/register-core'
import { digitsOf, formatThousands, reaisDigitsToCents } from './seller-core'
import { ServicesSheet } from './ServicesSheet'
import './register-artwork.css'

interface ArtistHit { slug: string; name: string; meta: string; photoUrl: string | null }
interface DraftMedia { kind: string; publicUrl: string | null; quality: string | null }

/**
 * The gallery's register (handoff "Web Galeria" › Cadastrar obra) is this screen with another variant:
 * its own origin cards ("De onde vem esta obra?"), the gallery's artists as the first suggestions, the
 * provenance words of a desk and the next steps of the acervo. Without it, the collector's register.
 */
export interface RegisterVariant {
  kind: 'collector' | 'gallery'
  steps: readonly RegisterStep[]
  originCards: readonly { key: string; name: string; description: string; icon: string }[]
  originLabel: string
  /** POST that creates the draft: body { acquisitionKind, artistId? | artistName } → { id } */
  createUrl: string
  /** the URL that resumes a draft, the id appended (data, never a function: the page is a Server Component) */
  resumeHrefBase: string
  exitHref: string
  exitLabel: string
  nextSteps: readonly { title: string; sub: string; icon: string; done: boolean }[]
  provenance: { title: string; from: { label: string; placeholder: string }; year: { label: string; placeholder: string }; paid: { label: string; note: string }; note: { label: string; placeholder: string } }
  /** the gallery's own artists, offered as the list (the public search is the collector's: a gallery sells only artists it represents — Artistas representados adds one) */
  artists?: { id: number; name: string; sub: string }[]
}

const COLLECTOR_VARIANT: RegisterVariant = {
  kind: 'collector', steps: REGISTER_STEPS, originCards: ACQUISITION_KIND_CARDS, originLabel: 'Origem da obra',
  createUrl: '/api/collector/artworks', resumeHrefBase: '/wallet/register?draft=', exitHref: '/wallet', exitLabel: 'Ver na coleção',
  nextSteps: NEXT_STEPS,
  provenance: { title: 'Aquisição', from: { label: 'De quem você adquiriu', placeholder: 'Galeria, leilão, pessoa ou família' }, year: { label: 'Ano da aquisição', placeholder: 'Ex.: 2019' }, paid: { label: 'Valor pago', note: 'fica só com você' }, note: { label: 'Observações', placeholder: 'História da obra, exposições, restauros anteriores…' } },
}

export interface RegisterDraft {
  id: number; acquisitionKind: string; artistName: string; title: string; year: number | null
  technique: string | null; materials: string | null; heightMm: number | null; widthMm: number | null; depthMm: number | null
  edition: string | null; signatureLocation: string | null; conditionGrade: string | null
  acquisitionYear: number | null; acquisitionFrom: string | null; acquisitionNote: string | null; acquisitionPriceCents: string | null
  media: DraftMedia[]
  /** concluded before (wizardStep 5): opens on the review */
  completed: boolean
}

const TECHNIQUES = TECHNIQUE_CHIPS.map((t) => t.label)
/** A saved value on its chip: the chip itself, or what the free text points to. */
const chipOf = (v: string | null | undefined, list: readonly string[], map: (t: string) => string | null) => (!v ? null : list.includes(v) ? v : map(v))

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')
const paidOf = (cents: string | null) => (cents && cents !== '0' ? formatThousands(String(BigInt(cents) / 100n)) : '')
const FRONT = 'FRONT_COLOR_CARD'

async function api(url: string, init: RequestInit) {
  const res = await fetch(url, init)
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  return { res, data }
}

function Chips({ label, options, value, onChange }: { label: string; options: readonly string[]; value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="ha-reg__field" role="group" aria-label={label}>
      <span className="ha-reg__field-k">{label}</span>
      <span className="ha-reg__chips">
        {options.map((o) => <button type="button" key={o} aria-pressed={value === o} className={`ha-reg__chip${value === o ? ' ha-reg__chip--on' : ''}`} onClick={() => onChange(value === o ? null : o)}>{o}</button>)}
      </span>
    </div>
  )
}

export function RegisterArtworkScreen({ draft, variant: V = COLLECTOR_VARIANT }: { draft: RegisterDraft | null; variant?: RegisterVariant }) {
  const router = useRouter()
  const [id, setId] = useState<number | null>(draft?.id ?? null)
  const [step, setStep] = useState(draft ? resumeStep(draft.media.some((m) => m.kind === FRONT), draft.completed) : 0)
  // "Editar" on the review: the step goes back to the review when it is done
  const [fromReview, setFromReview] = useState(false)
  const creating = useRef(false)
  const [done, setDone] = useState(false)
  const [kind, setKind] = useState<string | null>(draft?.acquisitionKind ?? null)
  // artist (step 2): fixed once the draft exists
  const [q, setQ] = useState('')
  const [answer, setAnswer] = useState<{ term: string; hits: ArtistHit[] }>({ term: '', hits: [] })
  const [picked, setPicked] = useState<string>(draft?.artistName ?? '')
  // a represented artist chosen from the gallery's list travels by id (the name alone could be another artist of the house)
  const [pickedId, setPickedId] = useState<number | null>(null)
  const [free, setFree] = useState(false)
  const [freeName, setFreeName] = useState('')
  // photos (step 3)
  const [media, setMedia] = useState<DraftMedia[]>(draft?.media ?? [])
  // sheet (step 4)
  const [title, setTitle] = useState(draft?.title ?? '')
  const [year, setYear] = useState(draft?.year ? String(draft.year) : '')
  const [technique, setTechnique] = useState<string | null>(chipOf(draft?.technique, TECHNIQUES, techniqueChipOf))
  const [support, setSupport] = useState<string | null>(chipOf(draft?.materials, SUPPORT_CHIPS, supportChipOf))
  const [edition, setEdition] = useState<string | null>(chipOf(draft?.edition, EDITION_CHIPS, editionChipOf))
  const [signature, setSignature] = useState<string | null>(chipOf(draft?.signatureLocation, SIGNATURE_CHIPS, signatureChipOf))
  const [condition, setCondition] = useState<string | null>(draft?.conditionGrade ?? null)
  const [h, setH] = useState(cmOf(draft?.heightMm ?? null))
  const [w, setW] = useState(cmOf(draft?.widthMm ?? null))
  const [d, setD] = useState(cmOf(draft?.depthMm ?? null))
  const [acqYear, setAcqYear] = useState(draft?.acquisitionYear ? String(draft.acquisitionYear) : '')
  const [from, setFrom] = useState(draft?.acquisitionFrom ?? '')
  const [paid, setPaid] = useState(paidOf(draft?.acquisitionPriceCents ?? null))
  const [note, setNote] = useState(draft?.acquisitionNote ?? '')
  const [tried, setTried] = useState(false)
  // ui
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [services, setServices] = useState(false)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2 || id) return
    let gone = false
    const t = window.setTimeout(() => {
      fetch(`/api/public/search?q=${encodeURIComponent(term)}`).then(async (r) => {
        const data = (await r.json().catch(() => ({}))) as { artists?: ArtistHit[] }
        if (!gone) setAnswer({ term, hits: (data.artists ?? []).slice(0, 8) })
      }).catch(() => { if (!gone) setAnswer({ term, hits: [] }) })
    }, 250)
    return () => { gone = true; window.clearTimeout(t) }
  }, [q, id])
  const term = q.trim()
  const searching = term.length >= 2 && answer.term !== term
  const hits = answer.term === term ? answer.hits : []

  const artistName = id ? picked : free ? freeName.trim() : picked
  const hasFront = media.some((m) => m.kind === FRONT && m.publicUrl)
  const requiredDone = REQUIRED_MEDIA_SLOTS.filter((s) => media.some((m) => m.kind === s.kind)).length
  const problems = sheetProblems({ title, technique, heightCm: h, widthCm: w })
  const cover = media.find((m) => m.kind === FRONT)?.publicUrl ?? null

  /** Step 2 → the draft is born with the origin and the artist; the URL keeps it. */
  async function createDraft() {
    if (!kind || artistName.length < 2 || creating.current) return
    creating.current = true
    setBusy(true); setError('')
    const { res, data } = await api(V.createUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ acquisitionKind: kind, ...(pickedId && !free ? { artistId: pickedId } : { artistName }) }) })
    setBusy(false)
    if (!res.ok || typeof data.id !== 'number') { creating.current = false; setError(String(data.error ?? 'Não foi possível começar o cadastro agora.')); return }
    setId(data.id); setPicked(artistName); setStep(2)
    router.replace(`${V.resumeHrefBase}${data.id}`, { scroll: false })
  }

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    if (!id) return false
    setBusy(true); setError('')
    const { res, data } = await api(`/api/artworks/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    setBusy(false)
    if (!res.ok) { setError(String(data.error ?? 'Não foi possível salvar agora.')); return false }
    return true
  }

  const sheetBody = () => ({
    title: title.trim() && title.trim() !== 'Nova obra' ? title.trim() : undefined, year: yearPatch(year), technique, materials: support, edition, signatureLocation: signature,
    conditionGrade: condition, heightMm: h || null, widthMm: w || null, depthMm: d || null,
    ...(categoryOfTechnique(technique) ? { category: categoryOfTechnique(technique) } : {}),
    acquisitionKind: kind, acquisitionYear: yearPatch(acqYear), acquisitionFrom: from.trim() || null, acquisitionNote: note.trim() || null,
    acquisitionPriceCents: digitsOf(paid) ? reaisDigitsToCents(paid).toString() : null,
  })

  async function upload(slot: string, file: File): Promise<boolean> {
    if (!id) return false
    setBusy(true)
    const form = new FormData(); form.set('kind', slot); form.set('file', file)
    const { res, data } = await api(`/api/artworks/${id}/media`, { method: 'POST', body: form })
    setBusy(false)
    if (!res.ok) { setToast(String(data.error ?? 'Falha ao enviar a foto.')); return false }
    const m = data.media as DraftMedia
    setMedia((prev) => [...prev.filter((x) => x.kind !== slot), m])
    const dups = (data.duplicates as unknown[] | undefined) ?? []
    if (dups.length) setToast('Encontramos uma obra parecida na HouseArt · a equipe confere na certificação')
    return true
  }

  /** "Preencher com as fotos": the reading fills only EMPTY fields (server); the screen takes what came back. */
  async function readPhotos() {
    if (!id) return
    setBusy(true)
    const { res, data } = await api(`/api/artworks/${id}/read-photos`, { method: 'POST' })
    setBusy(false)
    if (!res.ok) { setToast(String(data.error ?? 'Não foi possível ler as fotos agora.')); return }
    const a = (data.applied ?? {}) as Record<string, unknown>
    if (typeof a.title === 'string' && !title.trim()) setTitle(a.title)
    if (typeof a.year === 'number' && !year) setYear(String(a.year))
    // the reading writes free text; the sheet keeps chips ("Óleo sobre tela" → Pintura)
    if (typeof a.technique === 'string' && !technique) setTechnique(techniqueChipOf(a.technique))
    if (typeof a.materials === 'string' && !support) setSupport(supportChipOf(a.materials))
    if (typeof a.edition === 'string' && !edition) setEdition(editionChipOf(a.edition))
    if (typeof a.signatureLocation === 'string' && !signature) setSignature(signatureChipOf(a.signatureLocation))
    setToast(String(data.toast ?? 'Leitura concluída · confira os campos'))
  }

  async function next() {
    setError('')
    const go = (to: number) => { if (fromReview) { setFromReview(false); setStep(4) } else setStep(to) }
    if (step === 0) { if (!kind) return; if (id) { if (!(await patch({ acquisitionKind: kind }))) return; go(2); return } setStep(1); return }
    if (step === 1) { if (id) { go(2); return } await createDraft(); return }
    if (step === 2) { if (!hasFront) { setError('Fotografe ao menos a frente da obra (com o cartão de cor) para seguir.'); return } go(3); return }
    if (step === 3) {
      if (problems.length) { setTried(true); setError(sheetMessage(problems)); return }
      if (await patch(sheetBody())) { setTried(false); setFromReview(false); setStep(4) }
      return
    }
    // the sheet was saved on the way to the review; concluding marks the register done (Coleção › Em cadastro says "Cadastrada")
    if (step === 4 && (await patch({ wizardStep: 5 }))) setDone(true)
  }

  const back = () => { setError(''); if (fromReview) { setFromReview(false); setStep(4); return } setStep(step === 2 && id ? 0 : step - 1) }

  if (done) {
    return (
      <div className="ha-reg ha-reg--done">
        <div className="ha-reg__seal" aria-hidden="true"><Icon name="inventory_2" size={40} /></div>
        <h1 className="ha-reg__h" style={{ textAlign: 'center' }}>Obra cadastrada</h1>
        <span className="ha-reg__lead" style={{ textAlign: 'center' }}>{title.trim() || 'Sem título'} · {artistName}</span>
        <ol className="ha-reg__next" aria-label="Próximos passos">
          {V.nextSteps.map((s, i) => (
            <li key={s.title} className={`ha-reg__next-i${s.done ? ' ha-reg__next-i--done' : i === 1 ? ' ha-reg__next-i--on' : ''}`}>
              <span className="ha-reg__next-dot"><Icon name={s.done ? 'check' : s.icon} size={18} /></span>
              <span className="ha-stack" style={{ gap: 2 }}><b>{s.title}</b><span className="ha-reg__sugg-s">{s.sub}</span></span>
            </li>
          ))}
        </ol>
        <div className="ha-reg__foot">
          {V.kind === 'gallery' ? (
            <Link href="/certification" className="ha-btn ha-btn--outline ha-btn--md ha-reg__cta"><Icon name="verified" size={18} />Certificar agora</Link>
          ) : (
            <button type="button" className="ha-btn ha-btn--outline ha-btn--md ha-reg__cta" onClick={() => setServices(true)}><Icon name="home_repair_service" size={18} />Pedir serviços</button>
          )}
          <Link href={V.exitHref} className="ha-btn ha-btn--ink ha-btn--md ha-reg__cta">{V.exitLabel}</Link>
        </div>
        {services && id ? createPortal(<ServicesSheet open artworkId={id} title={title.trim() || 'Sem título'} sealGreen={false} onClose={() => setServices(false)} onDone={(m) => { setServices(false); setToast(m) }} />, document.body) : null}
        {toast ? <Toast message={toast} onDone={() => setToast('')} /> : null}
      </div>
    )
  }

  const S = V.steps[step]!
  const canGo = step === 0 ? !!kind : step === 1 ? (V.kind === 'gallery' && !free ? pickedId != null : artistName.length >= 2) : step === 2 ? hasFront : true
  const cta = step === 1 && !id ? (busy ? 'Começando…' : 'Continuar para as fotos') : step === 2 ? (hasFront ? 'Continuar para a ficha' : 'Falta a foto da frente') : step === 3 ? 'Revisar' : step === 4 ? (busy ? 'Concluindo…' : 'Concluir cadastro') : 'Continuar'
  const bad = (v: boolean) => (tried && !v ? ' ha-reg__field--bad' : '')

  return (
    <div className="ha-reg">
      <div className="ha-reg__bar">
        {step === 0 ? <Link href={V.exitHref} className="ha-iconbtn ha-reg__x" aria-label="Fechar"><Icon name="close" size={24} /></Link> : <button type="button" className="ha-iconbtn ha-reg__x" aria-label="Voltar" onClick={back}><Icon name="arrow_back" size={24} /></button>}
        <span className="ha-reg__step">Passo {step + 1} de {V.steps.length}</span>
        {id ? <Link href={V.exitHref} className="ha-link ha-link--quiet ha-sm">Salvar e sair</Link> : null}
      </div>
      <div className="ha-reg__segs" aria-hidden="true">{V.steps.map((s, i) => <span key={s.key} className={`ha-reg__seg${i <= step ? ' ha-reg__seg--on' : ''}`} />)}</div>
      <h1 className="ha-reg__h">{S.title}</h1>
      <span className="ha-reg__lead">{S.lead}</span>

      <div className="ha-reg__body">
        {step === 0 ? (
          <div role="radiogroup" aria-label={V.originLabel} className="ha-stack" style={{ gap: 'var(--ha-space-3)' }}>
            {V.originCards.map((c) => (
              <button type="button" key={c.key} role="radio" aria-checked={kind === c.key} className={`ha-reg__origin${kind === c.key ? ' ha-reg__origin--on' : ''}`} onClick={() => setKind(c.key)}>
                <span className="ha-reg__origin-i"><Icon name={c.icon} size={22} /></span>
                <span className="ha-stack" style={{ gap: 2 }}><span className="ha-reg__origin-n">{c.name}</span><span className="ha-reg__origin-s">{c.description}</span></span>
                <Icon name={kind === c.key ? 'radio_button_checked' : 'radio_button_unchecked'} size={22} />
              </button>
            ))}
          </div>
        ) : null}

        {step === 1 && id ? <span className="ha-reg__picked"><Icon name="check_circle" size={18} filled /><b>{picked}</b><span className="ha-reg__sugg-s">Para outro artista, comece um novo cadastro.</span></span> : null}
        {step === 1 && !id ? (<>
          {V.kind === 'gallery' && V.artists?.length && !free && !picked ? (
            <div className="ha-reg__sugg" role="listbox" aria-label="Artistas da galeria">
              {V.artists.map((a) => (
                <button type="button" key={a.id} role="option" aria-selected={false} className="ha-reg__sugg-row" onClick={() => { setPicked(a.name); setPickedId(a.id) }}>
                  <span className="ha-reg__av">{initialsOf(a.name)}</span>
                  <span className="ha-stack" style={{ gap: 2 }}><span className="ha-reg__sugg-n">{a.name}</span><span className="ha-reg__sugg-s">{a.sub}</span></span>
                  <Icon name="chevron_right" size={22} />
                </button>
              ))}
            </div>
          ) : null}
          {V.kind === 'gallery' && !V.artists?.length && !free ? <span className="ha-reg__sugg-s">A galeria ainda não tem artistas cadastrados. Escreva o nome abaixo, ou cadastre em Artistas representados.</span> : null}
          {V.kind === 'gallery' && picked && !free ? <span className="ha-reg__picked"><Icon name="check_circle" size={18} filled /><b>{picked}</b><button type="button" className="ha-link ha-link--quiet ha-sm" onClick={() => { setPicked(''); setPickedId(null); setQ('') }}>Trocar</button></span> : null}
          {V.kind === 'collector' && !free ? (
            <label className="ha-reg__field"><span className="ha-reg__field-k">Artista</span>
              <span className="ha-reg__search"><Icon name="search" size={20} /><input className="ha-input" value={q} placeholder="Nome do artista" autoComplete="off" onChange={(e) => { setQ(e.target.value); setPicked(''); setPickedId(null) }} /></span>
            </label>
          ) : null}
          {V.kind === 'collector' && picked && !free ? <span className="ha-reg__picked"><Icon name="check_circle" size={18} filled /><b>{picked}</b><button type="button" className="ha-link ha-link--quiet ha-sm" onClick={() => { setPicked(''); setPickedId(null); setQ('') }}>Trocar</button></span> : null}
          {V.kind === 'collector' && !free && !picked && term.length >= 2 ? (
            <div className="ha-reg__sugg" role="listbox" aria-label="Sugestões">
              {searching && hits.length === 0 ? <span className="ha-reg__sugg-row ha-muted">Buscando…</span> : null}
              {!searching && hits.length === 0 ? <span className="ha-reg__sugg-row ha-muted">Nenhum artista com esse nome na HouseArt.</span> : null}
              {hits.map((hit) => (
                <button type="button" key={hit.slug} role="option" aria-selected={picked === hit.name} className={`ha-reg__sugg-row${picked === hit.name ? ' ha-reg__sugg-row--on' : ''}`} onClick={() => { setPicked(hit.name); setPickedId(null); setQ(hit.name) }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- public profile photo */}
                  <span className="ha-reg__av">{hit.photoUrl ? <img src={hit.photoUrl} alt="" /> : initialsOf(hit.name)}</span>
                  <span className="ha-stack" style={{ gap: 2 }}><span className="ha-reg__sugg-n">{hit.name}</span>{hit.meta ? <span className="ha-reg__sugg-s">{hit.meta}</span> : null}</span>
                  <Icon name="chevron_right" size={22} />
                </button>
              ))}
            </div>
          ) : null}
          <button type="button" className={`ha-reg__free${free ? ' ha-reg__free--on' : ''}`} onClick={() => { setFree(!free); setPicked(''); setPickedId(null) }}>
            <span className="ha-reg__origin-i"><Icon name="edit" size={20} /></span>
            <span className="ha-stack" style={{ gap: 2 }}><span className="ha-reg__sugg-n">Não está na lista: escrever o nome</span><span className="ha-reg__sugg-s">{V.kind === 'gallery' ? 'O artista entra na sua galeria sem contrato; a equipe confere na certificação.' : 'O artista nasce sem verificação e a equipe confere na certificação.'}</span></span>
            <Icon name={free ? 'radio_button_checked' : 'radio_button_unchecked'} size={22} />
          </button>
          {free ? <label className="ha-reg__field"><span className="ha-reg__field-k">Nome do artista</span><input className="ha-input" value={freeName} maxLength={120} placeholder="Como aparece na assinatura" onChange={(e) => setFreeName(e.target.value)} /></label> : null}
        </>) : null}

        {step === 2 && id ? (<>
          <MediaStep media={media} dims={{ heightMm: h ? Math.round(Number(h.replace(',', '.')) * 10) || null : null, widthMm: w ? Math.round(Number(w.replace(',', '.')) * 10) || null : null }} locked={false} busy={busy} onUpload={upload} onToast={setToast} />
          <span className="ha-reg__sugg-s">Para seguir basta a foto da frente. As {REQUIRED_MEDIA_SLOTS.length} obrigatórias ({requiredDone} feitas) são pedidas só para certificar · dá para completar depois.</span>
        </>) : null}

        {step === 3 ? (<>
          <button type="button" className="ha-reg__ia" onClick={readPhotos} disabled={busy}>
            <Icon name="auto_awesome" size={20} />
            <span className="ha-stack" style={{ gap: 2 }}><b>Preencher com as fotos</b><span className="ha-reg__sugg-s">Lemos a assinatura e o verso e completamos só o que estiver vazio.</span></span>
          </button>
          <span className="ha-reg__picked"><Icon name="person" size={18} /><b>{artistName}</b></span>
          <div className="ha-reg__two">
            <label className={`ha-reg__field${bad(!!title.trim())}`}><span className="ha-reg__field-k">Título</span><input className="ha-input" value={title} maxLength={200} placeholder="Como a obra é conhecida" onChange={(e) => setTitle(e.target.value)} /></label>
            <label className="ha-reg__field"><span className="ha-reg__field-k">Ano <span className="ha-reg__field-n">· da obra</span></span><input className="ha-input" inputMode="numeric" value={year} maxLength={4} placeholder="Ex.: 1998" onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} /></label>
          </div>
          <div className={tried && !technique ? 'ha-reg__field--bad' : undefined}><Chips label="Técnica" options={TECHNIQUE_CHIPS.map((t) => t.label)} value={technique} onChange={setTechnique} /></div>
          <Chips label="Suporte" options={SUPPORT_CHIPS} value={support} onChange={setSupport} />
          <div className="ha-reg__field" role="group" aria-label="Dimensões em centímetros">
            <span className="ha-reg__field-k">Dimensões <span className="ha-reg__field-n">· em cm</span></span>
            <span className="ha-reg__three">
              {([['Altura', h, setH, true], ['Largura', w, setW, true], ['Profundidade', d, setD, false]] as const).map(([k, v, set, req]) => (
                <label key={k} className={`ha-reg__dim${req ? bad(Number(v.replace(',', '.')) > 0) : ''}`}><span>{k}</span><input className="ha-input" inputMode="decimal" value={v} placeholder="0" onChange={(e) => set(e.target.value.replace(/[^\d,.]/g, '').slice(0, 7))} /></label>
              ))}
            </span>
          </div>
          <Chips label="Edição" options={EDITION_CHIPS} value={edition} onChange={setEdition} />
          <Chips label="Assinatura" options={SIGNATURE_CHIPS} value={signature} onChange={setSignature} />
          <div className="ha-reg__field" role="group" aria-label="Estado de conservação">
            <span className="ha-reg__field-k">Estado de conservação</span>
            <span className="ha-reg__chips">{CONDITION_GRADES.map((g) => <button type="button" key={g} aria-pressed={condition === g} className={`ha-reg__chip${condition === g ? ' ha-reg__chip--on' : ''}`} onClick={() => setCondition(condition === g ? null : g)}>{CONDITION_GRADE_LABELS[g]}</button>)}</span>
          </div>
          <h2 className="ha-reg__sub">{V.provenance.title}</h2>
          <label className="ha-reg__field"><span className="ha-reg__field-k">{V.provenance.from.label}</span><input className="ha-input" value={from} maxLength={160} placeholder={V.provenance.from.placeholder} onChange={(e) => setFrom(e.target.value)} /></label>
          <div className="ha-reg__two">
            <label className="ha-reg__field"><span className="ha-reg__field-k">{V.provenance.year.label}</span><input className="ha-input" inputMode="numeric" value={acqYear} maxLength={4} placeholder={V.provenance.year.placeholder} onChange={(e) => setAcqYear(e.target.value.replace(/\D/g, '').slice(0, 4))} /></label>
            <label className="ha-reg__field"><span className="ha-reg__field-k">{V.provenance.paid.label} <span className="ha-reg__field-n">· {V.provenance.paid.note}</span></span>
              <span className="ha-reg__money"><span className="ha-reg__money-pre">R$</span><input inputMode="numeric" value={paid} placeholder="0" onChange={(e) => setPaid(formatThousands(e.target.value))} /></span>
            </label>
          </div>
          <label className="ha-reg__field"><span className="ha-reg__field-k">{V.provenance.note.label} <span className="ha-reg__field-n">· opcional</span></span><textarea className="ha-textarea" rows={3} value={note} maxLength={500} placeholder={V.provenance.note.placeholder} onChange={(e) => setNote(e.target.value)} /></label>
        </>) : null}

        {step === 4 ? (<>
          <div className="ha-reg__rev">
            {/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
            <span className="ha-wall ha-reg__rev-pic">{cover ? <img src={cover} alt="" /> : null}</span>
            <span className="ha-stack" style={{ gap: 4 }}>
              <span className="ha-reg__sugg-s">{artistName}</span>
              <b className="ha-reg__rev-t">{title.trim() || 'Sem título'}</b>
              <span className="ha-reg__sugg-s">{[yearOf(year), [technique, support && `sobre ${support.toLowerCase()}`].filter(Boolean).join(' '), dimensionsLabel(Math.round(Number(h.replace(',', '.')) * 10), Math.round(Number(w.replace(',', '.')) * 10), d ? Math.round(Number(d.replace(',', '.')) * 10) : null)].filter(Boolean).join(' · ')}</span>
            </span>
          </div>
          <ul className="ha-reg__lines">
            {[
              ['Origem', V.originCards.find((c) => c.key === kind)?.name ?? '—', 0],
              ['Fotos', `${media.length} de 10 · ${requiredDone} de ${REQUIRED_MEDIA_SLOTS.length} obrigatórias para certificar`, 2],
              ['Ficha', [edition, signature, condition ? CONDITION_GRADE_LABELS[condition as keyof typeof CONDITION_GRADE_LABELS] : null].filter(Boolean).join(' · ') || 'Técnica e dimensões preenchidas', 3],
              [V.provenance.title, [from.trim(), yearOf(acqYear)].filter(Boolean).join(' · ') || 'Sem dados', 3],
            ].map(([k, v, to]) => (
              <li key={String(k)}><span className="ha-reg__sugg-s">{k}</span><span>{v}</span><button type="button" className="ha-link ha-link--quiet ha-sm" onClick={() => { setFromReview(true); setStep(Number(to)) }}>Editar</button></li>
            ))}
          </ul>
          {requiredDone < REQUIRED_MEDIA_SLOTS.length ? <span className="ha-reg__hint"><Icon name="info" size={18} />Para certificar e vender, complete as {REQUIRED_MEDIA_SLOTS.length} fotos obrigatórias. Você pode concluir o cadastro agora e voltar depois{V.kind === 'gallery' ? ', pelo Acervo' : ''}.</span> : null}
        </>) : null}
        {error ? <span className="ha-reg__err" role="alert">{error}</span> : null}
      </div>

      <div className="ha-reg__foot">
        <button type="button" className="ha-btn ha-btn--primary ha-btn--md ha-reg__cta" disabled={!canGo || busy} aria-busy={busy || undefined} onClick={next}>{cta}</button>
      </div>
      {toast ? <Toast message={toast} onDone={() => setToast('')} /> : null}
    </div>
  )
}
