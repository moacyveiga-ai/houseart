import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { SessionProvider, useSession } from '@/auth/session'
import { theme } from '@/theme'

void SplashScreen.preventAutoHideAsync().catch(() => undefined)

/** Sends the person to the right door: login, profile chooser or the tabs. */
function Gate() {
  const { status, me, profiles } = useSession()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    void SplashScreen.hideAsync().catch(() => undefined)
    const inAuth = segments[0] === '(auth)'
    if (status === 'signed-out') {
      if (!inAuth) router.replace('/(auth)/login')
      return
    }
    // Signed in: with several profiles and none chosen, choose first.
    const mustChoose = !me?.activeProfileKind && profiles.length > 1
    if (mustChoose) {
      if (segments[0] !== 'profiles') router.replace('/profiles')
      return
    }
    if (inAuth || segments[0] === 'profiles' || !segments[0]) router.replace('/(tabs)')
  }, [status, me?.activeProfileKind, profiles.length, segments, router])

  return null
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <Gate />
          <StatusBar style="dark" backgroundColor={theme.bg} />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="profiles" options={{ headerShown: true, title: 'Escolher perfil', headerBackVisible: false }} />
            <Stack.Screen name="account-web" />
            <Stack.Screen name="web" />
            <Stack.Screen name="artwork/[publicId]" />
            <Stack.Screen name="messages/[id]" />
            <Stack.Screen name="favorites" />
            <Stack.Screen name="search" />
            <Stack.Screen name="settings" options={{ headerShown: true, title: 'Perfil', headerTintColor: theme.fg, headerStyle: { backgroundColor: theme.bg } }} />
          </Stack>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
