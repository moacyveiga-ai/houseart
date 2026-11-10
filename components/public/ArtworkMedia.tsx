'use client'
// Media of the public artwork page: stage (Obra · Ver em parede), thumbnails
// (Frente · Verso e etiqueta · Detalhe · Assinatura · Na parede — the real photos;
// `artwork-media-core.ts` decides the strip) and the lightbox (Esc closes).
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Icon } from '@/components/ds/Icon'
import type { MediaItem } from './artwork-media-core'
import { wallLayout, type Box } from './wall-scene-core'

export type { MediaItem } from './artwork-media-core'

interface WallScale { heightMm: number; widthMm: number; dimensions: string }

export function ArtworkMedia({ items, caption, wall }: { items: MediaItem[]; caption: { artist: string; title: string; year: number | null }; wall: WallScale | null }) {
  const [index, setIndex] = useState(0)
  const [mode, setMode] = useState<'work' | 'wall'>('work')
  const [zoom, setZoom] = useState(false)
  useEffect(() => {
    if (!zoom) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoom(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoom])
  const current = items[index] ?? items[0]
  // "Ver em parede" hangs the FRONT; a work photographed without it has no wall mode
  const front = items.find((m) => m.view === 'front') ?? null
  if (!current) return <div className="hp-artwork__stage" aria-label="Sem imagem" />
  const alt = `${caption.title}, ${caption.artist}${caption.year ? `, ${caption.year}` : ''} · ${current.label}`
  const detailStyle = current.view === 'detail' ? { transform: 'scale(2.4)', transformOrigin: current.origin } : undefined
  return (
    <>
      <div className="hp-artwork__stage">
        {mode === 'work' ? (
          <button type="button" className={`hp-artwork__view hp-artwork__view--${current.view}`} onClick={() => setZoom(true)} aria-label="Ampliar imagem">
            {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
            <img src={current.src} alt={alt} style={detailStyle} />
          </button>
        ) : wall && front ? (
          <WallScene wall={wall} src={front.src} />
        ) : null}
        {wall && front ? (
          <div className="hp-artwork__seg" role="group" aria-label="Modo de visualização">
            <button type="button" aria-pressed={mode === 'work'} onClick={() => setMode('work')}>Obra</button>
            <button type="button" aria-pressed={mode === 'wall'} onClick={() => setMode('wall')}><Icon name="chair" size={16} />Ver em parede</button>
          </div>
        ) : null}
      </div>
      <div className="hp-artwork__thumbs">
        {items.map((m, i) => (
          <button key={m.label} type="button" className="hp-artwork__thumb" aria-pressed={i === index && mode === 'work'} aria-label={m.label} onClick={() => { setIndex(i); setMode('work') }}>
            <span className="hp-artwork__thumb-wall">
              {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
              <img src={m.src} alt="" style={m.view === 'detail' ? { transform: 'scale(2.4)', transformOrigin: m.origin } : undefined} />
            </span>
            <span>{m.label}</span>
          </button>
        ))}
      </div>
      {zoom ? (
        <button type="button" className="hp-artwork__zoom" onClick={() => setZoom(false)} aria-label="Fechar ampliação">
          {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
          <img src={current.src} alt={alt} />
          <span className="hp-artwork__zoom-caption"><b>{caption.artist}</b> · <i>{caption.title}</i>{caption.year ? `, ${caption.year}` : ''}</span>
          <span className="hp-artwork__zoom-close"><Icon name="close" size={28} /></span>
        </button>
      ) : null}
    </>
  )
}

const boxStyle = (b: Box): CSSProperties => ({ left: b.left, bottom: b.bottom, width: b.width, height: b.height })

/** The work, a 2,20 m sofa and the 1,70 m ruler in ONE real scale (wall-scene-core): measured stage, redrawn on resize. */
function WallScene({ wall, src }: { wall: WallScale; src: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // at phone width the Obra · Ver em parede control sits on the floor band, never on the sofa
  const l = size ? wallLayout({ ...size, floorMin: size.width <= 720 ? 72 : 0 }, { widthMm: wall.widthMm, heightMm: wall.heightMm }) : null
  return (
    <div ref={ref} className="hp-artwork__wall" role="img" aria-label={`Escala real: obra ${wall.dimensions} sobre um sofá de 2,20 m`}>
      {l ? (
        <>
          <div className="hp-artwork__wall-floor" style={{ height: l.floor }} />
          <div className="hp-artwork__wall-work" style={boxStyle(l.work)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
            <img src={src} alt="" />
          </div>
          <div className="hp-artwork__sofa-part hp-artwork__sofa-part--back" style={boxStyle(l.sofa.back)} />
          <div className="hp-artwork__sofa-part" style={boxStyle(l.sofa.body)} />
          <div className="hp-artwork__sofa-part hp-artwork__sofa-part--arm" style={boxStyle(l.sofa.armL)} />
          <div className="hp-artwork__sofa-part hp-artwork__sofa-part--arm" style={boxStyle(l.sofa.armR)} />
          <div className="hp-artwork__sofa-leg" style={boxStyle(l.sofa.legL)} />
          <div className="hp-artwork__sofa-leg" style={boxStyle(l.sofa.legR)} />
          <div className="hp-artwork__wall-ruler" style={{ left: l.ruler.left, bottom: l.ruler.bottom, height: l.ruler.height }}>
            <span>1,70 m</span>
          </div>
        </>
      ) : null}
      <div className="hp-artwork__wall-note">Escala real · obra {wall.dimensions} sobre um sofá de 2,20 m</div>
    </div>
  )
}
