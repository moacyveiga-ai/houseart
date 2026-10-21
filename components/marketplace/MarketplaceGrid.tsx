import Link from 'next/link'
import { Badge } from '@/components/ds/Badge'
import { formatBRL } from '@/lib/artworks/domain'
import type { PublicArtworkCard } from '@/lib/marketplace/public-server'

export function MarketplaceGrid({ items, base = '/e/artwork' }: { items: PublicArtworkCard[]; base?: string }) {
  if (items.length === 0) return <div className="ha-card ha-card--pad"><p className="ha-muted">Nenhuma obra à venda com esses filtros.</p></div>
  return (
    <div className="ha-grid-cards">
      {items.map((a) => (
        <Link key={a.publicId} href={`${base}/${a.publicId}`} className="ha-card">
          {/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
          <span className="ha-wall ha-wall--sq">{a.cover ? <img src={a.cover} alt={a.title} /> : null}</span>
          <div className="ha-card__body">
            <div className="ha-muted ha-sm">{a.artist}</div>
            <div className="ha-title">{a.title}{a.year ? `, ${a.year}` : ''}</div>
            <div className="ha-row"><span className="ha-num">{a.priceCents === null ? 'Sob consulta' : formatBRL(a.priceCents)}</span><Badge tone="verified">Autenticada</Badge></div>
          </div>
        </Link>
      ))}
    </div>
  )
}
