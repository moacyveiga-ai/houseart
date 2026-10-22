import { notFound } from 'next/navigation'
import { requirePanelPage } from '../../../_session'
import { flagOn } from '@/lib/flags'
import { getArtwork } from '@/lib/artworks/server'
import { certificationView } from '@/lib/certificates/server'
import { LinkMarkerScreen } from '@/components/certification/LinkMarkerScreen'
import { Icon } from '@/components/ds/Icon'

export const metadata = { title: 'Vincular etiqueta — HouseArt' }

/** "Vincular etiqueta" (handoff "HouseArt App Artista" › leitor) on the web: Web NFC where it exists, QR/URL elsewhere. */
export default async function LinkMarkerPage({ params }: { params: Promise<{ artworkId: string }> }) {
  const id = Number((await params).artworkId)
  const { scope } = await requirePanelPage(`/certification/link/${id}`)
  if (!flagOn('FLAG_CERTIFICATES') || !flagOn('FLAG_PHYSICAL_MARKERS')) notFound()
  const a = Number.isInteger(id) && id > 0 ? await getArtwork(scope, id) : null
  if (!a) notFound()
  const title = `${a.title}${a.year ? `, ${a.year}` : ''}`
  const signed = (a.certificate?.stage ?? 0) >= 4
  // Only an artwork in certification, not yet signed, goes through this screen (a linked one still has to sign).
  if (a.status !== 'IN_CERTIFICATION' || signed) {
    return (
      <div className="ha-page">
        <div className="ha-page__head"><h1 className="ha-h1">Vincular etiqueta</h1></div>
        <div className="ha-callout"><Icon name="info" />
          <div>
            <b>{title}</b><br />
            {signed ? 'Esta obra já tem etiqueta vinculada e certificado assinado.' : a.status === 'DRAFT' ? 'Esta obra ainda não foi enviada para certificação — termine o cadastro e envie.' : 'Esta obra não está em certificação.'}
            <br /><a className="ha-link" href="/certification">Voltar à certificação</a>
          </div>
        </div>
      </div>
    )
  }
  // The certificate id (for the signature) comes from the certification view once the link created it.
  const certificateId = a.publicId ? (await certificationView(scope)).items.find((i) => i.id === a.id)?.certificateId ?? null : null
  // Dev only: MARKER_VENDOR=mock outside production allows the simulated tap (the same rule of the route).
  const simulateAllowed = (process.env.MARKER_VENDOR ?? 'mock') === 'mock' && process.env.NODE_ENV !== 'production' && process.env.VERCEL_ENV !== 'production'
  return (
    <div className="ha-page">
      <LinkMarkerScreen artworkId={a.id} artworkTitle={title} publicId={a.publicId} certificateId={certificateId} simulateAllowed={simulateAllowed} />
    </div>
  )
}
