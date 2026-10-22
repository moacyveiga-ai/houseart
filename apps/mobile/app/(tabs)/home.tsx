import { DayPanelScreen } from '@/screens/gallery/DayPanelScreen'
import { ArtistHomeScreen } from '@/screens/artist/ArtistHomeScreen'
import { WebScreen } from '@/ui/WebScreen'
import { useSession } from '@/auth/session'
import { TABS, isNativeTab } from '@/nav/tabs'

/** Início: the gallery's painel do dia, the artist's Início; the web Início for the profiles without a native one. */
export default function Screen() {
  const { me } = useSession()
  const kind = me?.activeProfileKind ?? null
  if (!isNativeTab(kind, 'home')) return <WebScreen path={TABS.home.path ?? '/'} />
  return kind === 'ARTIST' ? <ArtistHomeScreen /> : <DayPanelScreen />
}
