import { notFound, redirect } from 'next/navigation'
import { requirePanelPage } from '../_session'
import { flagOn } from '@/lib/flags'
import { heldArtworks, listTransfers } from '@/lib/ownership/server'
import { TransferWizard } from '@/components/transfer/TransferWizard'

export const metadata = { title: 'Transferir obra — HouseArt' }

export default async function TransferPage({ searchParams }: { searchParams: Promise<{ artworkId?: string }> }) {
  const { user } = await requirePanelPage('/transfer')
  if (!flagOn('FLAG_OWNERSHIP_TRANSFER')) notFound()
  const held = await heldArtworks(user.id)
  const id = Number((await searchParams).artworkId)
  const chosen = held.find((v) => v.certificate.artworkId === id) ?? held[0]
  if (!chosen) return <div className="ha-page"><h1 className="ha-h1">Transferir obra</h1><p className="ha-muted">Você ainda não é titular de nenhuma obra certificada.</p></div>
  if (!id) redirect(`/transfer?artworkId=${chosen.certificate.artworkId}`)
  const a = chosen.certificate.artwork
  const open = (await listTransfers(user.id)).find((t) => t.artworkId === a.id && t.status !== 'CANCELLED' && t.status !== 'COMPLETED')
  return (
    <div className="ha-page">
      <TransferWizard artwork={{ id: a.id, title: a.title, year: a.year, artist: a.artist.name, publicId: a.publicId }} existing={open ? { id: open.id, status: open.status, sellerSignedAt: open.sellerSignedAt?.toISOString() ?? null, buyerSignedAt: open.buyerSignedAt?.toISOString() ?? null, toName: open.toName, priceCents: open.priceCents?.toString() ?? null, priceSealed: open.priceSealed, royaltyCents: open.royaltyCents.toString(), feeCents: open.feeCents.toString() } : null} />
    </div>
  )
}
