import { notFound } from 'next/navigation'
import { requirePanelPage } from '../_session'
import { appraisalDossier, appraisalQueue } from '@/lib/appraisal/server'
import { AppraisalDesk } from '@/components/appraisal/AppraisalDesk'
import { flagOn } from '@/lib/flags'
import { hasTotalScope } from '@/lib/auth/profiles'

export const metadata = { title: 'Laudo de opinião de valor — HouseArt' }

export default async function AppraisalsPage({ searchParams }: { searchParams: Promise<{ pedido?: string }> }) {
  if (!flagOn('FLAG_APPRAISAL')) notFound()
  const { user } = await requirePanelPage('/appraisals')
  if (user.profile !== 'appraiser' && !hasTotalScope(user)) notFound()
  const queue = await appraisalQueue()
  const wanted = Number((await searchParams).pedido ?? '')
  const selectedId = queue.some((q) => q.id === wanted) ? wanted : queue[0]?.id ?? null
  const dossier = selectedId ? await appraisalDossier(selectedId) : null
  return <div className="ha-page"><AppraisalDesk queue={queue} dossier={dossier} /></div>
}
