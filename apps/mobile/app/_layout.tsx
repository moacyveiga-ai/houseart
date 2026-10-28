import { useEffect, useState } from 'react'
import { useFonts } from 'expo-font'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { SessionProvider, useSession } from '@/auth/session'
import { FONT_FILES, colors, theme } from '@/theme'
import { setDisplayFontLoaded } from '@/ui/kit'
import { SplashOverlay } from '@/screens/onboarding/SplashOverlay'
import { onboardingSeen } from '@/screens/onboarding/seen'
import { homeHref } from '@/nav/tabs'

void SplashScreen.preventAutoHideAsync().catch(() => undefined)

/** Sends the person to the right door: login, profile chooser or the tabs. */
function Gate() {
  const { status, me, profiles } = useSession()
  const segments = useSegments()
  const router = useRouter()
  // the three onboarding slides are shown once per device, before the first login
  const [seen, setSeen] = useState<boolean | null>(null)
  useEffect(() => { void onboardingSeen().then(setSeen) }, [])

  useEffect(() => {
    if (status === 'loading') return
    void SplashScreen.hideAsync().catch(() => undefined)
    const inAuth = segments[0] === '(auth)'
    if (status === 'signed-out') {
      if (seen === null) return
      const onOnboarding = inAuth && (segments as string[])[1] === 'onboarding'
      if (!seen && !onOnboarding) {
        // the onboarding marks itself seen before leaving: read again so "Começar" does not bounce back
        void onboardingSeen().then((v) => { if (v) setSeen(true); else router.replace('/(auth)/onboarding') })
        return
      }
      if (!inAuth) router.replace('/(auth)/login')
      return
    }
    // Signed in: with several profiles and none chosen, choose first.
    const mustChoose = !me?.activeProfileKind && profiles.length > 1
    if (mustChoose) {
      if (segments[0] !== 'profiles') router.replace('/profiles')
      return
    }
    if (inAuth || segments[0] === 'profiles' || !segments[0]) router.replace(homeHref(me?.activeProfileKind ?? null) as never)
  }, [status, seen, me?.activeProfileKind, profiles.length, segments, router])

  return null
}

/** The brand mark over the first screen, until the session is known (and at least SPLASH_MS). */
function Splash() {
  const { status } = useSession()
  return <SplashOverlay ready={status !== 'loading'} />
}

export default function RootLayout() {
  // Fraunces (assets/fonts): the tree waits for the files; on an error the system serif stays.
  const [fontsLoaded, fontsError] = useFonts(FONT_FILES)
  const ready = fontsLoaded || !!fontsError
  setDisplayFontLoaded(fontsLoaded && !fontsError)
  if (!ready) return null
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
            <Stack.Screen name="artwork/[publicId]/index" />
            <Stack.Screen name="artwork/[publicId]/offer" />
            <Stack.Screen name="artwork/[publicId]/buy" />
            <Stack.Screen name="offer/[code]" />
            <Stack.Screen name="messages/[id]" />
            <Stack.Screen name="favorites" />
            <Stack.Screen name="search" />
            <Stack.Screen name="artworks/[id]/listing" />
            <Stack.Screen name="artworks/new" options={{ contentStyle: { backgroundColor: colors.ink900 } }} />
            <Stack.Screen name="certification/link/[artworkId]" options={{ contentStyle: { backgroundColor: colors.ink900 } }} />
            <Stack.Screen name="deal/[id]" />
            <Stack.Screen name="sales/rules" />
            <Stack.Screen name="gallery/team" />
            <Stack.Screen name="gallery/artists" />
            <Stack.Screen name="gallery/account" />
            <Stack.Screen name="purchases/index" />
            <Stack.Screen name="purchases/[id]/index" />
            <Stack.Screen name="purchases/[id]/receive" options={{ contentStyle: { backgroundColor: colors.ink900 } }} />
            <Stack.Screen name="sales/collector" />
            <Stack.Screen name="sales/payout" />
            <Stack.Screen name="wallet/register" />
            <Stack.Screen name="wallet/cards" />
            <Stack.Screen name="wallet/sell/[id]" />
            <Stack.Screen name="wallet/restore/[id]" />
            <Stack.Screen name="verify" />
            <Stack.Screen name="settings" options={{ headerShown: true, title: 'Perfil', headerTintColor: theme.fg, headerStyle: { backgroundColor: theme.bg } }} />
          </Stack>
          <Splash />
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
