import { notFound } from 'next/navigation'
import { HouseArtLogo } from '@/components/layout/HouseArtLogo'
import { buyerTransfer } from '@/lib/ownership/server'
import { BuyerAccept } from '@/components/transfer/BuyerAccept'
import { formatBRL } from '@/lib/artworks/domain'

export const dynamic = 'force-dynamic'

export default async function BuyerTransferPage({ params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token
  const t = await buyerTransfer(token)
  if (!t) notFound()
  return (
    <main className="ha-page ha-page--loose" style={{ maxWidth: 640, margin: '0 auto' }}>
      <HouseArtLogo size={24} />
      <p className="ha-eyebrow">Transferência de titularidade</p>
      <h1 className="ha-h1">{t.artwork.title}{t.artwork.year ? `, ${t.artwork.year}` : ''}</h1>
      <p className="ha-muted">{t.artwork.artist.name} · {t.artwork.publicId}</p>
      <div className="ha-kv">
        <span>Novo titular</span><span>{t.toName}</span>
        <span>Valor</span><span>{t.priceSealed ? 'Preço selado' : t.priceCents ? formatBRL(t.priceCents) : '—'}</span>
      </div>
      <BuyerAccept token={token} status={t.status} signed={!!t.buyerSignedAt} />
    </main>
  )
}
