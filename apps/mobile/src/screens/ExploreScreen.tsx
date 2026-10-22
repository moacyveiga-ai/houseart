// Explorar (handoff "HouseArt App Colecionador" › Explorar · feed and Explorar ·
// descobrir): brand · search · favorites on top, segmented Feed · Descobrir, the
// chips of `CATS`, the feed of large cards (seller head · wall with "Certificada"
// and "Aceita ofertas" · curtir / enviar / salvar · artist, title, sheet · price
// with Ofertar / Comprar) and the deck. Reactions by POST /api/community/reactions.
import { useCallback, useMemo, useState } from 'react'
import { FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useApi } from '@/api/hooks'
import { reactionToast, toggleArtworkReaction, type ReactionKind } from '@/api/reactions'
import type { ExploreItem } from '@/api/types'
import { theme } from '@/theme'
import { Avatar, Chip, Display, ErrorState, Icon, IconButton, Loading, Toast, Wall } from '@/ui/kit'
import { avatarTint, brl, initialsOf, installmentLine, marketLabel, sellerKindLabel, sheetLine } from '@/ui/format'
import { shareArtwork } from '@/ui/share'
import { DiscoverDeck } from './DiscoverDeck'
import { EXPLORE_CHIPS, acceptsOffers, passesChip, type ExploreChip } from './explore-core'

const BRAND = require('../../assets/brand/marca_houseart_simples_horiz_mono.png') as number

type View_ = 'feed' | 'discover'

export function ExploreScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { data, error, loading, reload } = useApi<{ items: ExploreItem[] }>('/api/collector/explore')
  const [patches, setPatches] = useState<Record<number, Partial<ExploreItem>>>({})
  const [view, setView] = useState<View_>('feed')
  const [chip, setChip] = useState<ExploreChip>('all')
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])

  const items = useMemo(() => (data?.items ?? []).map((i) => ({ ...i, ...patches[i.id] })).filter((i) => passesChip(i, chip)), [data, patches, chip])
  const patch = (id: number, p: Partial<ExploreItem>) => setPatches((xs) => ({ ...xs, [id]: { ...xs[id], ...p } }))

  /** Optimistic flip; the server decides (rolls back on error). */
  const react = useCallback(async (item: ExploreItem, kind: ReactionKind, quiet = false): Promise<boolean> => {
    const key = kind === 'LIKE' ? 'liked' : 'saved'
    const before = item[key]
    patch(item.id, { [key]: !before })
    try {
      const on = await toggleArtworkReaction(item.id, kind)
      patch(item.id, { [key]: on })
      if (!quiet) setToast(reactionToast(kind, on))
      return on
    } catch { patch(item.id, { [key]: before }); setToast('Não foi possível registrar agora.'); return before }
  }, [])

  const header = (
    <View style={styles.head}>
      <View style={styles.top}>
        <Image source={BRAND} style={styles.brand} resizeMode="contain" accessibilityLabel="houseArt" />
        <IconButton name="search" label="Buscar" box={40} onPress={() => router.push('/search')} />
        <IconButton name="bookmark-border" label="Favoritos" box={40} onPress={() => router.push('/favorites')} />
      </View>
      <View style={styles.seg} accessibilityRole="tablist">
        {(['feed', 'discover'] as const).map((v) => (
          <Pressable key={v} accessibilityRole="tab" accessibilityState={{ selected: view === v }} onPress={() => setView(v)} style={[styles.segBtn, view === v && styles.segOn]}>
            <Text style={styles.segText}>{v === 'feed' ? 'Feed' : 'Descobrir'}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ marginHorizontal: -16 }}>
        {EXPLORE_CHIPS.map((c) => <Chip key={c.key} label={c.label} on={chip === c.key} onPress={() => setChip(c.key)} />)}
      </ScrollView>
    </View>
  )

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      {header}
      {loading && !data ? <Loading /> : error && !data ? <ErrorState message={error} onRetry={reload} /> : view === 'feed' ? (
        <FlatList
          data={items}
          keyExtractor={(i) => String(i.id)}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={theme.accent} />}
          renderItem={({ item }) => <FeedCard item={item} react={react} onOpen={() => router.push(`/artwork/${item.publicId}`)} onOffer={() => router.push({ pathname: '/web', params: { path: `/e/artwork/${item.publicId}/offer`, title: 'Fazer oferta' } })} onBuy={() => router.push({ pathname: '/web', params: { path: `/e/artwork/${item.publicId}/buy`, title: 'Comprar' } })} />}
          ListEmptyComponent={<Text style={styles.empty}>Nenhuma obra nesta categoria agora.</Text>}
          ListFooterComponent={<Text style={styles.foot}>Todas as obras têm certificado assinado e etiqueta no verso.</Text>}
        />
      ) : (
        <DiscoverDeck key={chip} items={items} react={react} />
      )}
      <Toast message={toast} onDone={clearToast} />
    </View>
  )
}

function FeedCard({ item: o, react, onOpen, onOffer, onBuy }: { item: ExploreItem; react: (i: ExploreItem, k: ReactionKind) => Promise<boolean>; onOpen: () => void; onOffer: () => void; onBuy: () => void }) {
  const tint = avatarTint(o.seller)
  const offers = acceptsOffers(o.saleMode)
  return (
    <View style={styles.post} accessibilityLabel={o.title}>
      <View style={styles.by}>
        <Avatar initials={initialsOf(o.seller)} bg={tint.bg} fg={tint.fg} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{o.seller}</Text>
          <Text style={styles.sub}>{sellerKindLabel(o.sellerKind)}{o.uf ? ` · ${o.uf}` : ''}</Text>
        </View>
        <Text style={styles.pill}>{marketLabel(o.market)}</Text>
      </View>
      <Pressable accessibilityRole="imagebutton" accessibilityLabel={`Ver obra ${o.title}`} onPress={onOpen}>
        <Wall uri={o.cover} />
        <View style={styles.badges}>
          <View style={styles.cert}><Icon name="verified" size={14} color={theme.success} /><Text style={styles.certText}>Certificada</Text></View>
          {offers ? <Text style={styles.offers}>Aceita ofertas</Text> : null}
        </View>
      </Pressable>
      <View style={styles.acts}>
        <IconButton name={o.liked ? 'favorite' : 'favorite-border'} label={o.liked ? 'Remover curtida' : 'Curtir'} box={40} color={o.liked ? theme.error : theme.fg} onPress={() => void react(o, 'LIKE')} />
        <IconButton name="send" label="Compartilhar" box={40} onPress={() => void shareArtwork(o)} />
        <View style={{ flex: 1 }} />
        <IconButton name={o.saved ? 'bookmark' : 'bookmark-border'} label={o.saved ? 'Remover dos favoritos' : 'Salvar'} box={40} onPress={() => void react(o, 'SAVE')} />
      </View>
      <Pressable onPress={onOpen} style={styles.cap}>
        <Text style={styles.artist}>{o.artist}</Text>
        <Display italic size={20} line={26}>{o.title}</Display>
        <Text style={styles.sheet}>{sheetLine(o)}</Text>
      </Pressable>
      <View style={styles.buy}>
        <View style={{ flex: 1 }}>
          <Text style={styles.price}>{brl(o.priceCents)}</Text>
          <Text style={styles.inst}>{installmentLine(o.priceCents)}</Text>
        </View>
        {offers ? <Pressable accessibilityRole="button" onPress={onOffer} style={styles.btnOutline}><Text style={styles.btnOutlineText}>Ofertar</Text></Pressable> : null}
        {o.priceCents !== null ? <Pressable accessibilityRole="button" onPress={onBuy} style={styles.btnPrimary}><Text style={styles.btnPrimaryText}>Comprar</Text></Pressable> : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  head: { gap: 12, paddingTop: 6, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: { height: 24, width: 120, marginRight: 'auto' },
  seg: { flexDirection: 'row', padding: 3, backgroundColor: theme.border, borderRadius: theme.radiusMd },
  segBtn: { flex: 1, height: 34, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: theme.bg },
  segText: { fontSize: 14, fontWeight: '600', color: theme.fg },
  chips: { gap: 6, paddingHorizontal: 16 },
  post: { paddingTop: 14, paddingBottom: 18, gap: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  by: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  name: { fontSize: 14, fontWeight: '600', color: theme.fg },
  sub: { fontSize: 12, lineHeight: 16, color: theme.fgMuted },
  pill: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: theme.radiusFull, borderWidth: 1, borderColor: theme.border, fontSize: 11, fontWeight: '600', color: theme.fgBody },
  badges: { position: 'absolute', left: 12, bottom: 12, flexDirection: 'row', gap: 6 },
  cert: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3, paddingHorizontal: 8, borderRadius: theme.radiusSm, backgroundColor: theme.bg },
  certText: { fontSize: 11, fontWeight: '600', color: theme.success },
  offers: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: theme.radiusSm, backgroundColor: theme.accent, fontSize: 11, fontWeight: '600', color: theme.fg, overflow: 'hidden' },
  acts: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  cap: { paddingHorizontal: 16, gap: 2 },
  artist: { fontSize: 13, fontWeight: '600', color: theme.fg },
  sheet: { fontSize: 12, lineHeight: 16, color: theme.fgMuted },
  buy: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  price: { fontSize: 18, lineHeight: 24, fontWeight: '600', color: theme.fg, fontVariant: ['tabular-nums'] },
  inst: { fontSize: 11, lineHeight: 14, color: theme.fgMuted },
  btnOutline: { height: 40, paddingHorizontal: 14, borderRadius: theme.radiusMd, borderWidth: 1, borderColor: theme.fg, alignItems: 'center', justifyContent: 'center' },
  btnOutlineText: { fontSize: 14, fontWeight: '600', color: theme.fg },
  btnPrimary: { height: 40, paddingHorizontal: 16, borderRadius: theme.radiusMd, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
  btnPrimaryText: { fontSize: 14, fontWeight: '600', color: theme.fg },
  empty: { padding: 40, paddingHorizontal: 24, textAlign: 'center', fontSize: 14, color: theme.fgMuted },
  foot: { paddingVertical: 24, paddingHorizontal: 16, paddingBottom: 32, textAlign: 'center', fontSize: 12, color: theme.fgMuted },
})
