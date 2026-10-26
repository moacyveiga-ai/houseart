import { notFound } from 'next/navigation'
import { requirePanelPage } from '../_session'
import { flagOn } from '@/lib/flags'
import { certificationView } from '@/lib/certificates/server'
import { CertificationScreen } from '@/components/certification/CertificationScreen'

export const metadata = { title: 'Certificação — HouseArt' }

export default async function CertificationPage({ searchParams }: { searchParams: Promise<{ qty?: string }> }) {
  const { scope } = await requirePanelPage('/certification')
  if (!flagOn('FLAG_CERTIFICATES')) notFound()
  const view = await certificationView(scope)
  // ?qty= comes from the selection bar of Minhas obras ("Solicitar etiquetas"): the kit opens with that many
  const qty = Number((await searchParams).qty)
  return <CertificationScreen items={view.items} orders={view.orders} kitUnitCents={view.kitUnitCents ?? undefined} initialQty={Number.isInteger(qty) ? qty : undefined} canOrder={flagOn('FLAG_PHYSICAL_MARKERS') && scope.kind !== 'total' && view.kitUnitCents !== null} />
}
