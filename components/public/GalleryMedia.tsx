'use client'
// Fotos e vídeos: the two tabs of the Galeria prototype. Photos in the 4-column mosaic
// (2×2 · 1×1 ×4 · 2×1); videos as cards that open the link (no thumbnail stored).
import { useState } from 'react'
import { Icon } from '@/components/ds/Icon'
import { photoSpan } from '@/lib/public-content/profile-core'

export interface MediaItem { title: string; url: string | null }

export function GalleryMedia({ photos, videos }: { photos: MediaItem[]; videos: MediaItem[] }) {
  const tabs = [{ key: 'photos', label: 'Fotos', n: photos.length }, { key: 'videos', label: 'Vídeos', n: videos.length }].filter((t) => t.n > 0)
  const [active, setActive] = useState(tabs[0]?.key ?? 'photos')
  return (
    <>
      <div className="hp-gallery-head">
        <h2 className="hp-section-title">Fotos e vídeos</h2>
        <div className="hp-gallery-tabs" role="tablist" aria-label="Tipo de mídia">
          {tabs.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={t.key === active} className={`hp-gallery-tab${t.key === active ? ' hp-gallery-tab--on' : ''}`} onClick={() => setActive(t.key)}>
              {t.label} ({t.n})
            </button>
          ))}
        </div>
      </div>
      {active === 'photos' ? (
        <div className="hp-gallery-photos" role="tabpanel">
          {photos.map((p, i) => {
            const s = photoSpan(i)
            return (
              <div key={`${p.title}-${i}`} className="hp-gallery-photo" style={{ gridColumn: `span ${s.c}`, gridRow: `span ${s.r}` }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
                {p.url ? <img src={p.url} alt={p.title} loading="lazy" /> : null}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="hp-gallery-videos" role="tabpanel">
          {videos.map((v, i) => {
            const body = (
              <>
                <span className="hp-gallery-video__thumb"><span className="hp-gallery-video__play"><Icon name="play_arrow" size={32} filled /></span></span>
                <span className="hp-gallery-video__title">{v.title}</span>
              </>
            )
            return v.url
              ? <a key={`${v.title}-${i}`} href={v.url} target="_blank" rel="noopener noreferrer" className="hp-gallery-video">{body}</a>
              : <div key={`${v.title}-${i}`} className="hp-gallery-video">{body}</div>
          })}
        </div>
      )}
    </>
  )
}
