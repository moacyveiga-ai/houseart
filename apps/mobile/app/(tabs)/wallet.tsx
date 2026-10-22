import { CollectionScreen } from '@/screens/CollectionScreen'
import { WebScreen } from '@/ui/WebScreen'
import { useSession } from '@/auth/session'
import { isCollector } from '@/nav/tabs'

/** Minha coleção is native for the collector; the other profiles keep their web "Carteira". */
export default function Screen() {
  const { me } = useSession()
  return isCollector(me?.activeProfileKind ?? null) ? <CollectionScreen /> : <WebScreen path="/wallet" />
}
