// Compras (handoff "HouseArt App Colecionador" › Minha coleção › Compras,
// `comprasLista`): one row per purchase and per proposal still open — wall ·
// title · "Compra · R$ X · vendedor" or "Sua oferta · R$ X" · the status pill.
// A purchase opens "Acompanhar compra" (/purchases/[id]); a proposal opens
// "Sua oferta" (/offer/[code]). Data: GET /api/collector/purchases (the deals
// where the person is the buyer) and GET /api/collector/offers.
import { useCallback } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useApi, useReloadOnFocus } from '@/api/hooks'
import type { Purchases } from '@/api/collector'
import type { BuyerOfferView } from '@/api/types'
import { colors, theme } from '@/theme'
import { Display, ErrorState, Loading, TopBar, Wall } from '@/ui/kit'
import { brl } from '@/ui/format'
import { escrowTotalCents, livePurchases, purchasePill } from './collector-core'

/** Proposals that are still a proposal (an accepted one already shows as the purchase). */
const OPEN_OFFER = new Set(['RECEIVED', 'BELOW_RESERVE', 'NEGOTIATING', 'ACCEPTED'])

function offerPill(o: BuyerOfferView): { label: string; bg: string } {
  if (o.counterCents && o.canReply) return { label: `Contraproposta de ${brl(Number(o.counterCents))}`, bg: colors.sand100 }
  if (o.status === 'ACCEPTED') return { label: 'Oferta aceita · pagar', bg: colors.verified100 }
  return { label: 'Oferta enviada · aguardando', bg: colors.pending100 }
}

export function PurchasesScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const deals = useApi<Purchases & { ok: boolean }>('/api/collector/purchases')
  const offers = useApi<{ ok: boolean; offers: BuyerOfferView[] }>('/api/collector/offers')
  const reloadAll = useCallback(async () => { await Promise.all([deals.reload(), offers.reload()]) }, [deals.reload, offers.reload]) // eslint-disable-line react-hooks/exhaustive-deps
  useReloadOnFocus(reloadAll)

  const rows = deals.data?.deals ?? []
  const open = (offers.data?.offers ?? []).filter((o) => OPEN_OFFER.has(o.status))
  const live = livePurchases(rows).length
  // Without FLAG_DEALS the purchases route is 404: the list shows only the proposals.
  const loading = (deals.loading && !deals.data && !deals.error) || (offers.loading && !offers.data)
  const fatal = offers.error && !offers.data ? offers.error : null

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <TopBar />
      <View style={styles.head}>
        <Display size={28} line={36}>Compras</Display>
        <Text style={styles.summary}>{deals.data || offers.data ? `${live} ${live === 1 ? 'compra em andamento' : 'compras em andamento'} · ${open.length} ${open.length === 1 ? 'oferta aberta' : 'ofertas abertas'}` : ' '}</Text>
      </View>
      {loading ? <Loading /> : fatal ? <ErrorState message={fatal} onRetry={reloadAll} /> : (
        <ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={deals.loading || offers.loading} onRefresh={() => void reloadAll()} tintColor={theme.accent} />}>
          {rows.length === 0 && open.length === 0 ? <Text style={styles.empty}>Nenhuma compra em andamento. As ofertas que você fizer e as obras que comprar aparecem aqui até a escritura sair no seu nome.</Text> : null}
          {rows.map((d) => {
            const pill = purchasePill(d)
            return (
              <Pressable key={`d${d.id}`} accessibilityRole="button" accessibilityLabel={d.artworkTitle} onPress={() => router.push({ pathname: '/purchases/[id]', params: { id: String(d.id) } })} style={styles.row}>
                <Wall uri={d.cover} padding={6} style={styles.wall} square={false} />
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Display italic size={15} line={20} numberOfLines={1}>{d.artworkTitle}</Display>
                  <Text style={styles.sub} numberOfLines={1}>Compra · {brl(escrowTotalCents(d))} · {d.sellerName}</Text>
                  <View style={[styles.pill, { backgroundColor: pill.bg }]}><Text style={[styles.pillText, { color: pill.fg }]}>{pill.label}</Text></View>
                </View>
              </Pressable>
            )
          })}
          {open.map((o) => {
            const pill = offerPill(o)
            return (
              <Pressable key={`o${o.code}`} accessibilityRole="button" accessibilityLabel={o.artworkTitle} onPress={() => router.push({ pathname: '/offer/[code]', params: { code: o.code } })} style={styles.row}>
                <Wall uri={o.artworkCover} padding={6} style={styles.wall} square={false} />
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <Display italic size={15} line={20} numberOfLines={1}>{o.artworkTitle}</Display>
                  <Text style={styles.sub} numberOfLines={1}>Sua oferta · {brl(o.currentCents)}{o.artistName ? ` · ${o.artistName}` : ''}</Text>
                  <View style={[styles.pill, { backgroundColor: pill.bg }]}><Text style={styles.pillText}>{pill.label}</Text></View>
                </View>
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
  head: { paddingHorizontal: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  summary: { fontSize: 13, color: theme.fgMuted },
  body: { padding: 16, gap: 12, paddingBottom: 28 },
  empty: { fontSize: 14, lineHeight: 20, color: theme.fgMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radiusMd, backgroundColor: theme.bg },
  wall: { width: 64, height: 64 },
  sub: { fontSize: 12, color: theme.fgMuted },
  pill: { alignSelf: 'flex-start', paddingVertical: 2, paddingHorizontal: 8, borderRadius: theme.radiusFull },
  pillText: { fontSize: 11, fontWeight: '600', color: theme.fg },
})
