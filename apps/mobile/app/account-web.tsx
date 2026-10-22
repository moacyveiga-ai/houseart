import { Stack } from 'expo-router'
import { WebScreen } from '@/ui/WebScreen'
import { theme } from '@/theme'

/** /account of the site (data, phone, preferences) inside the app. */
export default function AccountWeb() {
  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Minha conta', headerTintColor: theme.fg, headerStyle: { backgroundColor: theme.bg } }} />
      <WebScreen path="/account" />
    </>
  )
}
