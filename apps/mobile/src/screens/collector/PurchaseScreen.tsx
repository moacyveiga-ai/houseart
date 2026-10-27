// Acompanhar compra (handoff "HouseArt App Colecionador" › compra, `cpEtapas`):
// the artwork strip, the stage card (title + text), the values paid in escrow
// (Obra · Frete · Seguro · total), the steps of the deal with their dates and
// the action of the stage — "Pagar em garantia" (OFFER_ACCEPTED), "Assinar o
// termo de transferência" (ESCROW), "Confirmar com o toque na etiqueta"
// (SHIPPING → /purchases/[id]/receive), "Ver na coleção" (COMPLETED) — plus
// "Falar com o vendedor". Data: the deal of GET /api/collector/purchases by id;
// writes: POST /api/deals/[id]/{escrow,sign}. The server decides each phase.
import { useCallback, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useApi, useReloadOnFocus } from '@/api/hooks'
import { openDealConversation, payEscrow, signAsBuyer, type Purchases } from '@/api/collector'
import { colors, theme } from '@/theme'
import { KeyValue } from '@/ui/forms'
import { Display, ErrorState, Icon, Loading, Toast, TopBar, Wall, type IconName } from '@/ui/kit'
import { Button, ErrorText } from '@/ui/primitives'
import { brl } from '@/ui/format'
import { symbolIcon } from '../gallery/gallery-core'
import { buyerAction, escrowTotalCents, purchaseStage } from './collector-core'

export function PurchaseScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()
  const dealId = Number(id)
  const { data, error, loading, reload } = useApi<Purchases & { ok: boolean }>('/api/collector/purchases')
  useReloadOnFocus(reload)
  const d = data?.deals.find((x) => x.id === dealId) ?? null
  const [busy, setBusy] = useState(false)
  const [actError, setActError] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])

  // opens the conversation with who sold (POST /api/deals/[id]/conversation), as the web does
  async function talk() {
    if (busy || !d) return
    setBusy(true); setActError(null)
    try {
      const r = await openDealConversation(d.id)
      router.push({ pathname: '/messages/[id]', params: { id: String(r.id) } })
    } catch (e) { setActError((e as Error).message || 'Não foi possível abrir a conversa.') } finally { setBusy(false) }
  }
  async function run(fn: () => Promise<unknown>, done: string) {
    if (busy) return
    setBusy(true); setActError(null)
    try { await fn(); setToast(done); await reload() } catch (e) { setActError((e as Error).message || 'Não foi possível concluir.') } finally { setBusy(false) }
  }

  if (loading && !data) return <View style={[styles.fill, { paddingTop: insets.top }]}><TopBar title="Acompanhar compra" /><Loading /></View>
  if ((error && !data) || !d) return <View style={[styles.fill, { paddingTop: insets.top }]}><TopBar title="Acompanhar compra" /><ErrorState message={error ?? 'Compra não encontrada.'} onRetry={reload} /></View>

  const action = buyerAction(d)
  const stage = purchaseStage(d)
  const done = action === 'done'
  const total = escrowTotalCents(d)
  const shipping = Number(d.shippingCents)
  const insurance = Number(d.insuranceCents)

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <TopBar title="Acompanhar compra" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.strip}>
          <Wall uri={d.cover} padding={6} style={styles.stripWall} square={false} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Display italic size={16} line={21} numberOfLines={2}>{d.artworkTitle}</Display>
            <Text style={styles.muted}>{d.artist} · {d.sellerName}</Text>
          </View>
          <Text style={styles.pct}>{d.progressPct}%</Text>
        </View>

        <View style={[styles.stage, { backgroundColor: done ? colors.verified100 : action === 'receive' ? colors.sand100 : theme.surface }]}>
          <Icon name={done ? 'check-circle' : action === 'receive' ? 'contactless' : action === 'pay' ? 'lock' : 'schedule'} size={26} color={done ? colors.verified500 : theme.fg} />
          <Text style={[styles.stageTitle, done && { color: colors.verified500 }]}>{stage.title}</Text>
          {stage.text ? <Text style={styles.stageText}>{stage.text}</Text> : null}
          <Text style={styles.code}>Negócio {d.code}</Text>
        </View>

        <View>
          <KeyValue k="Obra" v={brl(d.amountCents)} />
          <KeyValue k="Frete" v={shipping ? brl(shipping) : 'Grátis'} />
          <KeyValue k="Seguro" v={insurance ? brl(insurance) : '—'} />
          <KeyValue k={d.escrowPaid || done ? 'Pago em garantia' : 'A pagar em garantia'} v={brl(total)} bold />
        </View>
        {d.shipping ? <Text style={styles.muted}>Transporte {d.shipping.carrier}{d.shipping.tracking ? ` · rastreio ${d.shipping.tracking}` : ''}{d.shipping.insurer ? ` · seguro ${d.shipping.insurer}` : ''}</Text> : null}

        <View style={styles.timeline}>
          {d.steps.map((s, i) => {
            const isDone = s.state === 'done' || done
            const on = s.state === 'on' && !done
            return (
              <View key={s.phase} style={styles.tl}>
                <View style={styles.tlRail}>
                  <View style={[styles.tlDot, isDone && styles.tlDotDone, on && styles.tlDotOn]}><Icon name={isDone ? 'check' : (symbolIcon(s.icon) as IconName)} size={16} color={isDone ? theme.bg : theme.fg} /></View>
                  {i < d.steps.length - 1 ? <View style={[styles.tlLine, isDone && { backgroundColor: theme.success }]} /> : null}
                </View>
                <View style={{ flex: 1, paddingBottom: 16 }}>
                  <Text style={[styles.tlName, on && { fontWeight: '700' }, !isDone && !on && { color: theme.fgMuted }]}>{s.title}</Text>
                  <Text style={styles.tlSub}>{s.description}</Text>
                </View>
                <Text style={styles.tlWhen}>{s.date ?? '—'}</Text>
              </View>
            )
          })}
        </View>
        <ErrorText>{actError}</ErrorText>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        {action === 'pay' ? <Button title={`Pagar em garantia · ${brl(total)}`} loading={busy} onPress={() => void run(() => payEscrow(d.id), 'Pago em garantia · o vendedor só recebe na entrega')} /> : null}
        {action === 'sign' ? <Button title="Assinar o termo de transferência" loading={busy} onPress={() => void run(() => signAsBuyer(d.id), 'Termo assinado')} /> : null}
        {action === 'receive' ? (
          <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/purchases/[id]/receive', params: { id: String(d.id) } })} style={styles.cta}>
            <Icon name="contactless" size={20} /><Text style={styles.ctaText}>Confirmar com o toque na etiqueta</Text>
          </Pressable>
        ) : null}
        {done ? <Button title="Ver na coleção" onPress={() => router.navigate('/(tabs)/wallet' as never)} /> : null}
        {!done && d.exception !== 'CANCELLED' ? <Button title="Falar com o vendedor" variant="ghost" onPress={() => void talk()} /> : null}
      </View>
      <Toast message={toast} onDone={clearToast} />
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  body: { padding: 16, gap: 14, paddingBottom: 24 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stripWall: { width: 64, height: 64 },
  muted: { fontSize: 12, lineHeight: 17, color: theme.fgMuted },
  pct: { fontSize: 15, fontWeight: '600', color: theme.fg, fontVariant: ['tabular-nums'] },
  stage: { padding: 14, borderRadius: theme.radiusMd, gap: 6 },
  stageTitle: { fontSize: 18, fontWeight: '600', color: theme.fg },
  stageText: { fontSize: 13, lineHeight: 19, color: theme.fgBody },
  code: { fontSize: 11, color: theme.fgMuted, fontVariant: ['tabular-nums'] },
  timeline: { paddingTop: 4 },
  tl: { flexDirection: 'row', gap: 10 },
  tlRail: { width: 30, alignItems: 'center' },
  tlDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: theme.fgDisabled, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' },
  tlDotDone: { backgroundColor: theme.success, borderColor: theme.success },
  tlDotOn: { backgroundColor: theme.accent, borderColor: theme.accent },
  tlLine: { flex: 1, width: 2, backgroundColor: theme.border, marginVertical: 2 },
  tlName: { fontSize: 14, fontWeight: '600', color: theme.fg },
  tlSub: { fontSize: 12, lineHeight: 16, color: theme.fgMuted },
  tlWhen: { fontSize: 11, color: theme.fgMuted, paddingTop: 6 },
  footer: { gap: 8, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.bg },
  cta: { height: 52, borderRadius: theme.radiusSm, backgroundColor: theme.accent, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaText: { fontSize: 16, fontWeight: '600', color: theme.fg },
})
