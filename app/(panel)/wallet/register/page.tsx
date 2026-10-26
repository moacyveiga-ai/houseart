import { redirect } from 'next/navigation'
import { requirePanelPage } from '../../_session'
import { RegisterArtworkScreen, type RegisterDraft } from '@/components/collector/RegisterArtworkScreen'
import { collectorDraft } from '@/lib/collectors/server'

export const metadata = { title: 'Cadastrar obra — HouseArt' }

/**
 * Cadastrar obra do colecionador (handoff "HouseArt App Colecionador" › cadobra): Origem · Artista ·
 * Fotos guiadas · Ficha · Revisão → Pronto. The draft is born when the artist is chosen and the URL
 * carries it (?draft=<id>), so leaving and coming back resumes where it stopped.
 */
export default async function RegisterArtworkPage({ searchParams }: { searchParams: Promise<{ draft?: string }> }) {
  const { user } = await requirePanelPage('/wallet/register')
  const id = Number((await searchParams).draft)
  let draft: RegisterDraft | null = null
  if (Number.isInteger(id) && id > 0) {
    const a = await collectorDraft(user.id, id)
    if (!a) redirect('/wallet')
    draft = {
      id: a.id, acquisitionKind: a.acquisitionKind!, artistName: a.artist.name, title: a.title === 'Nova obra' ? '' : a.title,
      year: a.year, technique: a.technique, materials: a.materials, heightMm: a.heightMm, widthMm: a.widthMm, depthMm: a.depthMm,
      edition: a.edition, signatureLocation: a.signatureLocation, conditionGrade: a.conditionGrade,
      acquisitionYear: a.acquisitionYear, acquisitionFrom: a.acquisitionFrom, acquisitionNote: a.acquisitionNote,
      acquisitionPriceCents: a.acquisitionPriceCents === null ? null : a.acquisitionPriceCents.toString(),
      media: a.media.map((m) => ({ kind: m.kind, publicUrl: m.publicUrl, quality: m.quality })),
    }
  }
  return <div className="ha-page"><RegisterArtworkScreen draft={draft} /></div>
}
