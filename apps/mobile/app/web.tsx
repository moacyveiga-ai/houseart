import { Stack, useLocalSearchParams } from 'expo-router'
import { WebScreen } from '@/ui/WebScreen'
import { theme } from '@/theme'

/**
 * A web journey pushed from a native screen: `/web?path=/e/artwork/X/offer&title=Fazer oferta`.
 * Only paths of the site (leading slash, no host) are accepted.
 */
export default function Web() {
  const { path, title } = useLocalSearchParams<{ path?: string; title?: string }>()
  const safe = typeof path === 'string' && /^\/[^/]/.test(path) ? path : '/'
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: typeof title === 'string' && title ? title : 'HouseArt', headerTintColor: theme.fg, headerStyle: { backgroundColor: theme.bg } }} />
      <WebScreen path={safe} />
    </>
  )
}
