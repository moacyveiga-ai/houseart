// Descobrir: one card, drag right to like, left to pass; buttons Passar ·
// Salvar · Curtir · Ver obra. Decisions live here (the prototype's `dec`);
// like and save go to the server through `react`.
import { useState } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import type { ExploreItem } from '@/api/types'
import type { ReactionKind } from '@/api/reactions'
import { theme } from '@/theme'
import { Display, Icon } from '@/ui/kit'
import { Button } from '@/ui/primitives'
import { absUrl, brl, sheetLine } from '@/ui/format'
import { deckCounter } from './explore-core'

const THRESHOLD = 90
const FLY = 420

export function DiscoverDeck({ items, react }: { items: ExploreItem[]; react: (item: ExploreItem, kind: ReactionKind, quiet?: boolean) => Promise<boolean> }) {
  const router = useRouter()
  const [decided, setDecided] = useState<Record<number, true>>({})
  const [flying, setFlying] = useState(false)
  const dx = useSharedValue(0)
  const dy = useSharedValue(0)
  const deck = items.filter((i) => !decided[i.id])
  const top = deck[0]
  const total = items.length

  function settle(item: ExploreItem) {
    setDecided((d) => ({ ...d, [item.id]: true }))
    dx.value = 0; dy.value = 0
    setFlying(false)
  }
  function decide(kind: 'pass' | 'like' | 'save') {
    if (!top || flying) return
    const item = top
    setFlying(true)
    if (kind === 'like' && !item.liked) void react(item, 'LIKE', true)
    if (kind === 'save' && !item.saved) void react(item, 'SAVE')
    const toX = kind === 'pass' ? -FLY : kind === 'like' ? FLY : 0
    const toY = kind === 'save' ? -600 : 0
    dy.value = withTiming(toY, { duration: 240 })
    dx.value = withTiming(toX, { duration: 240 }, (done) => { if (done) runOnJS(settle)(item) })
  }

  const pan = Gesture.Pan()
    .enabled(!flying)
    .onUpdate((e) => { dx.value = e.translationX })
    .onEnd((e) => {
      if (e.translationX > THRESHOLD) runOnJS(decide)('like')
      else if (e.translationX < -THRESHOLD) runOnJS(decide)('pass')
      else dx.value = withTiming(0, { duration: 240 })
    })

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dx.value }, { translateY: dy.value }, { rotate: `${dx.value / 22}deg` }] }))
  const likeStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, dx.value / THRESHOLD)) }))
  const passStyle = useAnimatedStyle(() => ({ opacity: Math.max(0, Math.min(1, -dx.value / THRESHOLD)) }))

  if (!top) {
    return (
      <View style={styles.empty}>
        <Icon name="style" size={36} color={theme.accentStrong} />
        <Display size={24} line={30}>Você viu todas as obras de hoje.</Display>
        <Text style={styles.emptyS}>As curtidas e as salvas estão na sua coleção. Novas obras entram toda manhã.</Text>
        <View style={styles.emptyRow}>
          <Button title="Ver salvas" onPress={() => router.push('/favorites')} />
          <Button title="Recomeçar" variant="ghost" onPress={() => setDecided({})} />
        </View>
      </View>
    )
  }
  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.card, cardStyle]}>
            <View style={styles.cardWall}>
              {top.cover ? <Image source={{ uri: absUrl(top.cover)! }} resizeMode="contain" style={styles.cardImg} /> : null}
              <Animated.View style={[styles.stamp, styles.stampPass, passStyle]}><Text style={[styles.stampText, { color: theme.fg }]}>PASSAR</Text></Animated.View>
              <Animated.View style={[styles.stamp, styles.stampLike, likeStyle]}><Text style={[styles.stampText, { color: theme.error }]}>CURTIR</Text></Animated.View>
            </View>
            <View style={styles.cap}>
              <Text style={styles.artist}>{top.artist}</Text>
              <Display italic size={22} line={28}>{top.title}</Display>
              <Text style={styles.sheet}>{sheetLine(top)}</Text>
              <View style={styles.row}><Text style={styles.price}>{brl(top.priceCents)}</Text><Text style={styles.vend}>{top.seller}</Text></View>
            </View>
          </Animated.View>
        </GestureDetector>
      </View>
      <View style={styles.btns}>
        <RoundButton label="Passar" size={56} onPress={() => decide('pass')}><Icon name="close" size={28} /></RoundButton>
        <RoundButton label="Salvar" size={48} onPress={() => decide('save')}><Icon name="bookmark-border" size={22} /></RoundButton>
        <RoundButton label="Curtir" size={56} ink onPress={() => decide('like')}><Icon name="favorite" size={28} color={theme.bg} /></RoundButton>
        <RoundButton label="Ver obra" size={48} onPress={() => router.push(`/artwork/${top.publicId}`)}><Icon name="open-in-full" size={22} /></RoundButton>
      </View>
      <Text style={styles.count}>{deckCounter(total - deck.length, total)}</Text>
    </View>
  )
}

function RoundButton({ label, size, ink, onPress, children }: { label: string; size: number; ink?: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: ink ? theme.fg : theme.bg, borderWidth: ink ? 0 : 1, borderColor: theme.fgDisabled }, pressed && { opacity: 0.7 }]}>
      {children}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: 14, padding: 16, paddingTop: 14 },
  stage: { flex: 1, minHeight: 0 },
  card: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radiusLg, overflow: 'hidden' },
  cardWall: { flex: 1, backgroundColor: theme.wall, padding: 32, alignItems: 'center', justifyContent: 'center' },
  cardImg: { width: '100%', height: '100%' },
  stamp: { position: 'absolute', top: 16, paddingVertical: 4, paddingHorizontal: 10, borderWidth: 2, borderRadius: theme.radiusSm },
  stampPass: { right: 16, borderColor: theme.fg },
  stampLike: { left: 16, borderColor: theme.error },
  stampText: { fontSize: 13, fontWeight: '600', letterSpacing: 0.8 },
  cap: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, gap: 2 },
  artist: { fontSize: 13, fontWeight: '600', color: theme.fg },
  sheet: { fontSize: 12, lineHeight: 16, color: theme.fgMuted },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 6 },
  price: { fontSize: 18, fontWeight: '600', color: theme.fg, fontVariant: ['tabular-nums'] },
  vend: { fontSize: 12, color: theme.fgMuted },
  btns: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 14 },
  count: { textAlign: 'center', fontSize: 12, color: theme.fgMuted },
  empty: { flex: 1, justifyContent: 'center', gap: 12, paddingHorizontal: 28 },
  emptyS: { fontSize: 14, color: theme.fgMuted },
  emptyRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
})
