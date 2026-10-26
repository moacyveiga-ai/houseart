import { notFound, redirect } from 'next/navigation'
import { requirePanelPage } from '../_session'
import { flagOn } from '@/lib/flags'
import { heldArtworks, listTransfers } from '@/lib/ownership/server'
import { TransferWizard } from '@/components/transfer/TransferWizard'
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'

export const metadata = { title: 'Transferir obra — HouseArt' }

export default async function TransferPage({ searchParams }: { searchParams: Promise<{ artworkId?: string }> }) {
  const { user } = await requirePanelPage('/transfer')
  if (!flagOn('FLAG_OWNERSHIP_TRANSFER')) notFound()
  const held = await heldArtworks(user.id)
  const id = Number((await searchParams).artworkId)
  // The work asked for (?artworkId=) must be one the viewer HOLDS: never fall back to another deed
  // (the gallery's "Vendida fora" opened by a colleague would silently show a different work).
  const askedId = Number.isInteger(id) && id > 0 ? id : null
  const asked = askedId ? held.find((v) => v.certificate.artworkId === askedId) ?? null : null
  if (askedId && !asked) {
    return (
      <div className="ha-page">
        <h1 className="ha-h1">Transferir obra</h1>
        <div className="ha-callout"><Icon name="info" size={20} /><span className="ha-stack" style={{ gap: 4 }}><b>A escritura desta obra não está no seu nome</b><span className="ha-sm">Só o titular transfere a escritura.{held.length ? ' As obras que você tem em seu nome:' : ''}</span>
          {held.length ? <ul className="ha-sm" style={{ margin: 0, paddingLeft: 18 }}>{held.map((v) => <li key={v.id}><Link href={`/transfer?artworkId=${v.certificate.artworkId}`} className="ha-link">{v.certificate.artwork.title}</Link></li>)}</ul> : null}
        </span></div>
      </div>
    )
  }
  const chosen = asked ?? held[0]
  if (!chosen) return <div className="ha-page"><h1 className="ha-h1">Transferir obra</h1><p className="ha-muted">Você ainda não é titular de nenhuma obra certificada.</p></div>
  if (!asked) redirect(`/transfer?artworkId=${chosen.certificate.artworkId}`)
  const a = chosen.certificate.artwork
  const open = (await listTransfers(user.id)).find((t) => t.artworkId === a.id && t.status !== 'CANCELLED' && t.status !== 'COMPLETED')
  return (
    <div className="ha-page">
      <TransferWizard artwork={{ id: a.id, title: a.title, year: a.year, artist: a.artist.name, publicId: a.publicId }} existing={open ? { id: open.id, status: open.status, sellerSignedAt: open.sellerSignedAt?.toISOString() ?? null, buyerSignedAt: open.buyerSignedAt?.toISOString() ?? null, toName: open.toName, priceCents: open.priceCents?.toString() ?? null, priceSealed: open.priceSealed, royaltyCents: open.royaltyCents.toString(), feeCents: open.feeCents.toString() } : null} />
    </div>
  )
}
