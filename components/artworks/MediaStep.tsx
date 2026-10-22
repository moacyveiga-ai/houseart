'use client'
// Step "Mídia" of the artwork wizard = step 1 of the prototype "HouseArt App
// Colecionador › Cadastrar obra" (Fotos guiadas): the summary line, the grid of
// the ten slots (required first; status Obrigatória / Opcional / Pronta /
// Ajustada / Desfocada; the "Capa" badge on the front), the block "Como
// fotografar bem" and the guided capture that each card opens.
import { useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { CAPTURE_TIPS } from '@/lib/artworks/domain'
import { CAPTURE_ORDER, slotStateOf, summaryOf, type SlotMedia } from './capture-core'
import { GuidedCapture } from './GuidedCapture'
import './capture.css'

export function MediaStep({ media, dims, locked, busy, onUpload, onToast }: {
  media: SlotMedia[]
  dims: { heightMm: number | null; widthMm: number | null }
  locked: boolean
  busy: boolean
  onUpload: (kind: string, file: File) => Promise<boolean>
  onToast: (msg: string) => void
}) {
  const [captureKind, setCaptureKind] = useState<string | null>(null)
  // the server keeps no "adjusted" flag: this session remembers which slots went through the editor with changes
  const [adjusted, setAdjusted] = useState<Set<string>>(() => new Set())
  const summary = summaryOf(media)

  const upload = async (kind: string, file: File, wasAdjusted: boolean) => {
    const ok = await onUpload(kind, file)
    if (ok) setAdjusted((prev) => { const n = new Set(prev); if (wasAdjusted) n.add(kind); else n.delete(kind); return n })
    return ok
  }

  const nextRequired = CAPTURE_ORDER.find((s) => s.required && !media.some((m) => m.kind === s.kind))

  return (
    <div className="ha-stack ha-cap-step">
      <div className="ha-cap-summary">
        <Icon name="photo_library" size={22} />
        <span className="ha-cap-summary__main">{summary.required}</span>
        <span className="ha-cap-summary__total">{summary.total}</span>
      </div>

      <div className="ha-cap-grid">
        {CAPTURE_ORDER.map((slot) => {
          const m = media.find((x) => x.kind === slot.kind)
          const st = slotStateOf(slot, m, adjusted.has(slot.kind))
          return (
            <button key={slot.kind} type="button" className={`ha-cap-card${st.done ? ' ha-cap-card--done' : slot.required ? ' ha-cap-card--required' : ''}`} disabled={locked || busy} onClick={() => setCaptureKind(slot.kind)} aria-label={`${slot.name} · ${st.label}`}>
              <span className="ha-cap-card__pic">
                {/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
                {m?.publicUrl ? <img src={m.publicUrl} alt="" /> : null}
                {!m ? <span className="ha-cap-card__empty"><Icon name={slot.icon} size={30} /><span>Fotografar</span></span> : null}
                {st.done ? <span className={`ha-cap-card__check${st.blurry ? ' ha-cap-card__check--alert' : ''}`}><Icon name={st.blurry ? 'priority_high' : 'check'} size={15} /></span> : null}
                {st.cover ? <span className="ha-cap-card__cover">Capa</span> : null}
              </span>
              <span className="ha-cap-card__text">
                <span className="ha-cap-card__name">{slot.name}</span>
                <span className={`ha-cap-card__st ha-cap-card__st--${st.tone}`}>{st.label}</span>
              </span>
            </button>
          )
        })}
      </div>

      {!locked ? (
        <div className="ha-row ha-cap-step__cta">
          <button type="button" className="ha-btn ha-btn--ink ha-btn--md" disabled={busy} onClick={() => setCaptureKind((nextRequired ?? CAPTURE_ORDER[0]).kind)}>
            <Icon name="add_a_photo" size={20} />{nextRequired ? `Fotografar · ${nextRequired.name}` : 'Fotografar de novo'}
          </button>
          <p className="ha-muted ha-sm">No celular a câmera guia cada foto; no computador, escolha o arquivo: ele passa pelo mesmo editor.</p>
        </div>
      ) : null}

      <div className="ha-cap-tips">
        <span className="ha-cap-tips__title">Como fotografar bem</span>
        {CAPTURE_TIPS.map((t) => <span key={t.icon} className="ha-cap-tips__row"><Icon name={t.icon} size={18} />{t.text}</span>)}
      </div>

      {captureKind ? (
        <GuidedCapture startKind={captureKind} media={media} dims={dims} busy={busy} onUpload={upload} onClose={() => setCaptureKind(null)} onToast={onToast} />
      ) : null}
    </div>
  )
}
