'use client'
// Tour virtual: the room selector of the Galeria prototype. A room is an image
// (360° still) or a link to the tour (Matterport, Kuula…), shown in an iframe.
import { useState } from 'react'
import { Icon } from '@/components/ds/Icon'

export interface Room { title: string; url: string | null }

const isImage = (u: string) => /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(u) || u.includes('/api/public/media/')

export function GalleryRooms({ rooms }: { rooms: Room[] }) {
  const [i, setI] = useState(0)
  const room = rooms[i] ?? rooms[0]!
  return (
    <>
      <div className="hp-gallery-head">
        <div className="hp-gallery-head__titles">
          <h2 className="hp-section-title">Tour virtual</h2>
          <span className="hp-gallery-sub">Percorra o espaço em 360° e clique nas obras para ver detalhes.</span>
        </div>
        {rooms.length > 1 ? (
          <div className="hp-gallery-chips" role="group" aria-label="Salas">
            {rooms.map((r, k) => <button key={`${r.title}-${k}`} type="button" className={`hp-gallery-chip${k === i ? ' hp-gallery-chip--on' : ''}`} aria-pressed={k === i} onClick={() => setI(k)}>{r.title}</button>)}
          </div>
        ) : null}
      </div>
      <div className="hp-gallery-tour">
        {room.url ? (
          isImage(room.url)
            // eslint-disable-next-line @next/next/no-img-element -- derivada pública
            ? <img src={room.url} alt={room.title} />
            : <iframe src={room.url} title={room.title} allow="fullscreen; xr-spatial-tracking" loading="lazy" />
        ) : null}
        <span className="hp-gallery-tour__start"><Icon name="360" size={20} />Iniciar tour · {room.title}</span>
      </div>
    </>
  )
}
