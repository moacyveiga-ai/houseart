import { ActivityIndicator } from 'react-native'
import { Centered } from '@/ui/primitives'
import { theme } from '@/theme'

/** The Gate in the root layout decides where to go; this only waits. */
export default function Index() {
  return <Centered><ActivityIndicator color={theme.accent} /></Centered>
}
