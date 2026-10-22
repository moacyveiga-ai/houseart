'use client'
// Step 2 of the prototype "HouseArt App Colecionador › Cadastrar obra" (Ajuste
// as fotos): the photo on a canvas, the tool bar Auto · Recortar · Luz · Cor ·
// Reflexo, the sliders, "Ver original" (hold), "Refazer" and "Usar esta foto".
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Icon } from '@/components/ds/Icon'
import type { MediaSlot } from '@/lib/artworks/domain'
import {
  artworkCrop, autoAdjust, autoItems, dragCorner, EDITOR_TOOLS, EMPTY_ADJ, EXPORT_MAX_SIDE, FULL_CROP, isAdjusted, SLIDERS, sliderValueLabel,
  type Adjustments, type CropRect, type EditorTool,
} from './capture-core'
import { canvasToJpeg, renderFrame } from './capture-render'

export interface EditorThumb { kind: string; name: string; url: string | null }

export function PhotoEditor({ slot, source, dims, thumbs, busy, onUse, onRetake }: {
  slot: MediaSlot
  source: HTMLImageElement
  dims: { heightMm: number | null; widthMm: number | null }
  /** the photos already taken (prototype: thumbnails under the canvas) */
  thumbs: EditorThumb[]
  busy: boolean
  onUse: (file: File, adjusted: boolean) => Promise<boolean>
  onRetake: () => void
}) {
  const [adj, setAdj] = useState<Adjustments>(EMPTY_ADJ)
  const [crop, setCrop] = useState<CropRect>(FULL_CROP)
  const [tool, setTool] = useState<EditorTool>('auto')
  const [original, setOriginal] = useState(false)
  const [rendering, setRendering] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const drag = useRef<{ corner: 'tl' | 'tr' | 'bl' | 'br'; x: number; y: number; crop: CropRect } | null>(null)

  const cropping = tool === 'crop' && !original
  const corners: ('tl' | 'tr' | 'bl' | 'br')[] = ['tl', 'tr', 'bl', 'br']

  // the preview: the cropped result, or the whole frame with the crop window while cropping
  useEffect(() => {
    const c = canvas.current
    if (!c) return
    renderFrame(c, source, adj, cropping ? FULL_CROP : crop, { maxSide: 1024, original })
  }, [source, adj, crop, cropping, original])

  const set = (patch: Partial<Adjustments>) => setAdj((a) => ({ ...a, ...patch }))

  const applyAuto = () => {
    set(autoAdjust(slot.kind, adj))
    const { w, h } = { w: source.naturalWidth, h: source.naturalHeight }
    setCrop(artworkCrop(w, h, dims))
  }
  const cropToArtwork = () => {
    if (adj.crop) { set({ crop: false }); setCrop(FULL_CROP); return }
    set({ crop: true }); setCrop(artworkCrop(source.naturalWidth, source.naturalHeight, dims))
  }
  const reset = () => { setAdj(EMPTY_ADJ); setCrop(FULL_CROP) }

  const onCornerDown = (corner: 'tl' | 'tr' | 'bl' | 'br') => (e: ReactPointerEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { corner, x: e.clientX, y: e.clientY, crop }
  }
  const onCornerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current, f = frame.current
    if (!d || !f) return
    const r = f.getBoundingClientRect()
    setCrop(dragCorner(d.crop, d.corner, (e.clientX - d.x) / r.width, (e.clientY - d.y) / r.height))
  }
  const onCornerUp = () => {
    if (drag.current) set({ crop: true })
    drag.current = null
  }

  const use = useCallback(async () => {
    setRendering(true)
    try {
      const out = document.createElement('canvas')
      renderFrame(out, source, adj, crop, { maxSide: EXPORT_MAX_SIDE })
      const blob = await canvasToJpeg(out)
      const file = new File([blob], `${slot.kind.toLowerCase()}.jpg`, { type: 'image/jpeg' })
      await onUse(file, isAdjusted(adj))
    } finally { setRendering(false) }
  }, [source, adj, crop, slot.kind, onUse])

  const sliders = tool === 'light' ? SLIDERS.light : tool === 'color' ? SLIDERS.color : tool === 'crop' ? SLIDERS.crop : []
  const working = busy || rendering

  return (
    <div className="ha-cap-editor">
      <div className="ha-cap-editor__head">
        <div>
          <div className="ha-cap-editor__title">Ajuste a foto</div>
          <div className="ha-cap-editor__sub">{slot.name} · melhore luz e cor, endireite e recorte. A original fica guardada.</div>
        </div>
      </div>

      <div ref={frame} className={`ha-cap-frame${cropping ? ' ha-cap-frame--crop' : ''}`}>
        <canvas ref={canvas} className="ha-cap-frame__canvas" aria-label={`Prévia · ${slot.name}`} />
        {cropping ? (
          <div className="ha-cap-crop" style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }}>
            <span className="ha-cap-crop__line ha-cap-crop__line--h1" /><span className="ha-cap-crop__line ha-cap-crop__line--h2" />
            <span className="ha-cap-crop__line ha-cap-crop__line--v1" /><span className="ha-cap-crop__line ha-cap-crop__line--v2" />
            {corners.map((k) => (
              <button key={k} type="button" className={`ha-cap-crop__corner ha-cap-crop__corner--${k}`} aria-label={`Canto ${k}`} onPointerDown={onCornerDown(k)} onPointerMove={onCornerMove} onPointerUp={onCornerUp} onPointerCancel={onCornerUp} />
            ))}
          </div>
        ) : null}
        {original ? <span className="ha-cap-frame__tag">Original</span> : null}
        {tool === 'reflex' && !adj.reflex && !original ? <span className="ha-cap-frame__glare" aria-hidden /> : null}
      </div>

      {thumbs.length ? (
        <div className="ha-cap-thumbs" aria-label="Fotos feitas">
          {thumbs.map((t) => (
            <span key={t.kind} className={`ha-cap-thumb${t.kind === slot.kind ? ' ha-cap-thumb--on' : ''}`} title={t.name}>
              {/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
              {t.url ? <img src={t.url} alt={t.name} /> : <Icon name="photo" size={18} />}
            </span>
          ))}
        </div>
      ) : null}

      <div className="ha-cap-tools" role="tablist" aria-label="Ferramentas">
        {EDITOR_TOOLS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tool === t.key} className={`ha-cap-tool${tool === t.key ? ' ha-cap-tool--on' : ''}`} onClick={() => setTool(t.key)}>
            <Icon name={t.icon} size={20} />{t.name}
          </button>
        ))}
      </div>

      {tool === 'auto' ? (
        <div className="ha-stack ha-stack--3">
          <button type="button" className={`ha-btn ha-btn--md ${adj.auto ? 'ha-btn--outline' : 'ha-btn--primary'}`} onClick={applyAuto} disabled={adj.auto}>
            <Icon name="auto_fix_high" size={20} />{adj.auto ? 'Melhoria aplicada' : 'Melhorar automaticamente'}
          </button>
          <ul className="ha-cap-auto">
            {autoItems(adj, slot.kind).map((i) => (
              <li key={i.text} className={i.on ? 'ha-cap-auto__item ha-cap-auto__item--on' : 'ha-cap-auto__item'}><Icon name={i.on ? 'check_circle' : 'radio_button_unchecked'} size={18} />{i.text}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {sliders.length ? (
        <div className="ha-stack ha-stack--3">
          {sliders.map((s) => (
            <label key={s.key} className="ha-cap-slider">
              <span className="ha-cap-slider__head"><span>{s.name}</span><span className="ha-num">{sliderValueLabel(adj[s.key] as number, s.unit)}</span></span>
              <input type="range" min={s.min} max={s.max} step={s.step} value={adj[s.key] as number} onChange={(e) => set({ [s.key]: parseFloat(e.target.value) } as Partial<Adjustments>)} />
            </label>
          ))}
        </div>
      ) : null}

      {tool === 'crop' ? (
        <div className="ha-row ha-cap-chips">
          <button type="button" className={`ha-chip${adj.crop ? ' ha-chip--on' : ''}`} aria-pressed={adj.crop} onClick={cropToArtwork}><Icon name="crop" size={16} />{dims.heightMm && dims.widthMm ? 'Recortar na proporção da obra' : 'Recortar à obra'}</button>
          <p className="ha-muted ha-sm">Arraste os cantos para um recorte livre.</p>
        </div>
      ) : null}
      {tool === 'color' ? (
        <div className="ha-row ha-cap-chips">
          <button type="button" className="ha-chip" onClick={() => set({ temp: -4, sat: 3 })}><Icon name="colorize" size={16} />Calibrar pelo cartão</button>
          {slot.colorCard ? null : <p className="ha-muted ha-sm">O cartão de cor só aparece na foto da frente.</p>}
        </div>
      ) : null}
      {tool === 'light' ? (
        <div className="ha-row ha-cap-chips">
          <button type="button" className="ha-chip" onClick={() => set({ bri: 6, con: 10, som: 8 })}><Icon name="brightness_auto" size={16} />Luz automática</button>
        </div>
      ) : null}
      {tool === 'reflex' ? (
        <div className="ha-row ha-cap-chips">
          <button type="button" className={`ha-chip${adj.reflex ? ' ha-chip--on' : ''}`} aria-pressed={adj.reflex} onClick={() => set({ reflex: !adj.reflex })}><Icon name="flare" size={16} />{adj.reflex ? 'Reflexo removido' : 'Remover reflexo'}</button>
          <p className="ha-muted ha-sm">Comprime os brilhos mais fortes. Reflexos de vidro continuam escondendo detalhes: tire o vidro se puder.</p>
        </div>
      ) : null}

      <div className="ha-cap-editor__secondary">
        <button type="button" className={`ha-btn ha-btn--sm ${original ? 'ha-btn--ink' : 'ha-btn--outline'}`}
          onPointerDown={() => setOriginal(true)} onPointerUp={() => setOriginal(false)} onPointerLeave={() => setOriginal(false)} onPointerCancel={() => setOriginal(false)}
          onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') setOriginal(true) }} onKeyUp={() => setOriginal(false)}>
          {original ? 'Ver ajustada' : 'Ver original'}
        </button>
        <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" onClick={reset} disabled={!isAdjusted(adj)}>Desfazer</button>
        <button type="button" className="ha-btn ha-btn--outline ha-btn--sm" onClick={onRetake} disabled={working}><Icon name="replay" size={16} />Refazer</button>
      </div>
      <button type="button" className="ha-btn ha-btn--primary ha-btn--md ha-cap-editor__use" onClick={use} disabled={working} aria-busy={working || undefined}>
        {working ? <span className="ha-spinner" aria-hidden /> : <Icon name="check" size={20} />}{working ? 'Enviando…' : 'Usar esta foto'}
      </button>
    </div>
  )
}
