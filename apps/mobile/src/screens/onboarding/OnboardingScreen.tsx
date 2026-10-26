// Onboarding (handoff "HouseArt App Artista" › Onboarding): dark screen, a 4:5 picture, the progress
// dots, the title in the display font, the text, and "Continuar" / "Começar" in sand. Three slides,
// shown once per device to a signed-out person before the login.
import { useEffect, useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '@/api/client'
import { colors } from '@/theme'
import { absUrl } from '@/ui/format'
import { Display } from '@/ui/kit'
import { ctaOf, ONBOARDING_SLIDES, pictureFor } from './core'
import { markOnboardingSeen } from './seen'

export function OnboardingScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [i, setI] = useState(0)
  const [covers, setCovers] = useState<(string | null)[]>([])

  useEffect(() => {
    let alive = true
    api<{ cover: string | null }[]>('/api/public/artworks').then((rows) => { if (alive && Array.isArray(rows)) setCovers(rows.slice(0, 9).map((r) => absUrl(r.cover))) }).catch(() => undefined)
    return () => { alive = false }
  }, [])

  const slide = ONBOARDING_SLIDES[Math.min(i, ONBOARDING_SLIDES.length - 1)]!
  const pic = pictureFor(i, covers)
  const finish = async () => { await markOnboardingSeen(); router.replace('/(auth)/login') }
  const next = () => (i < ONBOARDING_SLIDES.length - 1 ? setI(i + 1) : void finish())

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 40 }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Pular" onPress={() => void finish()} style={[styles.skip, { top: insets.top + 12 }]}><Text style={styles.skipText}>Pular</Text></Pressable>
      <View style={styles.picWrap}>
        <View style={styles.pic}>{pic ? <Image source={{ uri: pic }} style={styles.img} resizeMode="cover" accessibilityIgnoresInvertColors /> : null}</View>
      </View>
      <View style={styles.texts}>
        <View style={styles.dots} accessibilityLabel={`Passo ${i + 1} de ${ONBOARDING_SLIDES.length}`}>
          {ONBOARDING_SLIDES.map((s, k) => <View key={s.title} style={[styles.dot, k === i && styles.dotOn]} />)}
        </View>
        <Display size={34} line={40} color={colors.paper50}>{slide.title}</Display>
        <Text style={styles.text}>{slide.text}</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={next} style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}>
        <Text style={styles.ctaText}>{ctaOf(i)}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink900, paddingHorizontal: 24 },
  skip: { position: 'absolute', right: 16, padding: 10, zIndex: 2 },
  skipText: { color: colors.ink300, fontSize: 14, fontWeight: '600' },
  picWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pic: { width: '72%', aspectRatio: 4 / 5, borderWidth: 1, borderColor: colors.ink700, overflow: 'hidden', backgroundColor: colors.ink700 },
  img: { width: '100%', height: '100%' },
  texts: { gap: 12, marginTop: 32 },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { height: 4, width: 8, borderRadius: 999, backgroundColor: colors.ink500 },
  dotOn: { width: 24, backgroundColor: colors.sand500 },
  text: { fontSize: 16, lineHeight: 24, color: colors.ink300 },
  cta: { marginTop: 32, height: 52, borderRadius: 8, backgroundColor: colors.sand500, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: colors.ink900, fontWeight: '600', fontSize: 16 },
})
