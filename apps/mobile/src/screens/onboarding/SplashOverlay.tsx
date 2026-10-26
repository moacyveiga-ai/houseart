// Splash (handoff "HouseArt App Colecionador" / "App Galeria" › Splash): paper background, the vertical
// brand mark at 180 px fading in, two seconds, a tap skips it. It sits over the app while the session
// resolves, so the native splash (same mark, same paper — app.json) hands over without a jump.
import { useEffect, useRef, useState } from 'react'
import { Animated, Easing, Pressable, StyleSheet } from 'react-native'
import { theme } from '@/theme'
import { SPLASH_MS } from './core'

const MARK = require('../../../assets/brand/marca_houseart_full_45_vert_color.png')

export function SplashOverlay({ ready }: { ready: boolean }) {
  const mark = useRef(new Animated.Value(0)).current
  const cover = useRef(new Animated.Value(1)).current
  const [elapsed, setElapsed] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    Animated.timing(mark, { toValue: 1, duration: 700, easing: Easing.bezier(0.2, 0, 0, 1), useNativeDriver: true }).start()
    const t = setTimeout(() => setElapsed(true), SPLASH_MS)
    return () => clearTimeout(t)
  }, [mark])

  useEffect(() => {
    if (!elapsed || !ready || gone) return
    Animated.timing(cover, { toValue: 0, duration: 240, useNativeDriver: true }).start(() => setGone(true))
  }, [elapsed, ready, gone, cover])

  if (gone) return null
  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.wrap, { opacity: cover }]} pointerEvents="box-none">
      <Pressable style={styles.tap} accessibilityRole="button" accessibilityLabel="Pular abertura" onPress={() => setElapsed(true)}>
        <Animated.Image source={MARK} accessibilityLabel="houseArt" resizeMode="contain" style={[styles.mark, { opacity: mark }]} />
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: theme.bg, zIndex: 70 },
  tap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  mark: { width: 180, height: 197 }, // the mark is 335 × 367
})
