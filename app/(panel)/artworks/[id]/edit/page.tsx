import { notFound } from 'next/navigation'
import { requirePanelPage } from '../../../_session'
import { getArtwork } from '@/lib/artworks/server'
import { ArtworkWizard, type WizardArtwork } from '@/components/artworks/ArtworkWizard'
import { ListForSaleDialog } from '@/components/artworks/ListForSaleDialog'
import Link from 'next/link'
import { Icon } from '@/components/ds/Icon'

export const metadata = { title: 'Cadastro de obra — HouseArt' }

export default async function EditArtworkPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  const { scope, user } = await requirePanelPage(`/artworks/${id}/edit`)
  const a = Number.isInteger(id) && id > 0 ? await getArtwork(scope, id) : null
  if (!a) notFound()
  const initial: WizardArtwork = {
    id: a.id, title: a.title, year: a.year, category: a.category, technique: a.technique, materials: a.materials, heightMm: a.heightMm, widthMm: a.widthMm, depthMm: a.depthMm,
    edition: a.edition, signatureLocation: a.signatureLocation, series: a.series, status: a.status, conditionGrade: a.conditionGrade,
    conditionBy: a.conditionBy, conditionAt: a.conditionAt?.toISOString() ?? null, saleMode: a.saleMode,
    listPriceCents: a.listPriceCents === null ? null : Number(a.listPriceCents), wizardStep: a.wizardStep,
    media: a.media.map((m) => ({ id: m.id, kind: m.kind, publicUrl: m.publicUrl, quality: m.quality })),
    conditionRegions: a.conditionRegions.map((r) => ({ region: r.region, note: r.note, state: r.state })),
    historyItems: a.historyItems.map((h) => ({ kind: h.kind, description: h.description, occurredOn: h.occurredOn })),
    duplicates: a.duplicateChecks.map((d) => ({ id: d.id, similarityBps: d.similarityBps, candidate: { title: d.candidate.title, year: d.candidate.year, publicId: d.candidate.publicId, mine: d.candidate.memberId === user.memberId } })),
    artistName: a.artist.name,
  }
  const saleable = a.status === 'AUTHENTICATED' || a.status === 'LISTED'
  return (
    <>
      {saleable ? <div className="ha-page" style={{ paddingBottom: 0 }}><div className="ha-row ha-row--end" style={{ gap: 'var(--ha-space-2)' }}>{a.status === 'LISTED' ? <Link href={`/artworks/${a.id}/listing`} className="ha-btn ha-btn--outline ha-btn--sm"><Icon name="tune" size={18} />Gestão do anúncio</Link> : null}<ListForSaleDialog artworkId={a.id} title={a.title} defaultPrice={a.listPriceCents ? String(Number(a.listPriceCents) / 100) : ''} listed={a.status === 'LISTED'} /></div></div> : null}
      <ArtworkWizard initial={initial} userName={user.name} />
    </>
  )
}
