import { WebScreen } from '@/ui/WebScreen'
import { TABS } from '@/nav/tabs'

export default function Screen() {
  return <WebScreen path={TABS.messages.path ?? '/'} />
}
