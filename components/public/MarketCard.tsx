// Card do Marketplace público (protótipo HouseArt Marketplace): parede quadrada
// com o selo "Certificada" e o coração, artista, título em itálico com o ano,
// técnica · dimensões, a linha do VENDEDOR (storefront = galeria, person =
// particular) e o preço. O ArtworkCard do DS não tem a linha do vendedor, por
// isso o card mora aqui e não em components/ds. O coração é ação real de curtir
// (LIKE em /api/community/reactions) quando `like` vem com a sessão; sem ela, leva ao login.
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'
import { formatBRL, categoryLabel as labelOfCategory } from '@/lib/artworks/domain'
import { SELLER_LABELS, type MarketItem } from '@/lib/marketplace/filter-core'
import { MarketCardLike } from './MarketCardLike'

export const priceLabel = (cents: bigint | null) => (cents === null ? 'Sob consulta' : formatBRL(cents))
export const categoryLabel = (c: string) => labelOfCategory(c)

export interface MarketCardLikeState { signedIn: boolean; id: number | null; liked: boolean }

export function MarketCard({ item: o, like }: { item: MarketItem; like?: MarketCardLikeState }) {
  const meta = [o.technique ?? categoryLabel(o.category), o.dimensions !== '—' ? o.dimensions : null].filter(Boolean).join(' · ')
  return (
    <div className="hp-market-card">
    {like ? <MarketCardLike artworkId={like.id} publicId={o.publicId} liked={like.liked} signedIn={like.signedIn} /> : <span className="hp-market-card__fav" aria-hidden="true"><Icon name="favorite" size={18} /></span>}
    <Link href={`/e/artwork/${o.publicId}`} className="hp-market-card__link">
      <span className="hp-market-card__wall">
        {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
        {o.cover ? <img src={o.cover} alt={o.title} loading="lazy" /> : null}
        <span className="hp-market-card__seal"><Icon name="verified" size={14} />Certificada</span>
      </span>
      <span className="hp-market-card__body">
        <span className="hp-market-card__artist">{o.artist}</span>
        <span className="hp-market-card__title">{o.title}{o.year ? `, ${o.year}` : ''}</span>
        <span className="hp-market-card__meta">{meta}</span>
        <span className="hp-market-card__seller"><Icon name={o.sellerKind === 'GALLERY' ? 'storefront' : 'person'} size={14} />{o.seller} · <b>{SELLER_LABELS[o.sellerKind]}</b></span>
        <span className="hp-market-card__price">{priceLabel(o.priceCents)}</span>
      </span>
    </Link>
    </div>
  )
}
