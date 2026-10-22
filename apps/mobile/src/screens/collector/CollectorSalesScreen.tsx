// Vendas do colecionador (handoff "HouseArt App Colecionador" › Minha coleção ›
// Vendas, `recebidas` + `anuncios`): the proposals received on the artworks the
// collector put up for sale — Aceitar · Contrapropor · Recusar, the same cards
// of the App Galeria (`OffersSection`) — and the sales running until the
// delivery. Data: GET /api/offers (the seller's projection, never the buyer's
// document) and GET /api/gallery/deals; writes: POST /api/offers/[id]/{accept,
// refuse,counter}. The prototype asks for the Pix before accepting: the screen
// does the same (GET /api/member/payout-account) and leads to "Pix para receber".
import { useCallback, useState } from 'react'
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useApi, useReloadOnFocus } from '@/api/hooks'
import type { DealView, OfferRow } from '@/api/gallery'
import { payoutAccount } from '@/api/collector'
import { colors, theme } from '@/theme'
import { Display, ErrorState, Icon, Loading, Toast, TopBar, Wall } from '@/ui/kit'
import { brl } from '@/ui/format'
import { OffersSection } from '../gallery/OffersSection'
import { dealSegments, dealStageTitle } from '../gallery/gallery-core'

type Tab = 'offers' | 'deals'

export function CollectorSalesScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [tab, setTab] = useState<Tab>('offers')
  const offers = useApi<OfferRow[]>('/api/offers')
  const deals = useApi<{ ok: boolean; deals: DealView[] }>('/api/gallery/deals')
  const pix = useApi<{ ok: boolean; account: unknown }>('/api/member/payout-account')
  const reloadAll = useCallback(async () => { await Promise.all([offers.reload(), deals.reload(), pix.reload()]) }, [offers.reload, deals.reload, pix.reload]) // eslint-disable-line react-hooks/exhaustive-deps
  useReloadOnFocus(reloadAll)
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])

  const rows = offers.data ?? []
  const open = rows.filter((o) => o.open).length
  const dealRows = deals.data?.deals ?? []
  const live = dealRows.filter((d) => d.phase !== 'COMPLETED').length
  const noPix = pix.data ? !pix.data.account : !!pix.error
  const nothing = !offers.loading && !deals.loading && rows.length === 0 && dealRows.length === 0

  /** The prototype: accepting without the Pix first asks for it (the deal pays to that key). */
  const guardPix = useCallback(async (): Promise<boolean> => {
    try { if (await payoutAccount()) return true } catch { /* no seller member yet: the same answer */ }
    Alert.alert('Pix para receber', 'Cadastre a chave Pix para receber antes de aceitar uma oferta.', [
      { text: 'Agora não', style: 'cancel' },
      { text: 'Cadastrar Pix', onPress: () => router.push('/sales/payout' as never) },
    ])
    return false
  }, [router])

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <TopBar />
      <View style={styles.head}>
        <Display size={28} line={36}>Vendas</Display>
        <View style={styles.tabs}>
          {([['offers', `Ofertas recebidas · ${open}`], ['deals', `Em andamento · ${live}`]] as const).map(([k, name]) => (
            <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} onPress={() => setTab(k)} style={[styles.tab, tab === k && styles.tabOn]}><Text style={[styles.tabText, tab === k && { color: theme.fg }]}>{name}</Text></Pressable>
          ))}
        </View>
      </View>
      {offers.loading && !offers.data ? <Loading /> : offers.error && !offers.data ? <ErrorState message={offers.error} onRetry={reloadAll} /> : (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={offers.loading || deals.loading} onRefresh={() => void reloadAll()} tintColor={theme.accent} />}>
          {nothing ? (
            <View style={styles.callout}>
              <Icon name="storefront" size={22} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.calloutTitle}>Você ainda não tem obras à venda</Text>
                <Text style={styles.calloutText}>As ofertas das obras que você anunciar chegam aqui. Na sua coleção, toque numa obra com a escritura no seu nome e escolha "Vender esta obra".</Text>
              </View>
            </View>
          ) : null}
          {noPix && open > 0 ? (
            <Pressable accessibilityRole="button" onPress={() => router.push('/sales/payout' as never)} style={styles.pixWarn}>
              <Icon name="account-balance" size={20} />
              <Text style={styles.pixWarnText}>Cadastre o Pix para receber antes de aceitar uma oferta.</Text>
              <Icon name="chevron-right" size={20} color={theme.fgMuted} />
            </Pressable>
          ) : null}
          {tab === 'offers' && !nothing ? <OffersSection offers={rows} onChanged={reloadAll} onToast={setToast} beforeAccept={guardPix} /> : null}
          {tab === 'deals' && !nothing ? (dealRows.length === 0 ? <Text style={styles.empty}>Nenhuma venda em andamento.</Text> : dealRows.map((d) => (
            <View key={d.id} style={styles.deal}>
              <View style={styles.dealHead}>
                <Wall uri={d.cover} padding={6} style={styles.dealWall} square={false} />
                <View style={{ flex: 1, minWidth: 0 }}><Display italic size={14} line={18} numberOfLines={1}>{d.artworkTitle}</Display><Text style={styles.muted}>{d.buyerName} · {d.code}</Text></View>
                <Text style={styles.dealValue}>{brl(d.amountCents)}</Text>
              </View>
              <View style={styles.segs}>{dealSegments(d).map((bg, i) => <View key={i} style={[styles.seg, { backgroundColor: bg }]} />)}</View>
              <View style={styles.dealFoot}>
                <Text style={styles.stage}>{dealStageTitle(d)}</Text>
                <View style={[styles.pill, { backgroundColor: d.phase === 'COMPLETED' ? colors.verified100 : d.escrowPaid ? colors.sand100 : theme.border }]}>
                  <Text style={styles.pillText}>{d.phase === 'COMPLETED' ? 'Concluída · valor liberado' : d.escrowPaid ? 'Paga em garantia · prepare a embalagem' : 'Aceita · aguardando pagamento'}</Text>
                </View>
              </View>
            </View>
          ))) : null}
        </ScrollView>
      )}
      <Toast message={toast} onDone={clearToast} />
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  head: { paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.border },
  tabs: { flexDirection: 'row', gap: 20 },
  tab: { height: 44, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: theme.fg },
  tabText: { fontSize: 14, fontWeight: '600', color: theme.fgMuted },
  body: { paddingTop: 14, paddingHorizontal: 16, paddingBottom: 28, gap: 12 },
  empty: { paddingVertical: 24, fontSize: 14, color: theme.fgMuted },
  callout: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: theme.radiusMd, backgroundColor: theme.surface },
  calloutTitle: { fontSize: 14, fontWeight: '600', color: theme.fg },
  calloutText: { fontSize: 13, lineHeight: 19, color: theme.fgBody },
  pixWarn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: theme.radiusMd, backgroundColor: colors.pending100 },
  pixWarnText: { flex: 1, fontSize: 13, lineHeight: 18, color: theme.fg },
  muted: { fontSize: 12, lineHeight: 16, color: theme.fgMuted },
  deal: { gap: 10, padding: 14, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radiusMd, backgroundColor: theme.bg },
  dealHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dealWall: { width: 56, height: 56 },
  dealValue: { fontSize: 15, fontWeight: '600', color: theme.fg, fontVariant: ['tabular-nums'] },
  segs: { flexDirection: 'row', gap: 3 },
  seg: { flex: 1, height: 4, borderRadius: 2 },
  dealFoot: { gap: 8 },
  stage: { fontSize: 13, fontWeight: '600', color: theme.fg },
  pill: { alignSelf: 'flex-start', paddingVertical: 2, paddingHorizontal: 8, borderRadius: theme.radiusFull },
  pillText: { fontSize: 11, fontWeight: '600', color: theme.fg },
})
