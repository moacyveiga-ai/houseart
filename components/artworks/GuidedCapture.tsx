'use client'
// The guided camera of the prototypes ("HouseArt App Artista › Nova obra ·
// câmera guiada" and the camera overlay of "App Colecionador › Cadastrar
// obra"): one full-screen dark surface per slot, the viewfinder with the guide
// frame, the colour card on the front shot, the live check chip, "Foto N de 6",
// the progress bars and the shutter. Without a camera (desktop, denied
// permission) the same surface offers "Escolher arquivo". After the shot the
// PhotoEditor opens; "Usar esta foto" uploads and moves on to the next
// required slot.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { useDialogFocus } from '@/components/ds/useDialogFocus'
import { MEDIA_SLOTS, type MediaSlot } from '@/lib/artworks/domain'
import { checkChip, counterOf, frameChecks, nextRequiredKind, progressBars, toGray, type FrameChecks, type SlotMedia } from './capture-core'
import { loadImage, sampleGray, snapshotVideo } from './capture-render'
import { PhotoEditor } from './PhotoEditor'
import './capture.css'

export const CAPTURE_MAX_SIDE = 2048
const CHECK_SAMPLE = 64
const CHECK_EVERY_MS = 500

type CamState = 'starting' | 'live' | 'none'

const hasCameraApi = (): boolean => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
/** the viewfinder starts asking for the camera, or says "no camera" right away where the API is absent */
const initialCam = (): CamState => (hasCameraApi() ? 'starting' : 'none')

export function GuidedCapture({ startKind, media, dims, busy, onUpload, onClose, onToast }: {
  startKind: string
  media: SlotMedia[]
  dims: { heightMm: number | null; widthMm: number | null }
  busy: boolean
  /** the wizard's upload; resolves true when the photo is saved */
  onUpload: (kind: string, file: File, adjusted: boolean) => Promise<boolean>
  onClose: () => void
  onToast: (msg: string) => void
}) {
  const [kind, setKind] = useState(startKind)
  const [shot, setShot] = useState<{ img: HTMLImageElement; url: string } | null>(null)
  const [cam, setCam] = useState<CamState>(initialCam)
  const [checks, setChecks] = useState<FrameChecks | null>(null)
  const video = useRef<HTMLVideoElement>(null)
  const scratch = useRef<HTMLCanvasElement | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const slot: MediaSlot = MEDIA_SLOTS.find((s) => s.kind === kind) ?? MEDIA_SLOTS[0]

  const stopCamera = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
  }, [])

  // the camera lives while the viewfinder is on screen
  useEffect(() => {
    if (shot || !hasCameraApi()) return
    let alive = true
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 2048 }, height: { ideal: 2048 } }, audio: false })
      .then((s) => {
        if (!alive) { s.getTracks().forEach((t) => t.stop()); return }
        stream.current = s
        if (video.current) { video.current.srcObject = s; void video.current.play().catch(() => {}) }
        setCam('live')
      })
      .catch(() => { if (alive) setCam('none') })
    return () => { alive = false; stopCamera() }
  }, [shot, stopCamera])

  // live checks: a 64×64 grayscale sample every ~500 ms → frameChecks
  useEffect(() => {
    if (cam !== 'live' || shot) return
    const id = window.setInterval(() => {
      const v = video.current
      if (!v) return
      scratch.current ??= document.createElement('canvas')
      const s = sampleGray(v, scratch.current, CHECK_SAMPLE)
      if (s) setChecks(frameChecks(toGray(s.data, s.w * s.h), s.w, s.h))
    }, CHECK_EVERY_MS)
    return () => window.clearInterval(id)
  }, [cam, shot])

  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url) }, [shot])

  // the page behind the full-screen surface does not scroll
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const openShot = async (blob: Blob) => {
    try {
      const loaded = await loadImage(blob)
      stopCamera()
      setShot(loaded)
    } catch (e) { onToast(e instanceof Error ? e.message : 'Não foi possível abrir a imagem.') }
  }

  const shutter = async () => {
    const v = video.current
    if (!v || cam !== 'live' || !v.videoWidth) { fileInput.current?.click(); return }
    try { await openShot(await snapshotVideo(v, CAPTURE_MAX_SIDE)) } catch { onToast('Não foi possível fotografar. Tente de novo.') }
  }

  const pickFile = (f: File | undefined) => { if (f) void openShot(f) }

  const advance = (justDone: string) => {
    const next = slot.required ? nextRequiredKind(media, justDone) : null
    if (next) {
      const name = MEDIA_SLOTS.find((s) => s.kind === next)?.name ?? ''
      onToast(`Foto salva · agora: ${name.toLowerCase()}`)
      setShot(null); setKind(next); setCam(initialCam()); setChecks(null)
      return
    }
    onToast(slot.required ? 'Fotos obrigatórias prontas' : 'Foto salva')
    onClose()
  }

  const use = async (file: File, adjusted: boolean) => {
    const ok = await onUpload(kind, file, adjusted)
    if (ok) advance(kind)
    return ok
  }

  const retake = () => { setShot(null); setCam(initialCam()); setChecks(null) }
  const close = () => { stopCamera(); onClose() }
  // Esc (audit design-system §5): back from the editor to the camera, from the camera out; never mid-upload
  useDialogFocus(root, true, () => { if (busy) return; if (shot) retake(); else close() })

  const chip = checkChip(cam === 'live' ? checks : null)
  const bars = progressBars(media, kind)
  const thumbs = MEDIA_SLOTS.filter((s) => media.some((m) => m.kind === s.kind) || s.kind === kind)
    .map((s) => ({ kind: s.kind, name: s.name, url: s.kind === kind && shot ? shot.url : media.find((m) => m.kind === s.kind)?.publicUrl ?? null }))

  return (
    <div ref={root} tabIndex={-1} className="ha-cap" role="dialog" aria-modal="true" aria-label={shot ? 'Ajuste a foto' : 'Câmera guiada'}>
      <div className="ha-cap__top">
        <button type="button" className="ha-cap__iconbtn" aria-label="Fechar" onClick={close}><Icon name="close" size={26} /></button>
        <span className="ha-cap__counter">{counterOf(kind)}</span>
        {shot ? <span className="ha-cap__spacer" /> : (
          <button type="button" className="ha-cap__iconbtn" aria-label="Flash desligado" onClick={() => onToast('Flash desligado: ele cria reflexo na obra')}><Icon name="flash_off" size={24} /></button>
        )}
      </div>

      {shot ? (
        <div className="ha-cap__sheet">
          <PhotoEditor slot={slot} source={shot.img} dims={dims} thumbs={thumbs} busy={busy} onUse={use} onRetake={retake} />
        </div>
      ) : (
        <>
          <div className={`ha-cap__finder${cam === 'live' ? ' ha-cap__finder--live' : ''}`}>
            <video ref={video} className="ha-cap__video" playsInline muted autoPlay />
            {cam !== 'live' ? (
              <div className="ha-cap__nocam">
                <Icon name={cam === 'starting' ? 'photo_camera' : 'no_photography'} size={40} />
                <span className="ha-cap__nocam-title">{cam === 'starting' ? 'Abrindo a câmera…' : 'Sem câmera aqui'}</span>
                {cam === 'none' ? <span className="ha-cap__nocam-sub">No celular a câmera guia a foto. Aqui, escolha um arquivo: ele passa pelo mesmo editor.</span> : null}
              </div>
            ) : null}
            <span className={`ha-cap__guide${chip.ok ? ' ha-cap__guide--ok' : ''}`} aria-hidden style={slot.focus ? { transformOrigin: slot.focus } : undefined} />
            <span className="ha-cap__corner ha-cap__corner--tl" aria-hidden /><span className="ha-cap__corner ha-cap__corner--br" aria-hidden />
            {slot.focus ? <span className="ha-cap__focus" aria-hidden style={{ left: slot.focus.split(' ')[0], top: slot.focus.split(' ')[1] }} /> : null}
            {slot.colorCard ? (
              <span className="ha-cap__card" aria-label="Cartão de cor de referência" role="img">
                <i className="ha-cap__swatch ha-cap__swatch--red" /><i className="ha-cap__swatch ha-cap__swatch--green" /><i className="ha-cap__swatch ha-cap__swatch--blue" />
                <i className="ha-cap__swatch ha-cap__swatch--black" /><i className="ha-cap__swatch ha-cap__swatch--gray" /><i className="ha-cap__swatch ha-cap__swatch--white" />
              </span>
            ) : null}
            {cam === 'live' ? <span className={`ha-cap__chip${chip.ok ? ' ha-cap__chip--ok' : ''}`} role="status"><i />{chip.text}</span> : null}
          </div>

          <div className="ha-cap__text">
            <span className="ha-cap__name">{slot.name}{slot.required ? '' : ' · opcional'}</span>
            <span className="ha-cap__hint">{slot.hint}</span>
          </div>
          {slot.required ? (
            <div className="ha-cap__bars" aria-hidden>{bars.map((b, i) => <span key={i} className={`ha-cap__bar ha-cap__bar--${b}`} />)}</div>
          ) : null}

          <div className="ha-cap__actions">
            <label className="ha-cap__side">
              <input ref={fileInput} type="file" accept="image/*" className="ha-sr" onChange={(e) => { pickFile(e.target.files?.[0]); e.target.value = '' }} />
              <Icon name="photo_library" size={26} />{cam === 'live' ? 'Galeria' : 'Escolher arquivo'}
            </label>
            <button type="button" className={`ha-cap__shutter${chip.ok ? ' ha-cap__shutter--ok' : ''}`} aria-label={cam === 'live' ? 'Fotografar' : 'Escolher arquivo'} onClick={shutter}><span /></button>
            <span className="ha-cap__side ha-cap__side--end">
              {slot.required ? <span className="ha-cap__state">{cam === 'live' ? (chip.ok ? 'Pronto' : 'Ajustando…') : ''}</span>
                : <button type="button" className="ha-cap__skip" onClick={close}>Pular</button>}
            </span>
          </div>
        </>
      )}
    </div>
  )
}
