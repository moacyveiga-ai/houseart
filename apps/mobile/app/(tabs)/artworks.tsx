import { InventoryScreen } from '@/screens/gallery/InventoryScreen'
import { WebScreen } from '@/ui/WebScreen'
import { useSession } from '@/auth/session'
import { TABS, isNativeTab } from '@/nav/tabs'

/** Acervo is native for the gallery and the advisor; the artist keeps the web Obras. */
export default function Screen() {
  const { me } = useSession()
  return isNativeTab(me?.activeProfileKind ?? null, 'artworks') ? <InventoryScreen /> : <WebScreen path={TABS.artworks.path ?? '/'} />
}
