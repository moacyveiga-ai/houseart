import { NotificationsScreen } from '@/screens/NotificationsScreen'
import { WebScreen } from '@/ui/WebScreen'
import { useSession } from '@/auth/session'
import { TABS, isNativeTab } from '@/nav/tabs'

/** Avisos is native for the artist (the only set with the tab today); the web page for the rest. */
export default function Screen() {
  const { me } = useSession()
  return isNativeTab(me?.activeProfileKind ?? null, 'notifications') ? <NotificationsScreen /> : <WebScreen path={TABS.notifications.path ?? '/'} />
}
