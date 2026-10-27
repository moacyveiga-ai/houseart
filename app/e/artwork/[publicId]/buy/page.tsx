import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import '@/components/checkout/checkout.css'
import { ButtonLink } from '@/components/ds/Button'
import { CheckoutScreen } from '@/components/checkout/CheckoutScreen'
import { getSession } from '@/lib/auth'
import { flagOn } from '@/lib/flags'
import { addressesOf } from '@/lib/addresses/server'
import { isPublicId } from '@/lib/physical-markers/domain'
import { publicArtwork } from '@/lib/marketplace/public-server'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ publicId: string }> }

export const metadata: Metadata = { title: 'Comprar — HouseArt', robots: { index: false } }

/** "Comprar direto" (handoff App Colecionador › Comprar direto): the logged collector pays the list price in escrow. */
export default async function BuyArtworkPage({ params }: Params) {
  const publicId = (await params).publicId.toUpperCase()
  if (!isPublicId(publicId)) notFound()
  const a = await publicArtwork(publicId)
  if (!a) notFound()
  const back = `/e/artwork/${a.publicId}`
  const session = await getSession()
  if (!session) {
    const next = encodeURIComponent(`${back}/buy`)
    return (
      <div className="hc">
        <div className="hc-gate">
          <div className="hc-gate__card">
            <h1 className="hc-gate__title">Crie sua conta para comprar</h1>
            <p className="hc-gate__text">A compra fica em garantia na HouseArt e a escritura de <i>{a.title}</i> passa para o seu nome na entrega. Entre ou crie sua conta de colecionador para continuar.</p>
            <div className="hc-gate__actions">
              <ButtonLink href={`/signup?next=${next}`} variant="primary" size="md">Criar conta</ButtonLink>
              <ButtonLink href={`/login?next=${next}`} variant="outline" size="md">Entrar</ButtonLink>
            </div>
            <a href={back} className="ha-link ha-link--quiet">Voltar para a obra</a>
          </div>
        </div>
      </div>
    )
  }
  if (a.status !== 'LISTED' || a.priceCents === null || a.priceCents <= 0n) {
    return (
      <div className="hc">
        <div className="hc-gate">
          <div className="hc-gate__card">
            <h1 className="hc-gate__title">{a.status === 'LISTED' ? 'Esta obra é vendida sob consulta' : 'Esta obra não está à venda'}</h1>
            <p className="hc-gate__text">{a.status === 'LISTED' ? 'O preço é combinado com o vendedor: faça uma proposta pela página da obra.' : 'A obra saiu do marketplace ou está reservada por outra pessoa.'}</p>
            <div className="hc-gate__actions"><ButtonLink href={back} variant="outline" size="md">Voltar para a obra</ButtonLink></div>
          </div>
        </div>
      </div>
    )
  }
  return (
    <CheckoutScreen
      buyerName={session.name}
      installmentsOn={flagOn('FLAG_CARD_INSTALLMENTS')}
      addresses={(await addressesOf(session.id).catch(() => [])).map((x) => ({ id: x.id, label: x.label, line: x.line, cep: x.cep, isDefault: x.isDefault }))}
      artwork={{
        publicId: a.publicId, title: a.title, year: a.year, artist: a.artist, technique: a.technique, dimensions: a.dimensions, cover: a.cover,
        certified: a.certificateStatus === 'ACTIVE', priceCents: a.priceCents.toString(),
        seller: { name: a.seller.name, kind: a.seller.kind, city: a.seller.city, uf: a.seller.uf },
      }}
    />
  )
}
