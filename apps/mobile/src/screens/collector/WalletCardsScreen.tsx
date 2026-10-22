// Carteira e cartões (handoff "HouseArt App Colecionador" › carteira): the
// default card drawn on top, the balance held in escrow, the saved cards (tap
// opens "Tornar padrão" · "Remover"), "Adicionar cartão" (`CardForm`) and the
// block "Recebimentos das vendas" that leads to "Pix para receber". Data:
// GET /api/collector/payment-methods (brand + last 4, never the number),
// GET /api/collector/purchases (escrow) and GET /api/member/payout-account.
import { useCallback, useState } from 'react'
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSession } from '@/auth/session'
import { useApi, useReloadOnFocus } from '@/api/hooks'
import { removeCard, setDefaultCard, type PayoutAccount, type Purchases } from '@/api/collector'
import type { PaymentMethodView } from '@/api/types'
import { colors, theme } from '@/theme'
import { CardForm } from '@/ui/CardForm'
import { Display, ErrorState, Icon, Loading, Toast, TopBar } from '@/ui/kit'
import { brl } from '@/ui/format'
import { PIX_TYPE_LABEL, heldInEscrowCents } from './collector-core'

export function WalletCardsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { me } = useSession()
  const cards = useApi<{ ok: boolean; methods: PaymentMethodView[] }>('/api/collector/payment-methods')
  const deals = useApi<Purchases & { ok: boolean }>('/api/collector/purchases')
  const pix = useApi<{ ok: boolean; account: PayoutAccount | null }>('/api/member/payout-account')
  const reloadAll = useCallback(async () => { await Promise.all([cards.reload(), deals.reload(), pix.reload()]) }, [cards.reload, deals.reload, pix.reload]) // eslint-disable-line react-hooks/exhaustive-deps
  useReloadOnFocus(reloadAll)
  const [open, setOpen] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])

  const methods = cards.data?.methods ?? []
  const pad = methods.find((m) => m.isDefault) ?? methods[0] ?? null
  const held = heldInEscrowCents(deals.data?.deals ?? [])
  const account = pix.data?.account ?? null

  async function act(id: number, fn: () => Promise<unknown>, done: string) {
    if (busy) return
    setBusy(id)
    try { await fn(); setToast(done); setOpen(null); await cards.reload() } catch (e) { setToast((e as Error).message || 'Não foi possível concluir.') } finally { setBusy(null) }
  }
  const confirmRemove = (m: PaymentMethodView) => Alert.alert('Remover cartão', `${m.label} sai da sua carteira.`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Remover', style: 'destructive', onPress: () => void act(m.id, () => removeCard(m.id), 'Cartão removido') },
  ])

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <TopBar title="Carteira e cartões" />
      {cards.loading && !cards.data ? <Loading /> : cards.error && !cards.data ? <ErrorState message={cards.error} onRetry={reloadAll} /> : (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={cards.loading} onRefresh={() => void reloadAll()} tintColor={theme.accent} />}>
          {pad ? (
            <View style={styles.card} accessibilityLabel={`Cartão padrão ${pad.label}`}>
              <View style={styles.cardTop}><Text style={styles.cardBrand}>{pad.brandLabel.toUpperCase()}</Text><Text style={styles.cardTag}>Padrão</Text></View>
              <Text style={styles.cardNum}>•••• •••• •••• {pad.last4}</Text>
              <View style={styles.cardBottom}><Text style={styles.cardHolder} numberOfLines={1}>{pad.holderName}</Text><Text style={styles.cardHolder}>{pad.exp}</Text></View>
            </View>
          ) : null}

          <View style={styles.balance}>
            <Icon name="lock" size={20} />
            <View style={{ flex: 1 }}><Text style={styles.balanceK}>Em garantia</Text><Text style={styles.balanceSub}>{held ? 'liberado na entrega' : 'nenhuma compra em curso'}</Text></View>
            <Text style={styles.balanceV}>{brl(held)}</Text>
          </View>

          <Display size={20} line={26}>Cartões</Display>
          {methods.length === 0 && !adding ? <Text style={styles.empty}>Nenhum cartão salvo. O cartão garante as ofertas e paga as compras; o número nunca fica guardado na HouseArt.</Text> : null}
          {methods.map((m) => {
            const isOpen = open === m.id
            return (
              <View key={m.id} style={[styles.row, isOpen && { borderColor: theme.fg }]}>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: isOpen }} onPress={() => setOpen(isOpen ? null : m.id)} style={styles.rowHead}>
                  <View style={styles.brandChip}><Text style={styles.brandChipText}>{m.brandLabel.slice(0, 4).toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}><Text style={styles.rowName}>{m.label}</Text><Text style={styles.rowSub}>Vence {m.exp}{m.isDefault ? ' · padrão' : ''}</Text></View>
                  <Icon name={isOpen ? 'expand-less' : 'expand-more'} size={22} color={theme.fgMuted} />
                </Pressable>
                {isOpen ? (
                  <View style={styles.rowActions}>
                    <Pressable accessibilityRole="button" disabled={m.isDefault || busy === m.id} onPress={() => void act(m.id, () => setDefaultCard(m.id), 'Cartão padrão atualizado')} style={[styles.rowBtn, (m.isDefault || busy === m.id) && { opacity: 0.5 }]}><Icon name="star-outline" size={18} /><Text style={styles.rowBtnText}>{m.isDefault ? 'Já é o padrão' : 'Tornar padrão'}</Text></Pressable>
                    <Pressable accessibilityRole="button" disabled={busy === m.id} onPress={() => confirmRemove(m)} style={styles.rowBtn}><Icon name="delete-outline" size={18} color={theme.error} /><Text style={[styles.rowBtnText, { color: theme.error }]}>Remover</Text></Pressable>
                  </View>
                ) : null}
              </View>
            )
          })}
          {adding ? (
            <CardForm holder={me?.name ?? ''} firstCard={methods.length === 0} onSaved={(m) => { setAdding(false); setToast(`${m.label} salvo na carteira`); void cards.reload() }} onCancel={() => setAdding(false)} />
          ) : (
            <Pressable accessibilityRole="button" onPress={() => setAdding(true)} style={styles.add}><Icon name="add" size={20} /><Text style={styles.addText}>Adicionar cartão</Text></Pressable>
          )}

          <Display size={20} line={26}>Recebimentos das vendas</Display>
          <Pressable accessibilityRole="button" onPress={() => router.push('/sales/payout' as never)} style={styles.row}>
            <View style={styles.rowHead}>
              <View style={[styles.brandChip, { backgroundColor: account ? colors.verified100 : colors.pending100 }]}><Icon name="account-balance" size={18} color={account ? colors.verified500 : theme.fg} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName}>{account ? `Chave Pix · ${PIX_TYPE_LABEL[account.pixKeyType] ?? account.pixKeyType}` : 'Pix para receber vendas'}</Text>
                <Text style={styles.rowSub}>{account ? `${account.pixKeyMask} · ${account.holderName}` : 'Cadastre a chave que recebe o valor das suas vendas.'}</Text>
              </View>
              <Text style={styles.link}>{account ? 'Trocar' : 'Cadastrar'}</Text>
            </View>
          </Pressable>
        </ScrollView>
      )}
      <Toast message={toast} onDone={clearToast} />
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  body: { padding: 16, gap: 12, paddingBottom: 32 },
  card: { height: 190, borderRadius: theme.radiusLg, padding: 18, backgroundColor: colors.ink900, justifyContent: 'space-between' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardBrand: { fontSize: 16, fontWeight: '700', color: colors.paper50, letterSpacing: 1 },
  cardTag: { fontSize: 11, fontWeight: '600', color: colors.ink900, backgroundColor: colors.sand500, paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.radiusFull, overflow: 'hidden' },
  cardNum: { fontSize: 20, color: colors.paper50, letterSpacing: 2, fontVariant: ['tabular-nums'] },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  cardHolder: { fontSize: 12, fontWeight: '600', color: colors.paper200, letterSpacing: 1 },
  balance: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: theme.radiusMd, backgroundColor: theme.surface },
  balanceK: { fontSize: 14, fontWeight: '600', color: theme.fg },
  balanceSub: { fontSize: 12, color: theme.fgMuted },
  balanceV: { fontSize: 16, fontWeight: '600', color: theme.fg, fontVariant: ['tabular-nums'] },
  empty: { fontSize: 13, lineHeight: 19, color: theme.fgMuted },
  row: { borderWidth: 1, borderColor: theme.border, borderRadius: theme.radiusMd, backgroundColor: theme.bg },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  brandChip: { width: 44, height: 30, borderRadius: theme.radiusSm, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' },
  brandChipText: { fontSize: 10, fontWeight: '700', color: theme.fg },
  rowName: { fontSize: 14, fontWeight: '600', color: theme.fg },
  rowSub: { fontSize: 12, lineHeight: 16, color: theme.fgMuted },
  rowActions: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 12 },
  rowBtn: { flex: 1, height: 40, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radiusSm, borderWidth: 1, borderColor: theme.border },
  rowBtnText: { fontSize: 13, fontWeight: '600', color: theme.fg },
  add: { height: 48, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', borderRadius: theme.radiusMd, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.fgDisabled },
  addText: { fontSize: 14, fontWeight: '600', color: theme.fg },
  link: { fontSize: 13, fontWeight: '600', color: theme.fg, textDecorationLine: 'underline' },
})
