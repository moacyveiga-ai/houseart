// Gestão do anúncio (handoff "HouseArt App Galeria" › obra › Gestão do anúncio):
// the artwork head, the four stats, "Preço pedido" with Salvar (lights only when
// the price changed; the server refuses a price under the mandate's minimum and
// the app shows that message — the minimum itself never comes), the toggles
// "Aceita ofertas" and "Pausar anúncio", and the buttons Ofertas desta obra ·
// Enviar a um cliente · Editar cadastro. Data: GET /api/gallery/artworks/[id];
// writes: PATCH /api/artworks/[id]/listing, one field per call.
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useApi } from '@/api/hooks'
import { patchListing, type ListingDetail, type ListingState } from '@/api/gallery'
import { API_URL } from '@/config'
import { colors, theme } from '@/theme'
import { Toggle } from '@/ui/forms'
import { Display, ErrorState, Icon, Loading, Toast, TopBar, Wall, type IconName } from '@/ui/kit'
import { useSession } from '@/auth/session'
import { ROLE_REASONS, rolePermissions } from './role-core'
import { acceptsOffersSub, listingStats, pauseToggledMessage, pausedSub, priceCents, priceChanged, priceMask, priceSavedMessage } from './gallery-core'

export function ListingScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()
  const artworkId = Number(id)
  // The gallery's Acervo role reads the listing; price, offers and pause are for Vendas and Admin.
  const canManage = rolePermissions(useSession().me?.teamRole).manageListing
  const { data, error, loading, reload } = useApi<ListingDetail>(Number.isInteger(artworkId) && artworkId > 0 ? `/api/gallery/artworks/${artworkId}` : null)
  const [state, setState] = useState<ListingState | null>(null)
  const [price, setPrice] = useState('')
  const [busy, setBusy] = useState<'price' | 'offers' | 'pause' | null>(null)
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])
  useEffect(() => { if (data) { setState(data.listing); setPrice(priceMask(Number(data.listing?.listPriceCents ?? 0) / 100)) } }, [data])

  const a = data?.artwork
  const changed = state ? priceChanged(price, state.listPriceCents) : false

  async function patch(body: Parameters<typeof patchListing>[1], what: 'price' | 'offers' | 'pause'): Promise<ListingState | null> {
    if (!canManage) return null
    setBusy(what)
    try { const next = await patchListing(artworkId, body); setState(next); return next } catch (e) { setToast((e as Error).message || 'Não foi possível salvar.'); return null } finally { setBusy(null) }
  }
  async function savePrice() {
    if (!state || !changed || busy) return
    const previous = Number(state.listPriceCents)
    const next = await patch({ listPriceCents: String(priceCents(price)) }, 'price')
    if (next) { setPrice(priceMask(Number(next.listPriceCents) / 100)); setToast(priceSavedMessage(Number(next.listPriceCents), previous)) }
  }
  async function share() {
    if (!a) return
    const url = `${API_URL}/e/artwork/${encodeURIComponent(a.publicId ?? '')}`
    const message = `Separei esta obra para você: ${a.title}, de ${a.artistName}. Qualquer dúvida, é só responder. ${url}`
    try { await Share.share({ message, url, title: a.title }) } catch { /* the person closed the sheet */ }
  }
  const web = (path: string, title: string) => router.push({ pathname: '/web', params: { path, title } })

  const buttons: { t: string; icon: IconName; go: () => void }[] = [
    { t: 'Ofertas desta obra', icon: 'request-quote', go: () => router.navigate({ pathname: '/sales', params: { tab: 'offers' } } as never) },
    { t: 'Enviar a um cliente', icon: 'share', go: () => void share() },
    { t: 'Editar cadastro', icon: 'edit', go: () => web(`/artworks/${artworkId}/edit`, 'Editar cadastro') },
  ]

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <TopBar title="Gestão do anúncio" />
      {loading && !data ? <Loading /> : error && !data ? <ErrorState message={error} onRetry={reload} /> : !a ? null : (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.head}>
            <Wall uri={a.coverUrl} padding={8} style={styles.headWall} square={false} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Display italic size={18} line={24} numberOfLines={2}>{a.title}{a.year ? `, ${a.year}` : ''}</Display>
              <Text style={styles.headSub}>{a.artistName}{a.publicId ? ` · ${a.publicId}` : ''}</Text>
            </View>
          </View>

          {state ? (
            <View style={styles.box}>
              <View style={styles.boxTitle}><Icon name="tune" size={20} /><Text style={styles.boxTitleText}>Gestão do anúncio</Text></View>
              <View style={styles.stats}>
                {listingStats(state.stats).map((s) => <View key={s.label} style={styles.stat}><Text style={styles.statV}>{s.value}</Text><Text style={styles.statK}>{s.label}</Text></View>)}
              </View>
              <View style={styles.priceRow}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.label}>Preço pedido</Text>
                  <View style={styles.priceField}>
                    <Text style={styles.currency}>R$</Text>
                    <TextInput value={price} editable={canManage} onChangeText={(v) => setPrice(priceMask(v))} inputMode="numeric" keyboardType="number-pad" style={styles.priceInput} accessibilityLabel="Preço pedido em reais" onSubmitEditing={() => void savePrice()} />
                  </View>
                </View>
                <Pressable accessibilityRole="button" accessibilityState={{ disabled: !canManage || !changed || busy === 'price' }} disabled={!canManage || !changed || busy === 'price'} onPress={() => void savePrice()} style={[styles.save, { backgroundColor: changed && canManage ? theme.accent : theme.border }]}><Text style={styles.saveText}>Salvar</Text></Pressable>
              </View>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}><Text style={styles.toggleName}>Aceita ofertas</Text><Text style={styles.toggleSub}>{acceptsOffersSub(state.acceptsOffers, data?.rules ?? null)}</Text></View>
                <View style={!canManage ? styles.off : undefined}><Toggle on={state.acceptsOffers} label="Aceita ofertas" onPress={() => { if (busy || !canManage) return; void patch({ acceptsOffers: !state.acceptsOffers }, 'offers') }} /></View>
              </View>
              <View style={styles.toggleRow}>
                <View style={{ flex: 1 }}><Text style={styles.toggleName}>Pausar anúncio</Text><Text style={styles.toggleSub}>{pausedSub(state.paused)}</Text></View>
                <View style={!canManage ? styles.off : undefined}><Toggle on={state.paused} label="Pausar anúncio" onPress={() => { if (busy || !canManage) return; void patch({ paused: !state.paused }, 'pause').then((n) => { if (n) setToast(pauseToggledMessage(n.paused)) }) }} /></View>
              </View>
              {!canManage ? <View style={styles.blocked}><Icon name="lock" size={18} /><Text style={styles.blockedText}>{ROLE_REASONS.listing}</Text></View> : null}
              <View style={styles.btns}>
                {buttons.map((b) => <Pressable key={b.t} accessibilityRole="button" onPress={b.go} style={styles.btn}><Icon name={b.icon} size={16} /><Text style={styles.btnText}>{b.t}</Text></Pressable>)}
              </View>
            </View>
          ) : (
            <View style={styles.callout}>
              <Icon name="info" size={20} color={colors.pending500} />
              <Text style={styles.calloutText}>A obra não está à venda. Abra o cadastro para listar no marketplace.</Text>
              <Pressable accessibilityRole="button" onPress={() => web(`/artworks/${artworkId}/edit`, 'Editar cadastro')} style={styles.calloutBtn}><Text style={styles.calloutBtnText}>Abrir o cadastro</Text></Pressable>
            </View>
          )}
        </ScrollView>
      )}
      <Toast message={toast} onDone={clearToast} />
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  body: { padding: 16, paddingBottom: 32, gap: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headWall: { width: 72, height: 72 },
  headSub: { fontSize: 12, lineHeight: 16, color: theme.fgMuted, marginTop: 2 },
  box: { gap: 12, padding: 14, borderWidth: 1, borderColor: theme.fg, borderRadius: theme.radiusMd },
  boxTitle: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  boxTitleText: { fontSize: 14, fontWeight: '600', color: theme.fg },
  stats: { flexDirection: 'row', gap: 6 },
  stat: { flex: 1, padding: 8, borderRadius: theme.radiusSm, backgroundColor: theme.surface },
  statV: { fontSize: 16, fontWeight: '600', color: theme.fg, fontVariant: ['tabular-nums'] },
  statK: { fontSize: 10, lineHeight: 13, color: theme.fgMuted },
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  label: { fontSize: 12, fontWeight: '600', color: theme.fg },
  priceField: { height: 44, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, borderRadius: theme.radiusSm, borderWidth: 1, borderColor: theme.fgDisabled },
  currency: { color: theme.fgMuted, fontSize: 16 },
  priceInput: { flex: 1, minWidth: 0, fontSize: 16, fontWeight: '600', color: theme.fg, paddingVertical: 0, fontVariant: ['tabular-nums'] },
  save: { height: 44, paddingHorizontal: 14, borderRadius: theme.radiusMd, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 13, fontWeight: '600', color: theme.fg },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  toggleName: { fontSize: 14, fontWeight: '600', color: theme.fg },
  toggleSub: { fontSize: 12, lineHeight: 16, color: theme.fgMuted },
  off: { opacity: 0.45 },
  blocked: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: theme.radiusSm, backgroundColor: theme.surface },
  blockedText: { flex: 1, fontSize: 12, lineHeight: 17, color: theme.fgBody },
  btns: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  btn: { height: 36, paddingHorizontal: 12, borderRadius: theme.radiusFull, borderWidth: 1, borderColor: theme.fgDisabled, flexDirection: 'row', alignItems: 'center', gap: 4 },
  btnText: { fontSize: 12, fontWeight: '600', color: theme.fg },
  callout: { gap: 10, padding: 14, borderRadius: theme.radiusMd, backgroundColor: colors.pending100 },
  calloutText: { fontSize: 14, lineHeight: 20, color: theme.fg },
  calloutBtn: { alignSelf: 'flex-start', height: 40, paddingHorizontal: 14, borderRadius: theme.radiusMd, backgroundColor: theme.fg, alignItems: 'center', justifyContent: 'center' },
  calloutBtnText: { fontSize: 13, fontWeight: '600', color: theme.bg },
})
