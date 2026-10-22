// The small pieces every native screen reuses: icon, wall, avatar, chip,
// icon button, header bar, loading / error / toast. Colours only from theme.
import { useEffect } from 'react'
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { useRouter } from 'expo-router'
import { MaterialIcons } from '@expo/vector-icons'
import { colors, fonts, theme } from '@/theme'
import { absUrl } from './format'
import { Button, Muted } from './primitives'

export type IconName = React.ComponentProps<typeof MaterialIcons>['name']

export function Icon({ name, size = 24, color = theme.fg }: { name: IconName; size?: number; color?: string }) {
  return <MaterialIcons name={name} size={size} color={color} />
}

export function IconButton({ name, label, onPress, color = theme.fg, size = 24, box = 44, disabled }: { name: IconName; label: string; onPress?: () => void; color?: string; size?: number; box?: number; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled} hitSlop={4} style={({ pressed }) => [{ width: box, height: box, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.6 }]}>
      <Icon name={name} size={size} color={color} />
    </Pressable>
  )
}

/** The "parede": an artwork on the wall, contained, with the wall token behind. */
export function Wall({ uri, padding = 44, style, square = true }: { uri: string | null | undefined; padding?: number; style?: StyleProp<ViewStyle>; square?: boolean }) {
  const src = absUrl(uri)
  return (
    <View style={[styles.wall, square && { aspectRatio: 1 }, { padding }, style]}>
      {src ? <Image source={{ uri: src }} resizeMode="contain" style={styles.wallImg} accessibilityIgnoresInvertColors /> : null}
    </View>
  )
}

export function Avatar({ initials, bg, fg, size = 38 }: { initials: string; bg: string; fg: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: fg, fontSize: Math.round(size * 0.32), fontWeight: '600' }}>{initials}</Text>
    </View>
  )
}

export function Chip({ label, on, onPress, icon }: { label: string; on?: boolean; onPress?: () => void; icon?: IconName }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!on }} onPress={onPress} style={[styles.chip, on ? styles.chipOn : styles.chipOff]}>
      {icon ? <Icon name={icon} size={16} color={on ? theme.bg : theme.fg} /> : null}
      <Text style={[styles.chipText, on && { color: theme.bg }]}>{label}</Text>
    </Pressable>
  )
}

/** Fraunces-style display text (system serif until the font ships). */
export function Display({ children, italic, size = 28, line, color = theme.fg, style }: { children: React.ReactNode; italic?: boolean; size?: number; line?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  return <Text style={[{ fontFamily: Platform.select(fonts.display), fontSize: size, lineHeight: line ?? Math.round(size * 1.25), color, fontStyle: italic ? 'italic' : 'normal' }, style as never]}>{children}</Text>
}

/** Back + title + right actions, under the status bar (the screen handles the safe area). */
export function TopBar({ title, right, onBack }: { title?: string; right?: React.ReactNode; onBack?: () => void }) {
  const router = useRouter()
  return (
    <View style={styles.topBar}>
      <IconButton name="arrow-back" label="Voltar" onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/(tabs)')))} />
      {title ? <Text style={styles.topTitle} numberOfLines={1}>{title}</Text> : <View style={{ flex: 1 }} />}
      {right}
    </View>
  )
}

export function Loading() {
  return <View style={styles.center}><ActivityIndicator color={theme.accent} /></View>
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Muted>{message}</Muted>
      {onRetry ? <Button title="Tentar de novo" variant="ghost" onPress={onRetry} /> : null}
    </View>
  )
}

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => { if (!message) return; const t = setTimeout(onDone, 2200); return () => clearTimeout(t) }, [message, onDone])
  if (!message) return null
  return (
    <View pointerEvents="none" style={styles.toast} accessibilityLiveRegion="polite">
      <Text style={styles.toastText}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wall: { backgroundColor: theme.wall, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  wallImg: { width: '100%', height: '100%' },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: theme.radiusFull, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipOn: { backgroundColor: theme.fg, borderColor: theme.fg },
  chipOff: { backgroundColor: theme.bg, borderColor: theme.fgDisabled },
  chipText: { fontSize: 13, fontWeight: '600', color: theme.fg },
  topBar: { height: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, backgroundColor: theme.bg },
  topTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: theme.fg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12, backgroundColor: theme.bg },
  toast: { position: 'absolute', left: 16, right: 16, bottom: 24, backgroundColor: colors.ink900, borderRadius: theme.radiusMd, paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center' },
  toastText: { color: colors.paper50, fontSize: 13, fontWeight: '600' },
})
