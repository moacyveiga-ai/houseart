import { SalesScreen } from '@/screens/gallery/SalesScreen'
import { WebScreen } from '@/ui/WebScreen'
import { useSession } from '@/auth/session'
import { TABS, isNativeTab } from '@/nav/tabs'

/** Negócios (Ofertas · Vendas · Regras) is native for the gallery and the advisor. */
export default function Screen() {
  const { me } = useSession()
  return isNativeTab(me?.activeProfileKind ?? null, 'sales') ? <SalesScreen /> : <WebScreen path={TABS.sales.path ?? '/'} />
}
