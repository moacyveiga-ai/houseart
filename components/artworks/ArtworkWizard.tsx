'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { Stepper } from '@/components/ds/Stepper'
import { Toast } from '@/components/ds/Toast'
import { CONDITION_GRADES, CONDITION_GRADE_LABELS, CONDITION_REGIONS, CONDITION_REGION_LABELS, HISTORY_KINDS, HISTORY_KIND_LABELS, MEDIA_QUALITY_LABELS, MEDIA_SLOTS, SALE_MODE_CARDS, WIZARD_STEPS } from '@/lib/artworks/domain'
import { nextLabel, regionStateLabel, reviewLines, sheetPatch, STEP_COUNT, type WizardHistory, type WizardMedia, type WizardRegion, type WizardState } from './wizard-core'

export interface WizardArtwork extends WizardState {
  id: number
  status: string
  conditionBy: string | null
  conditionAt: string | null
  wizardStep: number
  artistName: string
  duplicates: { id: number; similarityBps: number; candidate: { title: string; year: number | null; publicId: string | null; mine: boolean } }[]
}

type SaveState = 'saved' | 'saving' | 'error'

async function api(url: string, init: RequestInit) {
  const res = await fetch(url, init)
  const data = await res.json().catch(() => ({})) as Record<string, unknown>
  return { res, data }
}

export function ArtworkWizard({ initial, userName }: { initial: WizardArtwork; userName: string }) {
  const [a, setA] = useState<WizardArtwork>(initial)
  const [step, setStep] = useState(Math.min(initial.wizardStep, STEP_COUNT - 1))
  const [save, setSave] = useState<SaveState>('saved')
  const [toast, setToast] = useState('')
  const [busy, setBusy] = useState(false)
  const timer = useRef<number | null>(null)
  const locked = a.status !== 'DRAFT'

  const patch = useCallback(async (body: Record<string, unknown>) => {
    setSave('saving')
    const { res } = await api(`/api/artworks/${a.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    setSave(res.ok ? 'saved' : 'error')
  }, [a.id])

  /** Autosave (800 ms) of the sheet after each change. */
  const scheduleSheet = useCallback((next: WizardArtwork) => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void patch(sheetPatch(next)), 800)
  }, [patch])

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  const field = (key: keyof WizardState, value: string) => {
    const numeric = ['year', 'heightMm', 'widthMm', 'depthMm'].includes(key)
    let v: string | number | null = value === '' ? null : value
    if (numeric && v !== null) {
      const n = Number(String(v).replace(',', '.'))
      v = Number.isFinite(n) ? (key === 'year' ? Math.round(n) : Math.round(n * 10)) : null
    }
    const next = { ...a, [key]: v } as WizardArtwork
    setA(next); scheduleSheet(next)
  }

  async function upload(kind: string, file: File) {
    setBusy(true)
    const form = new FormData(); form.set('kind', kind); form.set('file', file)
    const { res, data } = await api(`/api/artworks/${a.id}/media`, { method: 'POST', body: form })
    setBusy(false)
    if (!res.ok) { setToast(String(data.error ?? 'Falha ao enviar a foto.')); return }
    const media = data.media as WizardMedia
    const dups = (data.duplicates as { id: number; similarityBps: number; candidateArtworkId: number }[] | undefined) ?? []
    setA((prev) => ({
      ...prev,
      media: [...prev.media.filter((m) => m.kind !== kind), media],
      duplicates: dups.length ? dups.map((d) => ({ id: d.id, similarityBps: d.similarityBps, candidate: { title: 'Obra parecida', year: null, publicId: null, mine: false } })) : prev.duplicates,
    }))
    if (dups.length) window.location.reload()
  }

  async function decideDuplicate(checkId: number, decision: 'DIFFERENT' | 'SAME') {
    const { res } = await api(`/api/artworks/${a.id}/duplicates/${checkId}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ decision }) })
    if (res.ok) {
      if (decision === 'SAME') { window.location.assign('/artworks'); return }
      setA((prev) => ({ ...prev, duplicates: prev.duplicates.filter((d) => d.id !== checkId) }))
    }
  }

  const saveRegions = (regions: WizardRegion[], grade: string | null) => {
    setA((prev) => ({ ...prev, conditionRegions: regions, conditionGrade: grade }))
    void patch({ conditionGrade: grade, conditionRegions: regions })
  }
  const saveHistory = (items: WizardHistory[]) => {
    setA((prev) => ({ ...prev, historyItems: items }))
    void patch({ historyItems: items })
  }
  const savePrice = (saleMode: string | null, listPriceCents: number | null) => {
    setA((prev) => ({ ...prev, saleMode, listPriceCents }))
    void patch({ saleMode, listPriceCents })
  }

  async function next() {
    if (step < STEP_COUNT - 1) {
      const s = step + 1
      setStep(s); void patch({ wizardStep: s })
      return
    }
    setBusy(true)
    const { res, data } = await api(`/api/artworks/${a.id}/submit`, { method: 'POST' })
    setBusy(false)
    if (!res.ok) { setToast(String(data.error ?? 'Não foi possível enviar.')); return }
    setToast('Obra enviada para certificação.')
    window.setTimeout(() => window.location.assign('/certification'), 900)
  }

  const regionOf = (region: string): WizardRegion => a.conditionRegions.find((r) => r.region === region) ?? { region, note: '', state: 'INTACT' }
  const today = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Bahia' })

  return (
    <div className="ha-page">
      <div className="ha-page__head">
        <div>
          <div className="ha-eyebrow">{locked ? 'Obra' : 'Nova obra'}</div>
          <h1 className="ha-h1">{a.title || 'Sem título'}</h1>
        </div>
        <div className="ha-muted ha-sm ha-row">
          <Icon name={save === 'saving' ? 'cloud_sync' : save === 'error' ? 'cloud_off' : 'cloud_done'} size={18} />
          {save === 'saving' ? 'Salvando…' : save === 'error' ? 'Falha ao salvar' : 'Salvo automaticamente'}
        </div>
      </div>
      <div className="ha-wizard">
        <aside>
          <Stepper steps={WIZARD_STEPS} current={step} />
        </aside>
        <section className="ha-stack">
          <h2 className="ha-h3">{WIZARD_STEPS[step]}</h2>
          {locked ? <div className="ha-callout">Esta obra já foi enviada para certificação; a ficha fica congelada até a mesa concluir.</div> : null}

          {a.duplicates.length > 0 ? (
            <div className="ha-callout ha-callout--warn">
              <div className="ha-row"><Icon name="image_search" size={20} /><b>Encontramos uma obra parecida</b></div>
              {a.duplicates.map((d) => (
                <div key={d.id} className="ha-row">
                  <span>{d.candidate.title}{d.candidate.year ? `, ${d.candidate.year}` : ''}{d.candidate.publicId ? ` · ${d.candidate.publicId}` : ''}{d.candidate.mine ? ' · da sua conta' : ''} · {Math.round(d.similarityBps / 100)}% semelhante</span>
                  <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" onClick={() => decideDuplicate(d.id, 'DIFFERENT')}>São obras diferentes</button>
                  <button type="button" className="ha-btn ha-btn--ink ha-btn--sm" onClick={() => decideDuplicate(d.id, 'SAME')}>É a mesma obra</button>
                </div>
              ))}
            </div>
          ) : null}

          {step === 0 ? (
            <fieldset disabled={locked} className="ha-form-grid">
              <label className="ha-label ha-col-span">Título<input className="ha-input" value={a.title} onChange={(e) => field('title', e.target.value)} /></label>
              <label className="ha-label">Ano<input className="ha-input ha-input--num" inputMode="numeric" value={a.year ?? ''} onChange={(e) => field('year', e.target.value)} /></label>
              <label className="ha-label">Técnica<input className="ha-input" value={a.technique ?? ''} onChange={(e) => field('technique', e.target.value)} /></label>
              <label className="ha-label ha-col-span">Materiais<input className="ha-input" value={a.materials ?? ''} onChange={(e) => field('materials', e.target.value)} /></label>
              <label className="ha-label">Altura (cm)<input className="ha-input ha-input--num" inputMode="decimal" value={a.heightMm === null ? '' : a.heightMm / 10} onChange={(e) => field('heightMm', e.target.value)} /></label>
              <label className="ha-label">Largura (cm)<input className="ha-input ha-input--num" inputMode="decimal" value={a.widthMm === null ? '' : a.widthMm / 10} onChange={(e) => field('widthMm', e.target.value)} /></label>
              <label className="ha-label">Profundidade (cm)<input className="ha-input ha-input--num" inputMode="decimal" placeholder="3,5" value={a.depthMm === null ? '' : a.depthMm / 10} onChange={(e) => field('depthMm', e.target.value)} /></label>
              <label className="ha-label">Edição / tiragem<input className="ha-input" placeholder="Obra única" value={a.edition ?? ''} onChange={(e) => field('edition', e.target.value)} /></label>
              <label className="ha-label">Assinatura<input className="ha-input" placeholder="Verso, canto inferior esquerdo" value={a.signatureLocation ?? ''} onChange={(e) => field('signatureLocation', e.target.value)} /></label>
              <label className="ha-label">Série<input className="ha-input" value={a.series ?? ''} onChange={(e) => field('series', e.target.value)} /></label>
              <p className="ha-muted ha-sm ha-col-span">Artista: {a.artistName}</p>
            </fieldset>
          ) : null}

          {step === 1 ? (
            <div className="ha-stack">
              <div className="ha-grid-cards ha-grid-cards--3">
                {MEDIA_SLOTS.map((slot) => {
                  const m = a.media.find((x) => x.kind === slot.kind)
                  const q = m?.quality ?? 'PENDING'
                  return (
                    <label key={slot.kind} className={`ha-media-slot${m ? ' ha-media-slot--has' : ''}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
                      {m?.publicUrl ? <img src={m.publicUrl} alt={slot.name} /> : <Icon name="add_a_photo" size={28} />}
                      <span className="ha-media-slot__name">{slot.name}</span>
                      <span className={`ha-media-slot__q ha-media-slot__q--${q.toLowerCase()}`}>{MEDIA_QUALITY_LABELS[q as keyof typeof MEDIA_QUALITY_LABELS] ?? q}</span>
                      <input type="file" accept="image/*" className="ha-sr" disabled={locked || busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(slot.kind, f) }} />
                      <span className="ha-btn ha-btn--outline ha-btn--xs">{m ? 'Trocar' : 'Enviar'}</span>
                    </label>
                  )
                })}
              </div>
              <p className="ha-muted ha-sm">No celular, o app guia a captura: frontal com cartão de cor, 4 macros em regiões fixas e verso.</p>
            </div>
          ) : null}

          {step === 2 ? (
            <fieldset disabled={locked} className="ha-stack">
              <div className="ha-label">Estado geral</div>
              <div className="ha-row" role="group">
                {CONDITION_GRADES.map((g) => (
                  <button type="button" key={g} className={`ha-chip${a.conditionGrade === g ? ' ha-chip--on' : ''}`} aria-pressed={a.conditionGrade === g} onClick={() => saveRegions(a.conditionRegions, g)}>{CONDITION_GRADE_LABELS[g]}</button>
                ))}
              </div>
              <ul className="ha-list">
                {CONDITION_REGIONS.map((region) => {
                  const r = regionOf(region)
                  return (
                    <li key={region} className="ha-list__row">
                      <span style={{ minWidth: 160 }}><b>{CONDITION_REGION_LABELS[region]}</b></span>
                      <input className="ha-input" placeholder="Sem alterações" value={r.note} onChange={(e) => {
                        const regions = CONDITION_REGIONS.map((k) => (k === region ? { ...regionOf(k), note: e.target.value } : regionOf(k)))
                        setA((prev) => ({ ...prev, conditionRegions: regions }))
                      }} onBlur={() => saveRegions(CONDITION_REGIONS.map(regionOf), a.conditionGrade)} />
                      <select className="ha-select" value={r.state} onChange={(e) => saveRegions(CONDITION_REGIONS.map((k) => (k === region ? { ...regionOf(k), state: e.target.value } : regionOf(k))), a.conditionGrade)}>
                        {['INTACT', 'ATTENTION', 'DAMAGED'].map((st) => <option key={st} value={st}>{regionStateLabel(st)}</option>)}
                      </select>
                    </li>
                  )
                })}
              </ul>
              <p className="ha-muted ha-sm">Responsável: {a.conditionBy ?? userName} · {today}</p>
            </fieldset>
          ) : null}

          {step === 3 ? (
            <HistoryEditor items={a.historyItems} locked={locked} onChange={saveHistory} />
          ) : null}

          {step === 4 ? (
            <fieldset disabled={locked} className="ha-stack">
              <div className="ha-label">Modalidade</div>
              <div className="ha-grid-cards ha-grid-cards--3">
                {SALE_MODE_CARDS.map((m) => (
                  <button type="button" key={m.key} className={`ha-radio-card${a.saleMode === m.key ? ' ha-radio-card--on' : ''}`} onClick={() => savePrice(m.key, a.listPriceCents)}>
                    <span className="ha-radio-card__dot" /><span><b>{m.name}</b><br /><span className="ha-muted ha-sm">{m.description}</span></span>
                  </button>
                ))}
              </div>
              {a.saleMode !== 'ON_REQUEST' ? (
                <label className="ha-label">Preço (R$)
                  <input className="ha-input ha-input--num" inputMode="numeric" value={a.listPriceCents === null ? '' : String(Math.round(a.listPriceCents / 100))}
                    onChange={(e) => setA((prev) => ({ ...prev, listPriceCents: e.target.value === '' ? null : Math.round(Number(e.target.value.replace(/\D/g, '')) * 100) }))}
                    onBlur={() => savePrice(a.saleMode, a.listPriceCents)} />
                </label>
              ) : null}
              <p className="ha-muted ha-sm">A estimativa de referência aparece quando houver vendas comparáveis registradas. Não é laudo.</p>
            </fieldset>
          ) : null}

          {step === 5 ? (
            <div className="ha-kv">
              {reviewLines(a).flatMap((l) => [<span key={`k-${l.k}`}>{l.k}</span>, <span key={`v-${l.k}`}>{l.v}</span>])}
            </div>
          ) : null}

          <div className="ha-row ha-row--end">
            <button type="button" className="ha-btn ha-btn--outline ha-btn--md" disabled={step === 0} onClick={() => { const s = step - 1; setStep(s); void patch({ wizardStep: s }) }}>Voltar</button>
            {!locked || step < STEP_COUNT - 1 ? (
              <button type="button" className="ha-btn ha-btn--primary ha-btn--md" disabled={busy || (locked && step === STEP_COUNT - 1)} onClick={next}>{nextLabel(step)}</button>
            ) : null}
          </div>
        </section>
      </div>
      <Toast message={toast} onDone={() => setToast('')} />
    </div>
  )
}

function HistoryEditor({ items, locked, onChange }: { items: WizardHistory[]; locked: boolean; onChange: (items: WizardHistory[]) => void }) {
  const [draft, setDraft] = useState<WizardHistory>({ kind: 'EXHIBITION', description: '', occurredOn: '' })
  const valid = draft.description.trim().length > 0 && /^\d{4}-(0[1-9]|1[0-2])$/.test(draft.occurredOn)
  return (
    <fieldset disabled={locked} className="ha-stack">
      {items.length === 0 ? <p className="ha-muted">Nenhum item ainda.</p> : (
        <ul className="ha-list">
          {items.map((h, i) => (
            <li key={i} className="ha-list__row">
              <span className="ha-badge ha-badge--neutral">{HISTORY_KIND_LABELS[h.kind as keyof typeof HISTORY_KIND_LABELS] ?? h.kind}</span>
              <span style={{ flex: 1 }}>{h.description}</span>
              <span className="ha-muted ha-sm">{h.occurredOn.slice(5)}/{h.occurredOn.slice(0, 4)}</span>
              <button type="button" className="ha-iconbtn" aria-label="Remover" onClick={() => onChange(items.filter((_, j) => j !== i))}><Icon name="close" size={16} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="ha-row">
        <select className="ha-select" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
          {HISTORY_KINDS.map((k) => <option key={k} value={k}>{HISTORY_KIND_LABELS[k]}</option>)}
        </select>
        <input className="ha-input" placeholder="Descrição" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        <input className="ha-input ha-input--num" type="month" value={draft.occurredOn} onChange={(e) => setDraft({ ...draft, occurredOn: e.target.value })} />
        <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" disabled={!valid} onClick={() => { onChange([...items, draft]); setDraft({ kind: 'EXHIBITION', description: '', occurredOn: '' }) }}><Icon name="add" size={16} />Adicionar</button>
      </div>
    </fieldset>
  )
}
