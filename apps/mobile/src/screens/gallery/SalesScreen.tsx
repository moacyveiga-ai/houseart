// Negócios (handoff "HouseArt App Galeria" › Negócios): the title and the three
// tabs — Ofertas · N, Vendas · N, Regras — over `OffersSection`, the deal cards
// (wall · title · buyer · value · six segments · stage · action pill; tap opens
// the deal) and `RulesSection`. `?tab=` picks the tab (the panel's KPIs link here).
import { useCallback, useEffect, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useApi, useReloadOnFocus } from '@/api/hooks'
import type { DealView, OfferRow } from '@/api/gallery'
import { colors, theme } from '@/theme'
import { Display, ErrorState, Loading, Toast, Wall } from '@/ui/kit'
import { brl } from '@/ui/format'
import { OffersSection } from './OffersSection'
import { RulesSection } from './RulesSection'
import { dealAction, dealSegments, dealStageTitle } from './gallery-core'

type Tab = 'offers' | 'deals' | 'rules'
const asTab = (v: string | undefined): Tab => (v === 'deals' || v === 'rules' ? v : 'offers')

export function SalesScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ tab?: string }>()
  const [tab, setTab] = useState<Tab>(asTab(params.tab))
  useEffect(() => { if (params.tab) setTab(asTab(params.tab)) }, [params.tab])
  const offers = useApi<OfferRow[]>('/api/offers')
  const deals = useApi<{ ok: boolean; deals: DealView[] }>('/api/gallery/deals')
  const reloadAll = useCallback(async () => { await Promise.all([offers.reload(), deals.reload()]) }, [offers.reload, deals.reload]) // eslint-disable-line react-hooks/exhaustive-deps
  useReloadOnFocus(reloadAll)
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])

  const open = (offers.data ?? []).filter((o) => o.open).length
  // Without FLAG_DEALS the route is 404: the tab reads as empty, not as an error.
  const dealRows = deals.data?.deals ?? []
  const live = dealRows.filter((d) => d.phase !== 'COMPLETED').length
  const tabs: { key: Tab; name: string }[] = [{ key: 'offers', name: `Ofertas · ${open}` }, { key: 'deals', name: `Vendas · ${live}` }, { key: 'rules', name: 'Regras' }]
  const loading = tab === 'offers' ? offers.loading && !offers.data : tab === 'deals' ? deals.loading && !deals.data : false
  const error = tab === 'offers' ? (offers.error && !offers.data ? offers.error : null) : null

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <View style={styles.head}>
        <Display size={28} line={36}>Negócios</Display>
        <View style={styles.tabs}>
          {tabs.map((t) => <Pressable key={t.key} accessibilityRole="tab" accessibilityState={{ selected: tab === t.key }} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && styles.tabOn]}><Text style={[styles.tabText, tab === t.key && { color: theme.fg }]}>{t.name}</Text></Pressable>)}
        </View>
      </View>
      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={reloadAll} /> : (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={offers.loading || deals.loading} onRefresh={() => void reloadAll()} tintColor={theme.accent} />}>
          {tab === 'offers' ? <OffersSection offers={offers.data ?? []} onChanged={reloadAll} onToast={setToast} /> : null}
          {tab === 'deals' ? (dealRows.length === 0 ? <Text style={styles.empty}>Nenhuma venda em andamento.</Text> : dealRows.map((d) => {
            const action = dealAction(d)
            const done = d.phase === 'COMPLETED'
            return (
              <Pressable key={d.id} accessibilityRole="button" accessibilityLabel={d.artworkTitle} onPress={() => router.push({ pathname: '/deal/[id]', params: { id: String(d.id) } })} style={[styles.deal, { borderColor: action.pending ? theme.fg : theme.border }]}>
                <View style={styles.dealHead}>
                  <Wall uri={d.cover} padding={6} style={styles.dealWall} square={false} />
                  <View style={{ flex: 1, minWidth: 0 }}><Display italic size={14} line={18} numberOfLines={1}>{d.artworkTitle}</Display><Text style={styles.muted}>{d.buyerName} · {d.code}</Text></View>
                  <Text style={styles.dealValue}>{brl(d.amountCents)}</Text>
                </View>
                <View style={styles.segs}>{dealSegments(d).map((bg, i) => <View key={i} style={[styles.seg, { backgroundColor: bg }]} />)}</View>
                <View style={styles.dealFoot}>
                  <Text style={styles.stage}>{dealStageTitle(d)}</Text>
                  <View style={[styles.pill, { backgroundColor: action.pending ? theme.accent : done ? colors.verified100 : theme.border }]}><Text style={styles.pillText}>{action.label}</Text></View>
                </View>
              </Pressable>
            )
          })) : null}
          {tab === 'rules' ? <RulesSection onToast={setToast} /> : null}
        </ScrollView>
      )}
      <Toast message={toast} onDone={clearToast} />
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  head: { paddingTop: 6, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.border },
  tabs: { flexDirection: 'row', gap: 20 },
  tab: { height: 44, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: theme.fg },
  tabText: { fontSize: 14, fontWeight: '600', color: theme.fgMuted },
  body: { paddingTop: 14, paddingHorizontal: 16, paddingBottom: 28, gap: 12 },
  empty: { paddingVertical: 24, fontSize: 14, color: theme.fgMuted },
  muted: { fontSize: 12, lineHeight: 16, color: theme.fgMuted },
  deal: { gap: 10, padding: 14, borderWidth: 1, borderRadius: theme.radiusMd, backgroundColor: theme.bg },
  dealHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dealWall: { width: 56, height: 56 },
  dealValue: { fontSize: 15, fontWeight: '600', color: theme.fg, fontVariant: ['tabular-nums'] },
  segs: { flexDirection: 'row', gap: 3 },
  seg: { flex: 1, height: 4, borderRadius: 2 },
  dealFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  stage: { fontSize: 13, fontWeight: '600', color: theme.fg },
  pill: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: theme.radiusFull },
  pillText: { fontSize: 11, fontWeight: '600', color: theme.fg },
})
