// Minha coleção (handoff "HouseArt App Colecionador" › Minha coleção): title and
// summary, the wallet and "+" (Cadastrar obra), the four KPIs, the tabs Obras · Favoritos ·
// Curtidos · Compras · Vendas and the 2-column grid of the deeds (status line by
// the artwork's state). Favoritos/Curtidos open the native Favoritos screen;
// Compras (/purchases), Vendas (/sales/collector) and "+" (/wallet/register)
// open their native screens; the wallet icon opens Carteira e cartões.
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useApi } from '@/api/hooks'
import type { FavoriteItem, WalletItem } from '@/api/types'
import { colors, theme } from '@/theme'
import { Display, ErrorState, Icon, Loading, Wall, type IconName } from '@/ui/kit'
import { brl } from '@/ui/format'

const mil = (cents: number): string => (cents >= 100_000_000_00 ? `R$ ${(cents / 100_000_000_00).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mi` : cents >= 100_000_00 ? `R$ ${Math.round(cents / 100_000_00)} mil` : brl(cents))

function statusOf(o: WalletItem): { st: string; icon: IconName; color: string } {
  if (o.status === 'IN_CERTIFICATION') return { st: 'Em certificação', icon: 'schedule', color: colors.pending500 }
  if (o.status === 'LISTED') return { st: `À venda · ${brl(o.registeredCents)}`, icon: 'sell', color: theme.accentStrong }
  if (o.status === 'IN_DEAL') return { st: 'Reservada · em negociação', icon: 'schedule', color: colors.pending500 }
  return { st: 'Escritura em seu nome', icon: 'verified', color: theme.success }
}

export function CollectionScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const wallet = useApi<{ items: WalletItem[]; totalCents: string; holderName: string; valuation?: { label: string; tone: 'up' | 'down' | null; note: string } | null; arriving?: { dealId: number; title: string; artist: string; cover: string | null; label: string }[] }>('/api/collector/wallet')
  const valuation = wallet.data?.valuation ?? null
  const arriving = wallet.data?.arriving ?? []
  const favs = useApi<{ items: FavoriteItem[] }>('/api/collector/favorites')
  const items = wallet.data?.items ?? []
  const total = Number(wallet.data?.totalCents ?? 0)
  const artists = new Set(items.map((o) => o.artistId ?? o.artist)).size
  const nSaved = (favs.data?.items ?? []).filter((f) => f.saved).length
  const nLiked = (favs.data?.items ?? []).filter((f) => f.liked).length

  const kpis: { icon: IconName; v: string; k: string; color?: string; onPress?: () => void }[] = [
    { icon: 'image', v: String(items.length), k: items.length === 1 ? 'obra' : 'obras' },
    { icon: 'account-balance', v: mil(total), k: 'valor registrado' },
    { icon: valuation?.tone === 'down' ? 'trending-down' : 'trending-up', v: valuation?.label ?? '—', k: 'valorização', color: valuation?.tone === 'up' ? theme.success : valuation?.tone === 'down' ? theme.error : undefined },
    { icon: 'palette', v: String(artists), k: artists === 1 ? 'artista' : 'artistas' },
  ]
  const tabs: { name: string; onPress?: () => void; on?: boolean }[] = [
    { name: `Obras · ${items.length}`, on: true },
    { name: `Favoritos · ${nSaved}`, onPress: () => router.push({ pathname: '/favorites', params: { tab: 'saved' } }) },
    { name: `Curtidos · ${nLiked}`, onPress: () => router.push({ pathname: '/favorites', params: { tab: 'liked' } }) },
    { name: 'Compras', onPress: () => router.push('/purchases' as never) },
    { name: 'Vendas', onPress: () => router.push('/sales/collector' as never) },
  ]

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <View style={styles.head}>
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Display size={28} line={36}>Minha coleção</Display>
            <Text style={styles.summary}>{wallet.data ? `${items.length} ${items.length === 1 ? 'obra' : 'obras'} · ${brl(total)} registrados` : ' '}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Carteira e cartões" onPress={() => router.push('/wallet/cards' as never)} style={styles.walletBtn}><Icon name="account-balance-wallet" size={22} /></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Adicionar nova obra" onPress={() => router.push('/wallet/register' as never)} style={styles.add}><Icon name="add" size={26} color={theme.bg} /></Pressable>
        </View>
        <View style={styles.kpis}>
          {kpis.map((k) => (
            <View key={k.k} style={styles.kpi}>
              <Icon name={k.icon} size={16} color={theme.fgMuted} />
              <Text style={[styles.kpiV, k.color ? { color: k.color } : null]} numberOfLines={1}>{k.v}</Text>
              <Text style={styles.kpiK}>{k.k}</Text>
            </View>
          ))}
        </View>
        {valuation ? <Text style={styles.note}>{valuation.note}</Text> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -16, marginTop: 6 }} contentContainerStyle={styles.tabs}>
          {tabs.map((t) => (
            <Pressable key={t.name} accessibilityRole="tab" accessibilityState={{ selected: !!t.on }} onPress={t.onPress} style={[styles.tab, t.on && styles.tabOn]}><Text style={[styles.tabText, t.on && { color: theme.fg }]}>{t.name}</Text></Pressable>
          ))}
        </ScrollView>
      </View>
      {wallet.loading && !wallet.data ? <Loading /> : wallet.error && !wallet.data ? <ErrorState message={wallet.error} onRetry={wallet.reload} /> : (
        <ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={wallet.loading} onRefresh={() => { void wallet.reload(); void favs.reload() }} tintColor={theme.accent} />}>
          {arriving.length ? (
            <View style={styles.arriving}>
              <Text style={styles.arrivingK}>Chegando</Text>
              {arriving.map((p) => (
                <Pressable key={p.dealId} accessibilityRole="button" accessibilityLabel={`${p.title} · ${p.label}`} onPress={() => router.push({ pathname: '/purchases/[id]', params: { id: String(p.dealId) } })} style={styles.arrivingRow}>
                  <Wall uri={p.cover} padding={6} style={{ width: 48 }} />
                  <View style={{ flex: 1, minWidth: 0 }}><Display italic size={14} line={19}>{p.title}</Display><Text style={styles.cellArtist} numberOfLines={1}>{p.artist} · {p.label}</Text></View>
                  <Icon name="chevron-right" size={20} color={theme.fgMuted} />
                </Pressable>
              ))}
            </View>
          ) : null}
          {items.length === 0 ? <Text style={styles.empty}>Nenhuma escritura ainda. Uma obra que já é sua entra pela opção Cadastrar obra; a que você comprar na HouseArt chega aqui depois da entrega.</Text> : null}
          <View style={styles.grid}>
            {items.map((o) => {
              const s = statusOf(o)
              return (
                <Pressable key={o.artworkId} accessibilityRole="button" accessibilityLabel={o.title} disabled={!o.publicId} onPress={() => router.push({ pathname: '/artwork/[publicId]', params: { publicId: o.publicId!, mine: '1' } })} style={styles.cell}>
                  <Wall uri={o.cover} padding={16} />
                  <Display italic size={14} line={19}>{o.title}</Display>
                  <Text style={styles.cellArtist}>{o.artist}</Text>
                  <View style={styles.stRow}><Icon name={s.icon} size={14} color={s.color} /><Text style={[styles.st, { color: s.color }]}>{s.st}</Text></View>
                </Pressable>
              )
            })}
          </View>
          {items.length ? <Text style={styles.foot}>Para vender, toque na obra e escolha "Vender esta obra".</Text> : null}
        </ScrollView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  head: { paddingTop: 6, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.border },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summary: { fontSize: 13, color: theme.fgMuted },
  walletBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' },
  add: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.fg, alignItems: 'center', justifyContent: 'center' },
  kpis: { flexDirection: 'row', gap: 6, marginTop: 10 },
  kpi: { flex: 1, minWidth: 0, paddingHorizontal: 8, paddingTop: 8, paddingBottom: 9, borderRadius: theme.radiusMd, backgroundColor: theme.surface, gap: 1 },
  kpiV: { fontSize: 15, lineHeight: 20, fontWeight: '600', color: theme.fg, fontVariant: ['tabular-nums'] },
  kpiK: { fontSize: 10, lineHeight: 13, color: theme.fgMuted },
  tabs: { gap: 18, paddingHorizontal: 16 },
  tab: { height: 44, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: theme.fg },
  tabText: { fontSize: 14, fontWeight: '600', color: theme.fgMuted },
  body: { padding: 16, paddingBottom: 28, gap: 12 },
  empty: { fontSize: 14, lineHeight: 20, color: theme.fgMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 16 },
  cell: { width: '47%', flexGrow: 1, gap: 4 },
  cellArtist: { fontSize: 12, lineHeight: 16, color: theme.fgMuted },
  stRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  st: { fontSize: 11, fontWeight: '600' },
  note: { fontSize: 11, lineHeight: 15, color: theme.fgMuted, marginTop: 6 },
  arriving: { gap: 8, paddingBottom: 4 },
  arrivingK: { fontSize: 12, fontWeight: '600', color: theme.fgMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  arrivingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  foot: { textAlign: 'center', fontSize: 12, lineHeight: 17, color: theme.fgMuted },
})
