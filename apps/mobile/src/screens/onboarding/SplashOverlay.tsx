// Splash — the same experience as the web login (decision of Moacy, 2026-10-28): a public-domain painting
// picked at random fills the screen under a dark veil, the negative brand mark on top, and at the bottom
// the claim "Sua coleção, com escritura.", the tagline and the painting's credit. Two seconds at least
// (and until the session resolves); a tap skips it. The painting comes from the API host and fades in
// when it loads — offline or slow, the dark screen with the mark and the claim stays. The native splash
// (app.json) is the same ink with the mark, so the handover has no flash of paper.
import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors } from '@/theme'
import { absUrl } from '@/ui/format'
import { Display } from '@/ui/kit'
import { SPLASH_MS } from './core'
import { randomWall } from './paintings'

/** The login's veil (45 % → 15 % at a third → 82 % at the bottom), sampled in 24 bands. */
const VEIL = veilBands(24)

const MARK = require('../../../assets/brand/marca_houseart_full_horiz_negativo.png')

export function SplashOverlay({ ready }: { ready: boolean }) {
  const insets = useSafeAreaInsets()
  const [wall] = useState(() => randomWall())
  const uri = absUrl(wall.path)
  const content = useRef(new Animated.Value(0)).current
  const picture = useRef(new Animated.Value(0)).current
  const cover = useRef(new Animated.Value(1)).current
  const [elapsed, setElapsed] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    Animated.timing(content, { toValue: 1, duration: 700, easing: Easing.bezier(0.2, 0, 0, 1), useNativeDriver: true }).start()
    const t = setTimeout(() => setElapsed(true), SPLASH_MS)
    return () => clearTimeout(t)
  }, [content])

  useEffect(() => {
    if (!elapsed || !ready || gone) return
    Animated.timing(cover, { toValue: 0, duration: 240, useNativeDriver: true }).start(() => setGone(true))
  }, [elapsed, ready, gone, cover])

  const showPicture = () => Animated.timing(picture, { toValue: 1, duration: 600, useNativeDriver: true }).start()

  if (gone) return null
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.wrap, { opacity: cover }]} pointerEvents="box-none">
      <StatusBar style="light" />
      {uri ? <Animated.Image source={{ uri }} onLoad={showPicture} resizeMode="cover" style={[StyleSheet.absoluteFill, { opacity: picture }]} accessibilityIgnoresInvertColors /> : null}
      {/* the veil of the login panel (no gradient library in the app: 24 bands of the same curve) */}
      <View style={[StyleSheet.absoluteFill, styles.veil]} pointerEvents="none">
        {VEIL.map((a, k) => <View key={k} style={{ flex: 1, backgroundColor: `rgba(17,17,17,${a})` }} />)}
      </View>
      <Pressable style={[styles.tap, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]} accessibilityRole="button" accessibilityLabel="Pular abertura" onPress={() => setElapsed(true)}>
        <Animated.View style={{ opacity: content }}>
          <Animated.Image source={MARK} accessibilityLabel="houseArt" resizeMode="contain" style={styles.mark} />
        </Animated.View>
        <Animated.View style={[styles.hero, { opacity: content }]}>
          <Display size={36} line={42} color={colors.paper50}>Sua coleção, <Display italic size={36} line={42} color={colors.paper50}>com escritura.</Display></Display>
          <Text style={styles.tagline}>Acompanhe ofertas, entregas e certificados das suas obras em um só lugar.</Text>
          <Text style={styles.credit}>{wall.credit}</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.ink900, zIndex: 70 },
  veil: { flexDirection: 'column' },
  tap: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  mark: { width: 159, height: 50 }, // the mark is 539 × 170
  hero: { gap: 12 },
  tagline: { fontSize: 16, lineHeight: 24, color: '#E8E4DC' },
  credit: { fontSize: 12, lineHeight: 16, color: '#E8E4DC', opacity: 0.85 },
})

export function veilBands(n: number): string[] {
  return Array.from({ length: n }, (_, k) => {
    const y = (k + 0.5) / n
    const a = y < 0.35 ? 0.45 + (0.15 - 0.45) * (y / 0.35) : 0.15 + (0.82 - 0.15) * ((y - 0.35) / 0.65)
    return a.toFixed(3)
  })
}
