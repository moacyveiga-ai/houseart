// Comprar direto (handoff "HouseArt App Colecionador" › sheet `checkout`):
// Entrega (transportadora com CEP + cotação · retirar com o vendedor) →
// Seguro parede a parede → Pagamento (cartão da carteira, "Adicionar cartão")
// → Obra · Frete · Seguro · Total → "Em garantia até você confirmar a entrega"
// + "Pagar R$ X". POST /api/public/checkout; done = "Pago em garantia".
import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useApi } from '@/api/hooks'
import { checkout, listCards, shippingQuote, type ShippingQuote } from '@/api/market'
import type { ArtworkPage, PaymentMethodView } from '@/api/types'
import { useSession } from '@/auth/session'
import { colors, theme } from '@/theme'
import { CardForm } from '@/ui/CardForm'
import { Input, KeyValue, Label, OptionCard, Toggle } from '@/ui/forms'
import { Display, ErrorState, Icon, IconButton, Loading, Toast, Wall } from '@/ui/kit'
import { Button, ErrorText } from '@/ui/primitives'
import { brl } from '@/ui/format'
import { blockedReason, checkoutTotals, ctaLabel, insuranceText, summaryLines, type DeliveryMode } from './checkout-core'
import { formatCepInput } from './offer-core'

export function CheckoutScreen({ publicId }: { publicId: string }) {
  const insets = useSafeAreaInsets()
  const { data, error, loading, reload } = useApi<ArtworkPage>(`/api/public/artworks/${encodeURIComponent(publicId)}`)
  if (loading && !data) return <View style={[styles.fill, { paddingTop: insets.top }]}><Loading /></View>
  if (!data) return <View style={[styles.fill, { paddingTop: insets.top }]}><ErrorState message={error ?? 'Obra não encontrada.'} onRetry={reload} /></View>
  if (data.status !== 'LISTED' || data.priceCents === null || Number(data.priceCents) <= 0) return <View style={[styles.fill, { paddingTop: insets.top }]}><ErrorState message={data.status === 'LISTED' ? 'Esta obra é vendida sob consulta: faça uma proposta pela página da obra.' : 'A obra saiu do marketplace ou está reservada por outra pessoa.'} /></View>
  return <Checkout artwork={data} />
}

function Checkout({ artwork: a }: { artwork: ArtworkPage }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { me } = useSession()
  const price = Number(a.priceCents)
  const [delivery, setDelivery] = useState<DeliveryMode>('CARRIER')
  const [cep, setCep] = useState('')
  const [quote, setQuote] = useState<ShippingQuote | null>(null)
  const [insurance, setInsurance] = useState(true)
  const [cards, setCards] = useState<PaymentMethodView[] | null>(null)
  const [cardId, setCardId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ code: string; card: PaymentMethodView | null } | null>(null)
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])

  useEffect(() => { listCards().then((list) => { setCards(list); setCardId(list.find((m) => m.isDefault)?.id ?? list[0]?.id ?? null); if (!list.length) setAdding(true) }).catch(() => setCards([])) }, [])

  async function changeCep(raw: string) {
    const v = formatCepInput(raw)
    setCep(v)
    if (v.replace(/\D/g, '').length !== 8) { setQuote(null); return }
    try { setQuote(await shippingQuote(a.publicId, v, price)) } catch { setQuote(null) }
  }
  const totals = checkoutTotals({ priceCents: price, delivery, shippingCents: quote?.shippingCents ?? 0, insuranceCents: quote?.insuranceCents ?? 0, insurance })
  const card = cards?.find((c) => c.id === cardId) ?? null
  const blocked = blockedReason({ delivery, cepValid: !!quote, hasCard: !!card })
  const pickupPlace = [a.seller.city, a.seller.uf].filter(Boolean).join(', ') || 'Local combinado'

  async function pay() {
    if (!card) { setAdding(true); return }
    if (blocked) { setError(blocked); return }
    setBusy(true); setError(null)
    try { const r = await checkout({ publicId: a.publicId, paymentMethodId: card.id, deliveryCep: delivery === 'CARRIER' ? quote?.cep ?? null : null, insurance: delivery === 'CARRIER' && insurance }); setDone({ code: r.code, card }) }
    catch (e) { setError((e as Error).message || 'Não foi possível confirmar o pedido.') } finally { setBusy(false) }
  }
  const back = () => (router.canGoBack() ? router.back() : router.replace(`/artwork/${a.publicId}`))

  if (done) return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <View style={styles.done}>
        <View style={styles.doneIcon}><Icon name="lock" size={30} /></View>
        <Text style={styles.doneTitle}>Pago em garantia</Text>
        <Text style={styles.doneLead}>{done.card ? `${done.card.label} · ` : ''}o vendedor só recebe na entrega.</Text>
        <Text style={styles.doneText}>O valor de {brl(totals.total)} fica retido na HouseArt. Quando a obra chegar, confirme a entrega com o toque na etiqueta: o pagamento é liberado ao vendedor e a escritura passa para o seu nome no mesmo instante.{done.code ? ` Pedido ${done.code}.` : ''}</Text>
        <Button title="Acompanhar a compra" onPress={() => router.replace({ pathname: '/web', params: { path: '/purchases', title: 'Compras' } })} />
        <Button title="Voltar para a obra" variant="ghost" onPress={() => router.replace(`/artwork/${a.publicId}`)} />
      </View>
    </View>
  )

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <View style={styles.head}><IconButton name="close" label="Fechar" onPress={back} /><Text style={styles.headTitle}>Comprar</Text></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        <View style={styles.strip}>
          <Wall uri={a.cover} padding={6} style={styles.stripWall} square={false} />
          <View style={{ flex: 1 }}><Display italic size={15} line={20} numberOfLines={1}>{a.title}</Display><Text style={styles.stripSub}>{a.artist} · {a.seller.name}</Text></View>
        </View>

        <Text style={styles.h}>Entrega</Text>
        <OptionCard on={delivery === 'CARRIER'} name="Transportadora especializada" sub="Embalagem museológica · 5 a 7 dias úteis" right={quote ? brl(quote.shippingCents) : 'pelo CEP'} onPress={() => setDelivery('CARRIER')} />
        <OptionCard on={delivery === 'PICKUP'} name="Retirar com o vendedor" sub={`${pickupPlace} · com hora marcada`} right="Grátis" onPress={() => setDelivery('PICKUP')} />
        {delivery === 'CARRIER' ? (<>
          <Label>CEP de entrega</Label>
          <Input value={cep} onChangeText={(v) => void changeCep(v)} inputMode="numeric" placeholder="00000-000" />
          <Text style={styles.note}>{quote ? `Frete ${brl(quote.shippingCents)} · seguro ${brl(quote.insuranceCents)}` : 'Frete e seguro são calculados pelo CEP.'}</Text>
        </>) : null}

        <Pressable accessibilityRole="switch" accessibilityState={{ checked: insurance }} onPress={() => setInsurance((v) => !v)} disabled={delivery === 'PICKUP'} style={[styles.insure, delivery === 'PICKUP' && { opacity: 0.5 }]}>
          <Icon name="shield" size={22} />
          <View style={{ flex: 1 }}><Text style={styles.cardName}>Seguro parede a parede</Text><Text style={styles.note}>{insuranceText({ delivery, insurance, insuranceCents: quote?.insuranceCents ?? 0, quoted: !!quote })}</Text></View>
          <Toggle on={insurance && delivery === 'CARRIER'} onPress={() => setInsurance((v) => !v)} label="Seguro parede a parede" />
        </Pressable>

        <Text style={styles.h}>Pagamento</Text>
        <Text style={styles.note}>Cartão de crédito · o valor fica em garantia até a entrega.</Text>
        {cards === null ? <Loading /> : (<>
          {cards.map((m) => <OptionCard key={m.id} on={cardId === m.id} icon="credit-card" name={m.label} sub={`Vence ${m.exp}${m.isDefault ? ' · padrão' : ''}`} onPress={() => setCardId(m.id)} />)}
          {adding ? <CardForm holder={me?.name ?? ''} firstCard={cards.length === 0} onSaved={(m) => { setCards((cs) => [...(cs ?? []).map((c) => (m.isDefault ? { ...c, isDefault: false } : c)), m]); setCardId(m.id); setAdding(false); setToast(`${m.label} salvo na carteira`) }} onCancel={cards.length ? () => setAdding(false) : undefined} />
            : <Pressable accessibilityRole="button" onPress={() => setAdding(true)} style={styles.addCard}><Icon name="add-card" size={20} /><Text style={styles.cardName}>Adicionar cartão</Text></Pressable>}
        </>)}

        <View style={styles.summary}>
          {summaryLines(totals).map((l) => <KeyValue key={l.k} k={l.k} v={l.v} />)}
          <View style={styles.total}><Text style={styles.totalK}>Total</Text><Text style={styles.totalV}>{brl(totals.total)}</Text></View>
        </View>
        <ErrorText>{error}</ErrorText>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <View style={styles.lockRow}><Icon name="lock" size={14} color={theme.fgMuted} /><Text style={styles.note}>Em garantia até você confirmar a entrega</Text></View>
        <Button title={ctaLabel(!!card, totals.total)} loading={busy} disabled={!!card && !!blocked} onPress={() => void pay()} />
      </View>
      <Toast message={toast} onDone={clearToast} />
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  head: { height: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  headTitle: { fontSize: 16, fontWeight: '600', color: theme.fg },
  body: { padding: 16, paddingTop: 4, gap: 10, paddingBottom: 32 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  stripWall: { width: 56, height: 56, borderRadius: theme.radiusSm },
  stripSub: { fontSize: 12, color: theme.fgMuted },
  h: { fontSize: 14, fontWeight: '600', color: theme.fg, marginTop: 6 },
  note: { fontSize: 12, lineHeight: 17, color: theme.fgMuted },
  cardName: { fontSize: 14, fontWeight: '600', color: theme.fg },
  insure: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: theme.radiusMd, borderWidth: 1, borderColor: theme.border },
  addCard: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: theme.radiusMd, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.fgDisabled },
  summary: { marginTop: 6 },
  total: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 },
  totalK: { fontSize: 15, fontWeight: '600', color: theme.fg },
  totalV: { fontSize: 18, fontWeight: '600', color: theme.fg, fontVariant: ['tabular-nums'] },
  footer: { gap: 8, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.bg },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  done: { flex: 1, padding: 24, gap: 12, justifyContent: 'center' },
  doneIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.verified100, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  doneTitle: { fontSize: 24, fontWeight: '600', color: theme.fg, textAlign: 'center' },
  doneLead: { fontSize: 14, color: theme.fgBody, textAlign: 'center' },
  doneText: { fontSize: 13, lineHeight: 19, color: theme.fgMuted, textAlign: 'center' },
})
