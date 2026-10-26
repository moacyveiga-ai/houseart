'use client'
// Media of the public artwork page: stage (Obra · Ver em parede), thumbnails
// (Frente · Verso e etiqueta · Detalhe · Assinatura · Na parede — the real photos;
// `artwork-media-core.ts` decides the strip) and the lightbox (Esc closes).
import { useEffect, useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import type { MediaItem } from './artwork-media-core'

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
  if (!current) return <div className="hp-artwork__stage" aria-label="Sem imagem" />
  const alt = `${caption.title}, ${caption.artist}${caption.year ? `, ${caption.year}` : ''} · ${current.label}`
  const detailStyle = current.view === 'detail' ? { transform: 'scale(2.4)', transformOrigin: current.origin } : undefined
  // Wall scale: the 1,70 m reference line is 42.5 % of the stage.
  const wallHeightPct = wall ? (wall.heightMm / 1700) * 42.5 : 0
  return (
    <>
      <div className="hp-artwork__stage">
        {mode === 'work' ? (
          <button type="button" className={`hp-artwork__view hp-artwork__view--${current.view}`} onClick={() => setZoom(true)} aria-label="Ampliar imagem">
            {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
            <img src={current.src} alt={alt} style={detailStyle} />
          </button>
        ) : wall ? (
          <div className="hp-artwork__wall" role="img" aria-label={`Escala aproximada: obra ${wall.dimensions} sobre sofá de 2,20 m`}>
            <div className="hp-artwork__wall-floor" />
            <div className="hp-artwork__wall-work" style={{ height: `${wallHeightPct}%`, aspectRatio: `${wall.widthMm} / ${wall.heightMm}` }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
              <img src={(items.find((m) => m.view === 'front') ?? items[0]).src} alt="" />
            </div>
            <div className="hp-artwork__wall-sofa" />
            <div className="hp-artwork__wall-leg hp-artwork__wall-leg--l" />
            <div className="hp-artwork__wall-leg hp-artwork__wall-leg--r" />
            <div className="hp-artwork__wall-ruler" />
            <div className="hp-artwork__wall-tick" />
            <div className="hp-artwork__wall-ref">1,70 m</div>
            <div className="hp-artwork__wall-note">Escala aproximada · obra {wall.dimensions} sobre sofá de 2,20 m</div>
          </div>
        ) : null}
        {wall ? (
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
