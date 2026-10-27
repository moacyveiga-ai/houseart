// artwork-card (molécula): grid (parede quadrada, artista, título itálico com
// ano, técnica · dimensões, preço + Autenticada) e lista (72px, título, meta, preço).
import Link from 'next/link'
import { Icon } from './Icon'
import { StatusBadge } from './StatusBadge'

export interface ArtworkCardData {
  href: string
  src: string | null
  artist: string
  title: string
  year?: number | null
  technique?: string | null
  dimensions?: string | null
  price: string
  verified?: boolean
  /** The seller line of the design ("storefront Galeria Ladeira · Galeria"); absent where the card does not name who sells. */
  seller?: { name: string; kind: 'GALLERY' | 'PRIVATE' } | null
}

const titleWithYear = (a: ArtworkCardData) => (
  <>{a.title}{a.year ? <>, <em>{a.year}</em></> : null}</>
)
const meta = (a: ArtworkCardData) => [a.technique, a.dimensions].filter(Boolean).join(' · ')

export function ArtworkCard({ artwork: a }: { artwork: ArtworkCardData }) {
  return (
    <Link href={a.href} className="ha-artwork-card">
      <span className="ha-artwork-card__wall">
        {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública, tamanho pelo CSS */}
        {a.src ? <img src={a.src} alt={a.title} loading="lazy" /> : null}
      </span>
      <span className="ha-artwork-card__body">
        <span className="ha-artwork-card__artist">{a.artist}</span>
        <span className="ha-artwork-card__title">{titleWithYear(a)}</span>
        {meta(a) ? <span className="ha-artwork-card__meta">{meta(a)}</span> : null}
        {a.seller ? <span className="ha-artwork-card__seller"><Icon name={a.seller.kind === 'GALLERY' ? 'storefront' : 'person'} size={14} /><span>{a.seller.name} · {a.seller.kind === 'GALLERY' ? 'Galeria' : 'Particular'}</span></span> : null}
        <span className="ha-artwork-card__foot">
          <span className="ha-artwork-card__price">{a.price}</span>
          {a.verified ? <StatusBadge status="verified" inline /> : null}
        </span>
      </span>
    </Link>
  )
}

export function ArtworkGrid({ items }: { items: ArtworkCardData[] }) {
  return <div className="ha-artwork-grid">{items.map((a) => <ArtworkCard key={a.href} artwork={a} />)}</div>
}

export function ArtworkRow({ artwork: a }: { artwork: ArtworkCardData }) {
  return (
    <Link href={a.href} className="ha-artwork-row">
      <span className="ha-artwork-row__thumb">
        {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
        {a.src ? <img src={a.src} alt="" loading="lazy" /> : null}
      </span>
      <span style={{ minWidth: 0 }}>
        <span className="ha-artwork-row__title">{titleWithYear(a)}</span>
        <br />
        <span className="ha-artwork-row__meta">{[a.artist, a.technique, a.dimensions].filter(Boolean).join(' · ')}</span>
      </span>
      <span className="ha-artwork-row__price">{a.price}</span>
    </Link>
  )
}

export function ArtworkList({ items }: { items: ArtworkCardData[] }) {
  return <div className="ha-artwork-list">{items.map((a) => <ArtworkRow key={a.href} artwork={a} />)}</div>
}
