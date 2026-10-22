import { DayPanelScreen } from '@/screens/gallery/DayPanelScreen'
import { WebScreen } from '@/ui/WebScreen'
import { useSession } from '@/auth/session'
import { TABS, isNativeTab } from '@/nav/tabs'

/** Galeria · painel do dia is native for the gallery and the advisor; the artist keeps the web Início. */
export default function Screen() {
  const { me } = useSession()
  return isNativeTab(me?.activeProfileKind ?? null, 'home') ? <DayPanelScreen /> : <WebScreen path={TABS.home.path ?? '/'} />
}
