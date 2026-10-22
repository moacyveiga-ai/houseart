// Acervo (handoff "HouseArt App Galeria" › Acervo): title with the summary
// line, "+" (Cadastrar obra, the web wizard), search "Título, artista ou
// certificado", the chips of `INVENTORY_CHIPS` with counts, and the rows
// (wall · title · artist · year · price · status pill · stats). Tapping a
// row opens the Gestão do anúncio. Data: GET /api/gallery/inventory; chips
// and search are applied here, as the web page does.
// The artist's "Obras" (App Artista) is the same list over the same route
// (`listArtworks` is scoped by member): "+" opens the native "Nova obra ·
// câmera guiada", a draft continues there, a work in certification opens
// "Vincular etiqueta", and the rest the Gestão do anúncio.
import { useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useApi, useReloadOnFocus } from '@/api/hooks'
import type { Inventory } from '@/api/gallery'
import { theme } from '@/theme'
import { Chip, Display, ErrorState, Icon, Loading, Wall } from '@/ui/kit'
import { INVENTORY_CHIPS, emptyInventoryText, filterInventory, rowPrice, rowStats, rowStatus } from './gallery-core'

export function InventoryScreen({ artist = false }: { artist?: boolean } = {}) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ filter?: string }>()
  const { data, error, loading, reload } = useApi<Inventory>('/api/gallery/inventory')
  useReloadOnFocus(reload)
  const [chip, setChip] = useState(INVENTORY_CHIPS.some((c) => c.key === params.filter) ? (params.filter as string) : 'all')
  const [q, setQ] = useState('')
  const items = useMemo(() => filterInventory(data?.items ?? [], chip, q), [data, chip, q])
  const add = () => (artist ? router.push('/artworks/new') : router.push({ pathname: '/web', params: { path: '/artworks/new', title: 'Cadastrar obra' } }))
  const open = (o: { id: number; status: string }) => {
    if (artist && o.status === 'DRAFT') { router.push({ pathname: '/artworks/new', params: { id: String(o.id) } }); return }
    if (artist && o.status === 'IN_CERTIFICATION') { router.push({ pathname: '/certification/link/[artworkId]', params: { artworkId: String(o.id) } }); return }
    router.push({ pathname: '/artworks/[id]/listing', params: { id: String(o.id) } })
  }

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Display size={28} line={36}>{artist ? 'Obras' : 'Acervo'}</Display>
            <Text style={styles.summary}>{data?.summary ?? ' '}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Adicionar nova obra" onPress={add} style={styles.add}><Icon name="add" size={26} color={theme.bg} /></Pressable>
        </View>
        <View style={styles.search}>
          <Icon name="search" size={20} color={theme.fgMuted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Título, artista ou certificado" placeholderTextColor={theme.fgDisabled} style={styles.searchInput} autoCorrect={false} returnKeyType="search" accessibilityLabel="Buscar no acervo" />
          {q ? <Pressable accessibilityRole="button" accessibilityLabel="Limpar busca" onPress={() => setQ('')} hitSlop={8}><Icon name="close" size={18} color={theme.fgMuted} /></Pressable> : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16 }} contentContainerStyle={styles.chips}>
          {INVENTORY_CHIPS.map((c) => <Chip key={c.key} label={`${c.name} · ${data?.counts[c.key] ?? 0}`} on={chip === c.key} onPress={() => setChip(c.key)} />)}
        </ScrollView>
      </View>
      {loading && !data ? <Loading /> : error && !data ? <ErrorState message={error} onRetry={reload} /> : (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void reload()} tintColor={theme.accent} />}>
          {items.length === 0 ? <Text style={styles.empty}>{emptyInventoryText(q)}</Text> : items.map((o) => {
            const st = rowStatus(o)
            return (
              <Pressable key={o.id} accessibilityRole="button" accessibilityLabel={o.title} onPress={() => open(o)} style={styles.row}>
                <Wall uri={o.coverUrl} padding={8} style={styles.rowWall} square={false} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Display italic size={15} line={20} numberOfLines={1}>{o.title}</Display>
                  <Text style={styles.rowArtist}>{o.artistName}{o.year ? ` · ${o.year}` : ''}</Text>
                  <View style={styles.rowPriceLine}>
                    <Text style={styles.rowPrice}>{rowPrice(o)}</Text>
                    <View style={[styles.pill, { backgroundColor: st.bg }]}><Text style={styles.pillText}>{st.label}</Text></View>
                  </View>
                  <Text style={styles.rowStats}>{rowStats(o)}</Text>
                </View>
                <Icon name="chevron-right" size={20} color={theme.fgMuted} />
              </Pressable>
            )
          })}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  head: { paddingTop: 6, paddingHorizontal: 16, paddingBottom: 10, gap: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summary: { fontSize: 13, color: theme.fgMuted },
  add: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.fg, alignItems: 'center', justifyContent: 'center' },
  search: { height: 42, borderRadius: theme.radiusMd, backgroundColor: theme.surface, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 14, color: theme.fg, paddingVertical: 0 },
  chips: { gap: 6, paddingHorizontal: 16 },
  body: { paddingHorizontal: 16, paddingBottom: 24 },
  empty: { paddingVertical: 24, fontSize: 14, color: theme.fgMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  rowWall: { width: 68, height: 68 },
  rowArtist: { fontSize: 12, lineHeight: 16, color: theme.fgMuted },
  rowPriceLine: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  rowPrice: { fontSize: 13, fontWeight: '600', color: theme.fg, fontVariant: ['tabular-nums'] },
  pill: { paddingHorizontal: 7, borderRadius: theme.radiusSm },
  pillText: { fontSize: 11, lineHeight: 18, fontWeight: '600', color: theme.fg },
  rowStats: { fontSize: 11, color: theme.fgMuted },
})
