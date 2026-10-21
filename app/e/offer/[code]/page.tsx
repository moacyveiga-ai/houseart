import { notFound } from 'next/navigation'
import { HouseArtLogo } from '@/components/layout/HouseArtLogo'
import { Badge } from '@/components/ds/Badge'
import { buyerOffer } from '@/lib/offers/server'
import { formatBRL } from '@/lib/artworks/domain'
import { BuyerOfferActions } from '@/components/offers/BuyerOfferActions'

export const dynamic = 'force-dynamic'

/** The buyer's page, by the one-time token handed after the OTP (never indexed). */
export default async function BuyerOfferPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ t?: string }> }) {
  const code = (await params).code.toUpperCase()
  const token = (await searchParams).t ?? null
  const o = await buyerOffer(code, token)
  if (!o || !token) notFound()
  const authorLabel = (a: string) => (a === 'BUYER' ? 'Você' : a === 'NEGOTIATOR' ? 'Negociador do vendedor' : 'Vendedor')
  return (
    <main className="ha-page ha-page--loose" style={{ maxWidth: 720, margin: '0 auto' }}>
      <HouseArtLogo height={30} />
      <p className="ha-eyebrow">Sua proposta</p>
      <h1 className="ha-h1">{o.artworkTitle}</h1>
      <div className="ha-row"><Badge tone={o.status === 'ACCEPTED' ? 'verified' : o.status === 'REFUSED' || o.status === 'EXPIRED' || o.status === 'RETRACTED' ? 'neutral' : 'pending'}>{o.statusLabel}</Badge><span className="ha-muted ha-sm">{o.code} · válida até {new Date(o.expiresAt).toLocaleDateString('pt-BR')}</span></div>
      <ul className="ha-list">
        {o.rounds.map((r) => <li key={r.number} className="ha-list__row" style={{ gridTemplateColumns: '1fr auto auto' }}><span><b>{authorLabel(r.author)}</b>{r.message ? <><br /><span className="ha-muted ha-sm">{r.message}</span></> : null}</span><span className="ha-num">{formatBRL(r.amountCents)}</span><span className="ha-muted ha-sm">{new Date(r.at).toLocaleDateString('pt-BR')}</span></li>)}
      </ul>
      {o.status === 'ACCEPTED' ? <div className="ha-callout">Proposta aceita por {formatBRL(o.currentCents)}. Você tem 24 h para pagar em garantia; a HouseArt entra em contato com as instruções.</div> : null}
      <BuyerOfferActions code={o.code} token={token} canRetract={o.canRetract} canReply={o.canReply} />
    </main>
  )
}
