// Favoritos e curtidos (handoff "HouseArt App Colecionador" › Coleção › Favoritos ·
// Curtidos): Favoritos = the saved artworks as rows (wall 80 · title · artist ·
// price · Comprar/Ver), Curtidos = the liked ones as a 3-column wall grid with
// the line "N obras curtidas…". Removing is the same toggle and the row leaves.
import { useCallback, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useApi } from '@/api/hooks'
import { toggleArtworkReaction, type ReactionKind } from '@/api/reactions'
import type { FavoriteItem } from '@/api/types'
import { theme } from '@/theme'
import { Display, ErrorState, IconButton, Loading, Toast, TopBar, Wall } from '@/ui/kit'
import { brl } from '@/ui/format'

export type FavoritesTab = 'saved' | 'liked'
const available = (r: FavoriteItem) => r.status === 'LISTED'
const priceOf = (r: FavoriteItem) => (!available(r) ? 'Indisponível' : brl(r.priceCents))

export function FavoritesScreen({ initialTab }: { initialTab: FavoritesTab }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { data, error, loading, reload } = useApi<{ items: FavoriteItem[] }>('/api/collector/favorites')
  const [removed, setRemoved] = useState<Record<string, true>>({})
  const [tab, setTab] = useState<FavoritesTab>(initialTab)
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])
  const rows = (data?.items ?? []).map((r) => ({ ...r, saved: r.saved && !removed[`S${r.id}`], liked: r.liked && !removed[`L${r.id}`] }))
  const saved = rows.filter((r) => r.saved), liked = rows.filter((r) => r.liked)

  async function remove(r: FavoriteItem, kind: ReactionKind) {
    try {
      const on = await toggleArtworkReaction(r.id, kind)
      if (on) return // it was off (stale list) and turned on: keep it
      setRemoved((x) => ({ ...x, [`${kind === 'SAVE' ? 'S' : 'L'}${r.id}`]: true }))
      setToast(kind === 'SAVE' ? 'Removida dos favoritos' : 'Curtida removida')
    } catch { setToast('Não foi possível remover agora.') }
  }
  const open = (r: FavoriteItem) => router.push(`/artwork/${r.publicId}`)

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <TopBar title="Favoritos e curtidos" />
      <View style={styles.tabs}>
        {(['saved', 'liked'] as const).map((t) => (
          <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} onPress={() => setTab(t)} style={[styles.tab, tab === t && styles.tabOn]}><Text style={[styles.tabText, tab === t && { color: theme.fg }]}>{t === 'saved' ? `Favoritos · ${saved.length}` : `Curtidos · ${liked.length}`}</Text></Pressable>
        ))}
      </View>
      {loading && !data ? <Loading /> : error && !data ? <ErrorState message={error} onRetry={reload} /> : (
        <ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={theme.accent} />}>
          {tab === 'saved' ? (<>
            {saved.map((r) => (
              <View key={r.id} style={styles.row}>
                <Pressable accessibilityRole="imagebutton" accessibilityLabel={`Ver obra ${r.title}`} onPress={() => open(r)}><Wall uri={r.cover} padding={10} style={styles.rowWall} square={false} /></Pressable>
                <View style={{ flex: 1, gap: 2 }}>
                  <Display italic size={15} line={20}>{r.title}{r.year ? `, ${r.year}` : ''}</Display>
                  <Text style={styles.sub}>{r.artist}</Text>
                  <View style={styles.rowFoot}>
                    <Text style={styles.price}>{priceOf(r)}</Text>
                    <View style={styles.rowActs}>
                      <IconButton name="bookmark" label="Remover dos favoritos" box={34} size={20} onPress={() => void remove(r, 'SAVE')} />
                      {available(r) && r.priceCents !== null
                        ? <Pressable accessibilityRole="button" onPress={() => router.push(`/artwork/${r.publicId}/buy`)} style={styles.btnPrimary}><Text style={styles.btnText}>Comprar</Text></Pressable>
                        : <Pressable accessibilityRole="button" onPress={() => open(r)} style={styles.btnOutline}><Text style={styles.btnText}>Ver</Text></Pressable>}
                    </View>
                  </View>
                </View>
              </View>
            ))}
            {saved.length === 0 ? <Text style={styles.empty}>Toque no marcador de uma obra para guardá-la aqui.</Text> : null}
          </>) : (<>
            <Text style={styles.note}>{liked.length} {liked.length === 1 ? 'obra curtida' : 'obras curtidas'}. Artistas das obras curtidas aparecem primeiro no Descobrir.</Text>
            <View style={styles.grid}>
              {liked.map((r) => (
                <Pressable key={r.id} accessibilityRole="imagebutton" accessibilityLabel={r.title} onPress={() => open(r)} onLongPress={() => void remove(r, 'LIKE')} style={styles.tile}>
                  <Wall uri={r.cover} padding={10} />
                  <View style={styles.tileRm}><IconButton name="favorite" label={`Remover curtida de ${r.title}`} box={28} size={18} color={theme.error} onPress={() => void remove(r, 'LIKE')} /></View>
                </Pressable>
              ))}
            </View>
          </>)}
        </ScrollView>
      )}
      <Toast message={toast} onDone={clearToast} />
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  tabs: { flexDirection: 'row', gap: 18, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.border },
  tab: { height: 44, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: theme.fg },
  tabText: { fontSize: 14, fontWeight: '600', color: theme.fgMuted },
  body: { padding: 16, paddingBottom: 28, gap: 12 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  rowWall: { width: 80, height: 80 },
  sub: { fontSize: 12, lineHeight: 16, color: theme.fgMuted },
  rowFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 4 },
  rowActs: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  price: { fontSize: 14, fontWeight: '600', color: theme.fg, fontVariant: ['tabular-nums'] },
  btnPrimary: { height: 34, paddingHorizontal: 12, borderRadius: theme.radiusMd, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
  btnOutline: { height: 34, paddingHorizontal: 12, borderRadius: theme.radiusMd, borderWidth: 1, borderColor: theme.fg, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 13, fontWeight: '600', color: theme.fg },
  empty: { paddingVertical: 24, fontSize: 14, color: theme.fgMuted },
  note: { fontSize: 13, color: theme.fgMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tile: { width: '31.5%', flexGrow: 1 },
  tileRm: { position: 'absolute', right: 2, top: 2 },
})
