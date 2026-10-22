'use client'
// Cadastrar obra do colecionador (handoff "HouseArt App Colecionador" › Cadastrar obra): three
// steps — the origin (the three cards of ACQUISITION_KIND_CARDS), the artist (public search with
// suggestions, or "não está na lista: escrever o nome") and the acquisition (title, year, from
// whom, what was paid — it stays with the person —, a note). POST /api/collector/artworks → the
// draft opens in the wizard of the artwork (/artworks/<id>/edit), which does photos, sheet and
// documents. The prototype's "A obra já tem etiqueta HouseArt?" (NFC import) and the "Outro"
// origin have no domain here and are left out.
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { ACQUISITION_KIND_CARDS, type AcquisitionKind } from '@/lib/artworks/domain'
import { digitsOf, formatThousands, reaisDigitsToCents } from './seller-core'
import './register-artwork.css'

interface ArtistHit { slug: string; name: string; meta: string; photoUrl: string | null }

const STEPS = [
  ['Como a obra chegou até você?', 'Isso define quais documentos e serviços fazem sentido para ela.'],
  ['Quem é o artista?', 'Busque pelo nome. Se não estiver na lista, escreva o nome como aparece na assinatura.'],
  ['Sobre a aquisição', 'De quem, quando e por quanto. O valor pago fica só com você.'],
] as const

const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('')

export function RegisterArtworkScreen() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [kind, setKind] = useState<AcquisitionKind | null>(null)
  const [q, setQ] = useState('')
  // The last answered search: "searching" is derived (the term typed is not the one answered yet).
  const [answer, setAnswer] = useState<{ term: string; hits: ArtistHit[] }>({ term: '', hits: [] })
  const [picked, setPicked] = useState<string>('')
  const [free, setFree] = useState(false)
  const [freeName, setFreeName] = useState('')
  const [title, setTitle] = useState('')
  const [year, setYear] = useState('')
  const [from, setFrom] = useState('')
  const [paid, setPaid] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) return
    let gone = false
    const t = window.setTimeout(() => {
      fetch(`/api/public/search?q=${encodeURIComponent(term)}`).then(async (r) => {
        const d = (await r.json().catch(() => ({}))) as { artists?: ArtistHit[] }
        if (!gone) setAnswer({ term, hits: (d.artists ?? []).slice(0, 8) })
      }).catch(() => { if (!gone) setAnswer({ term, hits: [] }) })
    }, 250)
    return () => { gone = true; window.clearTimeout(t) }
  }, [q])
  const term = q.trim()
  const searching = term.length >= 2 && answer.term !== term
  const hits = answer.term === term ? answer.hits : []

  const artistName = free ? freeName.trim() : picked
  const ok = step === 0 ? !!kind : step === 1 ? artistName.length >= 2 : true
  const yearNum = Number(year)

  async function submit() {
    if (!kind || !artistName) return
    setBusy(true); setError('')
    const body = {
      acquisitionKind: kind, artistName, title: title.trim() || undefined,
      acquisitionYear: /^\d{4}$/.test(year) && yearNum > 1800 && yearNum < 2200 ? yearNum : undefined,
      acquisitionFrom: from.trim() || undefined, acquisitionNote: note.trim() || undefined,
      acquisitionPriceCents: digitsOf(paid) ? reaisDigitsToCents(paid).toString() : undefined,
    }
    const res = await fetch('/api/collector/artworks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const d = (await res.json().catch(() => ({}))) as { href?: string; error?: string }
    if (!res.ok || !d.href) { setBusy(false); setError(d.error ?? 'Não foi possível cadastrar agora.'); return }
    router.push(d.href)
  }

  return (
    <div className="ha-reg">
      <div className="ha-reg__bar">
        {step === 0 ? <Link href="/wallet" className="ha-iconbtn ha-reg__x" aria-label="Fechar"><Icon name="close" size={24} /></Link> : <button type="button" className="ha-iconbtn ha-reg__x" aria-label="Voltar" onClick={() => setStep(step - 1)}><Icon name="arrow_back" size={24} /></button>}
        <span className="ha-reg__step">Passo {step + 1} de 3</span>
      </div>
      <div className="ha-reg__segs" aria-hidden="true">{STEPS.map((s, i) => <span key={s[0]} className={`ha-reg__seg${i <= step ? ' ha-reg__seg--on' : ''}`} />)}</div>
      <h1 className="ha-reg__h">{STEPS[step][0]}</h1>
      <span className="ha-reg__lead">{STEPS[step][1]}</span>

      <div className="ha-reg__body">
        {step === 0 ? (
          <div role="radiogroup" aria-label="Origem da obra" className="ha-stack" style={{ gap: 'var(--ha-space-3)' }}>
            {ACQUISITION_KIND_CARDS.map((c) => (
              <button type="button" key={c.key} role="radio" aria-checked={kind === c.key} className={`ha-reg__origin${kind === c.key ? ' ha-reg__origin--on' : ''}`} onClick={() => setKind(c.key)}>
                <span className="ha-reg__origin-i"><Icon name={c.icon} size={22} /></span>
                <span className="ha-stack" style={{ gap: 2 }}><span className="ha-reg__origin-n">{c.name}</span><span className="ha-reg__origin-s">{c.description}</span></span>
                <Icon name={kind === c.key ? 'radio_button_checked' : 'radio_button_unchecked'} size={22} />
              </button>
            ))}
          </div>
        ) : null}

        {step === 1 ? (<>
          {!free ? (
            <label className="ha-reg__field"><span className="ha-reg__field-k">Artista</span>
              <span className="ha-reg__search"><Icon name="search" size={20} /><input className="ha-input" value={q} placeholder="Nome do artista" autoComplete="off" onChange={(e) => { setQ(e.target.value); setPicked('') }} /></span>
            </label>
          ) : null}
          {picked && !free ? <span className="ha-reg__picked"><Icon name="check_circle" size={18} filled /><b>{picked}</b><button type="button" className="ha-link ha-link--quiet ha-sm" onClick={() => { setPicked(''); setQ('') }}>Trocar</button></span> : null}
          {!free && !picked && q.trim().length >= 2 ? (
            <div className="ha-reg__sugg" role="listbox" aria-label="Sugestões">
              {searching && hits.length === 0 ? <span className="ha-reg__sugg-row ha-muted">Buscando…</span> : null}
              {!searching && hits.length === 0 ? <span className="ha-reg__sugg-row ha-muted">Nenhum artista com esse nome na HouseArt.</span> : null}
              {hits.map((h) => (
                <button type="button" key={h.slug} role="option" aria-selected={picked === h.name} className={`ha-reg__sugg-row${picked === h.name ? ' ha-reg__sugg-row--on' : ''}`} onClick={() => { setPicked(h.name); setQ(h.name) }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- public profile photo */}
                  <span className="ha-reg__av">{h.photoUrl ? <img src={h.photoUrl} alt="" /> : initialsOf(h.name)}</span>
                  <span className="ha-stack" style={{ gap: 2 }}><span className="ha-reg__sugg-n">{h.name}</span>{h.meta ? <span className="ha-reg__sugg-s">{h.meta}</span> : null}</span>
                  <Icon name="chevron_right" size={22} />
                </button>
              ))}
            </div>
          ) : null}
          <button type="button" className={`ha-reg__free${free ? ' ha-reg__free--on' : ''}`} onClick={() => { setFree(!free); setPicked('') }}>
            <span className="ha-reg__origin-i"><Icon name="edit" size={20} /></span>
            <span className="ha-stack" style={{ gap: 2 }}><span className="ha-reg__sugg-n">Não está na lista: escrever o nome</span><span className="ha-reg__sugg-s">O artista nasce sem verificação e a equipe confere na certificação.</span></span>
            <Icon name={free ? 'radio_button_checked' : 'radio_button_unchecked'} size={22} />
          </button>
          {free ? <label className="ha-reg__field"><span className="ha-reg__field-k">Nome do artista</span><input className="ha-input" value={freeName} maxLength={120} placeholder="Como aparece na assinatura" onChange={(e) => setFreeName(e.target.value)} /></label> : null}
        </>) : null}

        {step === 2 ? (<>
          <label className="ha-reg__field"><span className="ha-reg__field-k">Título da obra <span className="ha-reg__field-n">· opcional, dá para completar depois</span></span><input className="ha-input" value={title} maxLength={200} placeholder="Ex.: Sem título" onChange={(e) => setTitle(e.target.value)} /></label>
          <div className="ha-reg__two">
            <label className="ha-reg__field"><span className="ha-reg__field-k">Ano da aquisição</span><input className="ha-input" inputMode="numeric" value={year} maxLength={4} placeholder="Ex.: 2019" onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} /></label>
            <label className="ha-reg__field"><span className="ha-reg__field-k">Valor pago <span className="ha-reg__field-n">· fica só com você</span></span>
              <span className="ha-reg__money"><span className="ha-reg__money-pre">R$</span><input inputMode="numeric" value={paid} placeholder="0" onChange={(e) => setPaid(formatThousands(e.target.value))} /></span>
            </label>
          </div>
          <label className="ha-reg__field"><span className="ha-reg__field-k">De quem você adquiriu</span><input className="ha-input" value={from} maxLength={160} placeholder="Galeria, feira, pessoa ou família" onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="ha-reg__field"><span className="ha-reg__field-k">Observações <span className="ha-reg__field-n">· opcional</span></span><textarea className="ha-textarea" rows={3} value={note} maxLength={500} placeholder="História da obra, exposições, restauros anteriores…" onChange={(e) => setNote(e.target.value)} /></label>
          {error ? <span className="ha-reg__err" role="alert">{error}</span> : null}
        </>) : null}
      </div>

      <div className="ha-reg__foot">
        {step < 2 ? (
          <button type="button" className="ha-btn ha-btn--primary ha-btn--md ha-reg__cta" disabled={!ok} onClick={() => setStep(step + 1)}>Continuar</button>
        ) : (
          <button type="button" className="ha-btn ha-btn--primary ha-btn--md ha-reg__cta" disabled={busy} aria-busy={busy || undefined} onClick={submit}>{busy ? 'Cadastrando…' : 'Cadastrar obra'}</button>
        )}
      </div>
    </div>
  )
}
