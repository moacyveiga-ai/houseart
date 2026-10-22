import { SalesScreen } from '@/screens/gallery/SalesScreen'
import { CollectorSalesScreen } from '@/screens/collector/CollectorSalesScreen'
import { WebScreen } from '@/ui/WebScreen'
import { useSession } from '@/auth/session'
import { TABS, isNativeTab } from '@/nav/tabs'

/** Negócios (Ofertas · Vendas · Regras) is native for the gallery and the advisor; Vendas for the collector. */
export default function Screen() {
  const { me } = useSession()
  if (me?.activeProfileKind === 'COLLECTOR') return <CollectorSalesScreen />
  return isNativeTab(me?.activeProfileKind ?? null, 'sales') ? <SalesScreen /> : <WebScreen path={TABS.sales.path ?? '/'} />
}
