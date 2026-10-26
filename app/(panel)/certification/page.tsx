import { notFound } from 'next/navigation'
import { requirePanelPage } from '../_session'
import { flagOn } from '@/lib/flags'
import { certificationView } from '@/lib/certificates/server'
import { CertificationScreen } from '@/components/certification/CertificationScreen'

export const metadata = { title: 'Certificação — HouseArt' }

export default async function CertificationPage() {
  const { scope } = await requirePanelPage('/certification')
  if (!flagOn('FLAG_CERTIFICATES')) notFound()
  const view = await certificationView(scope)
  return <CertificationScreen items={view.items} orders={view.orders} kitUnitCents={view.kitUnitCents} canOrder={flagOn('FLAG_PHYSICAL_MARKERS') && scope.kind !== 'total'} />
}
