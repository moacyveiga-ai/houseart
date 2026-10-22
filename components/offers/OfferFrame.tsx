// The frame of the offer flow (handoff "HouseArt Oferta"): its own bar
// (← Voltar à obra · brand · Ambiente seguro) and the artwork aside with the
// price summary. Plain components — rendered by the Server Component pages
// and inside the client islands alike.
import Link from 'next/link'
import { HouseArtLogo } from '@/components/layout/HouseArtLogo'
import { Icon } from '@/components/ds/Icon'
import { formatBRL } from '@/lib/artworks/domain'
import { RESALE_ROYALTY_BPS } from '@/lib/resale-royalty/core'
import { totalIfAccepted } from './offer-wizard-core'

/** What the flow shows of the artwork — the public projection, nothing else. */
export interface OfferArtwork {
  publicId: string; title: string; year: number | null; artist: string; technique: string | null; dimensions: string
  cover: string | null; certified: boolean; seller: { name: string; kind: 'GALLERY' | 'PRIVATE' }; priceCents: number
}

export function OfferBar({ backHref, backLabel = 'Voltar à obra' }: { backHref: string; backLabel?: string }) {
  return (
    <header className="hp-offer__bar">
      <div className="hp-offer__bar-inner">
        <Link href={backHref} className="hp-offer__back"><Icon name="arrow_back" size={20} /><span>{backLabel}</span></Link>
        <Link href="/e" className="hp-offer__brand" aria-label="HouseArt"><HouseArtLogo version="full_horiz" tone="color" height={30} /></Link>
        <span className="hp-offer__secure"><Icon name="lock" size={16} /><span>Ambiente seguro</span></span>
      </div>
    </header>
  )
}

export interface OfferSummary {
  offerCents: number
  shippingCents: number
  insuranceCents: number
  /** "Incluso" when the seller's counter carries the shipping. */
  shippingIncluded?: boolean
  /** The place the quote was made for ("Salvador/BA"); null until the CEP is given. */
  destination: string | null
}

export function OfferAside({ artwork, summary }: { artwork: OfferArtwork; summary: OfferSummary }) {
  const shortId = artwork.publicId.split('-').slice(0, 3).join('-')
  const total = totalIfAccepted(summary.offerCents, summary.shippingIncluded ? 0 : summary.shippingCents, summary.insuranceCents)
  const royaltyPct = (RESALE_ROYALTY_BPS / 100).toLocaleString('pt-BR')
  return (
    <aside className="hp-offer__aside" aria-label="Resumo da oferta">
      <div className="hp-offer__work">
        <div className="hp-offer__work-wall">
          {/* eslint-disable-next-line @next/next/no-img-element -- derivada pública */}
          {artwork.cover ? <img src={artwork.cover} alt="" /> : null}
        </div>
        <div className="hp-offer__work-text">
          <span className="hp-offer__work-artist">{artwork.artist}</span>
          <span className="hp-offer__work-title">{artwork.title}{artwork.year ? <em>, {artwork.year}</em> : null}</span>
          <span className="hp-offer__work-meta">{[artwork.technique, artwork.dimensions !== '—' ? artwork.dimensions : null].filter(Boolean).join(' · ')}</span>
          {artwork.certified
            ? <span className="hp-offer__work-cert"><Icon name="verified" size={14} filled />Certificada · {shortId}</span>
            : <span className="hp-offer__work-cert hp-offer__work-cert--pending"><Icon name="pending" size={14} />Em certificação · {shortId}</span>}
        </div>
      </div>
      <div className="hp-offer__seller"><Icon name={artwork.seller.kind === 'GALLERY' ? 'storefront' : 'person'} size={18} /><span>Vendido por <b>{artwork.seller.name}</b>{artwork.seller.kind === 'GALLERY' ? ' · Galeria' : ''}</span></div>
      <dl className="hp-offer__sum">
        <div className="hp-offer__sum-row hp-offer__sum-row--muted"><dt>Preço pedido</dt><dd>{formatBRL(artwork.priceCents)}</dd></div>
        <div className="hp-offer__sum-row"><dt>Sua oferta</dt><dd>{formatBRL(summary.offerCents)}</dd></div>
        <div className="hp-offer__sum-row"><dt>Frete especializado</dt><dd>{summary.shippingIncluded ? 'Incluso' : summary.destination ? formatBRL(summary.shippingCents) : 'Informe o CEP'}</dd></div>
        <div className="hp-offer__sum-row"><dt>Seguro de transporte</dt><dd>{summary.destination ? formatBRL(summary.insuranceCents) : '—'}</dd></div>
        <div className="hp-offer__sum-row"><dt>Taxa HouseArt</dt><dd>Grátis para compradores</dd></div>
        <div className="hp-offer__sum-total"><dt>Total se aceita</dt><dd>{formatBRL(total)}</dd></div>
      </dl>
      <span className="hp-offer__fine">
        {summary.destination ? `Frete especializado e seguro calculados para ${summary.destination}. ` : 'Frete especializado e seguro são calculados pelo CEP de entrega, na etapa Garantia. '}
        {royaltyPct}% da valorização vai para o artista como direito de sequência em revendas futuras.
      </span>
    </aside>
  )
}
