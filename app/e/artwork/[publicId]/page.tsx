import { notFound } from 'next/navigation'
import Link from 'next/link'
import { HouseArtLogo } from '@/components/layout/HouseArtLogo'
import { Badge } from '@/components/ds/Badge'
import { OfferForm } from '@/components/marketplace/OfferForm'
import { isPublicId } from '@/lib/physical-markers/domain'
import { publicArtwork } from '@/lib/marketplace/public-server'
import { formatBRL, HISTORY_KIND_LABELS } from '@/lib/artworks/domain'

export const dynamic = 'force-dynamic'

// Minimal public artwork page (the full design "HouseArt Obra" is pending — HOUSEART_BUILD.md §J.1).
export default async function PublicArtworkPage({ params }: { params: Promise<{ publicId: string }> }) {
  const publicId = (await params).publicId.toUpperCase()
  if (!isPublicId(publicId)) notFound()
  const a = await publicArtwork(publicId)
  if (!a) notFound()
  return (
    <main className="ha-page ha-page--loose" style={{ maxWidth: 1080, margin: '0 auto' }}>
      <div className="ha-row"><HouseArtLogo height={30} /><Link href={`/verify/${publicId}`} className="ha-link">Verificar certificado</Link></div>
      <div className="ha-split">
        <section className="ha-stack">
          {/* eslint-disable-next-line @next/next/no-img-element -- derivative of the public store */}
          <div className="ha-wall">{a.cover ? <img src={a.cover} alt={a.title} /> : null}</div>
          <div className="ha-row">{a.media.filter((m) => m.kind !== 'FRONT_COLOR_CARD').map((m) => (
            // eslint-disable-next-line @next/next/no-img-element -- derivative of the public store
            <span key={m.kind} className="ha-wall ha-wall--72"><img src={m.url} alt="" /></span>
          ))}</div>
        </section>
        <section className="ha-stack">
          <div className="ha-eyebrow">{a.artist}</div>
          <h1 className="ha-h1">{a.title}{a.year ? `, ${a.year}` : ''}</h1>
          <div className="ha-row"><Badge tone="verified">Autenticada</Badge><span className="ha-muted ha-sm">{publicId}</span></div>
          <div className="ha-kv">
            <span>Técnica</span><span>{a.technique ?? '—'}</span>
            <span>Materiais</span><span>{a.materials ?? '—'}</span>
            <span>Dimensões</span><span>{a.dimensions}</span>
            <span>Edição</span><span>{a.edition ?? '—'}</span>
            <span>Preço</span><span className="ha-num">{a.priceCents === null ? 'Sob consulta' : formatBRL(a.priceCents)}{a.fixedPrice ? ' · preço fixo' : a.acceptsOffers ? ' · aceita propostas' : ''}</span>
          </div>
          {a.history.length ? <ul className="ha-list">{a.history.map((h, i) => <li key={i} className="ha-list__row" style={{ gridTemplateColumns: 'auto 1fr auto' }}><Badge tone="neutral">{HISTORY_KIND_LABELS[h.kind as keyof typeof HISTORY_KIND_LABELS] ?? h.kind}</Badge><span>{h.description}</span><span className="ha-muted ha-sm">{h.occurredOn}</span></li>)}</ul> : null}
          {a.acceptsOffers ? <div className="ha-card ha-card--pad"><OfferForm publicId={publicId} fixedPriceCents={a.fixedPrice && a.priceCents !== null ? a.priceCents.toString() : null} /></div> : <p className="ha-muted">Interessados pedem contato pela galeria.</p>}
        </section>
      </div>
    </main>
  )
}
