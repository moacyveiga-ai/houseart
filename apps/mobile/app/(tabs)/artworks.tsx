import { InventoryScreen } from '@/screens/gallery/InventoryScreen'
import { WebScreen } from '@/ui/WebScreen'
import { useSession } from '@/auth/session'
import { TABS, isNativeTab } from '@/nav/tabs'

/** Acervo (gallery, advisor) and Obras (artist) are the same native list; the artist's "+" is the native camera. */
export default function Screen() {
  const { me } = useSession()
  const kind = me?.activeProfileKind ?? null
  return isNativeTab(kind, 'artworks') ? <InventoryScreen artist={kind === 'ARTIST'} /> : <WebScreen path={TABS.artworks.path ?? '/'} />
}
