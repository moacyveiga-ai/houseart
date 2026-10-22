import { DeedsScreen } from '@/screens/artist/DeedsScreen'
import { WebScreen } from '@/ui/WebScreen'
import { useSession } from '@/auth/session'
import { TABS, isNativeTab } from '@/nav/tabs'

/** Carteira de escrituras is native for the artist; the web Certificação for the rest. */
export default function Screen() {
  const { me } = useSession()
  return isNativeTab(me?.activeProfileKind ?? null, 'certification') ? <DeedsScreen /> : <WebScreen path={TABS.certification.path ?? '/'} />
}
