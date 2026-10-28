// Sua oferta / Contraproposta recebida (handoff "HouseArt App Colecionador" ›
// tela `compra` of an offer): the artwork strip, the status card, the rows
// Preço pedido · Sua oferta · Contraproposta, "Aguardando resposta do vendedor",
// the timeline, and the buttons the response allows — Aceitar e pagar ·
// Conversar antes · Recusar; Pagar; Nova oferta · Comprar por; Conversar.
// GET /api/collector/offers/[code]; replies by /api/public/offers/[code]/*.
import { useCallback, useEffect, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '@/api/client'
import { buyerOffer, replyOffer, retractOffer } from '@/api/market'
import type { ArtworkPage, BuyerOfferView } from '@/api/types'
import { colors, theme } from '@/theme'
import { Input, KeyValue, Label } from '@/ui/forms'
import { Display, ErrorState, Icon, Loading, Toast, TopBar, Wall, type IconName } from '@/ui/kit'
import { Button, ErrorText } from '@/ui/primitives'
import { brl } from '@/ui/format'
import { amountRows, counterValid, expiresText, reaisText, responseOf, statusCard, timelineOf, type Response, type SellerKind, type StatusOffer, type Tone } from './offer-core'

const TONE_BG: Record<Tone, string> = { neutral: theme.surface, ok: colors.verified100, sand: colors.sand100, alert: colors.alert100, muted: theme.surface }
const TONE_FG: Record<Tone, string> = { neutral: theme.fg, ok: theme.success, sand: theme.fg, alert: theme.error, muted: theme.fgMuted }

function toStatus(o: BuyerOfferView): StatusOffer {
  return {
    status: o.status, canReply: o.canReply, canRetract: o.canRetract, validityHours: o.validityHours, offeredCents: Number(o.offeredCents), currentCents: Number(o.currentCents),
    listPriceCents: o.listPriceCents === null ? null : Number(o.listPriceCents), rounds: o.rounds.map((r) => ({ ...r, amountCents: Number(r.amountCents) })), createdAt: o.createdAt, expiresAt: o.expiresAt,
    counterCents: o.counterCents === null ? null : Number(o.counterCents), counterMessage: o.counterMessage, guaranteeMethod: o.guaranteeMethod,
  }
}

export function OfferStatusScreen({ code }: { code: string }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [offer, setOffer] = useState<BuyerOfferView | null>(null)
  const [artwork, setArtwork] = useState<ArtworkPage | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [actError, setActError] = useState<string | null>(null)
  const [countering, setCountering] = useState(false)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])

  const load = useCallback(async () => {
    try {
      const o = await buyerOffer(code)
      setOffer(o); setError(null)
      if (o.artworkPublicId) api<ArtworkPage>(`/api/public/artworks/${encodeURIComponent(o.artworkPublicId)}`).then(setArtwork).catch(() => undefined)
    } catch (e) { setError((e as Error).message) } finally { setLoaded(true) }
  }, [code])
  useEffect(() => { void load() }, [load])

  if (!loaded) return <View style={[styles.fill, { paddingTop: insets.top }]}><TopBar title="Sua oferta" /><Loading /></View>
  if (!offer) return <View style={[styles.fill, { paddingTop: insets.top }]}><TopBar title="Sua oferta" /><ErrorState message={error ?? 'Proposta não encontrada.'} onRetry={() => void load()} /></View>

  const o = toStatus(offer)
  const r: Response = responseOf(o)
  const sellerKind: SellerKind = artwork?.seller.kind ?? 'PRIVATE'
  const sellerName = artwork?.seller.name ?? 'Vendedor'
  const sellerPhrase = sellerKind === 'GALLERY' ? `a ${sellerName}` : 'o vendedor'
  const card = statusCard(o, r, sellerPhrase, sellerKind === 'GALLERY' ? sellerName : 'O vendedor')
  const timeline = timelineOf(o, r, sellerKind)
  const closed = r === 'aceita' || r === 'contra_aceita'
  const live = r === 'analise' || r === 'aguardando' || r === 'contra'
  const counterCents = Math.round(Number(amount.replace(/\D/g, '')) * 100)
  const publicId = offer.artworkPublicId

  async function act(label: string, fn: () => Promise<unknown>, done: string) {
    if (busy) return
    setBusy(label); setActError(null)
    try { await fn(); setToast(done); setCountering(false); await load() } catch (e) { setActError((e as Error).message || 'Não foi possível registrar. Tente de novo.') } finally { setBusy(null) }
  }
  const confirmRetract = (title: string, text: string, done: string) => Alert.alert(title, text, [{ text: 'Voltar', style: 'cancel' }, { text: 'Confirmar', style: 'destructive', onPress: () => void act('retract', () => retractOffer(code), done) }])
  const talk = async () => {
    if (!artwork || busy) return
    setBusy('talk')
    try { const c = await api<{ ok: boolean; id: number }>('/api/messages', { body: { artworkId: artwork.id } }); router.push(`/messages/${c.id}`) } catch (e) { setActError((e as Error).message) } finally { setBusy(null) }
  }
  const webPurchases = () => router.push('/purchases' as never)

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <TopBar title={closed ? 'Acompanhar compra' : 'Sua oferta'} onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" onPress={() => publicId && router.push(`/artwork/${publicId}`)} style={styles.strip}>
          <Wall uri={artwork?.cover ?? offer.artworkCover} padding={6} style={styles.stripWall} square={false} />
          <View style={{ flex: 1 }}><Display italic size={15} line={20} numberOfLines={1}>{artwork?.title ?? offer.artworkTitle}</Display><Text style={styles.stripSub}>{[artwork?.artist ?? offer.artistName, sellerName].filter(Boolean).join(' · ')}</Text></View>
          <Icon name="chevron-right" size={20} color={theme.fgMuted} />
        </Pressable>

        <View style={[styles.status, { backgroundColor: TONE_BG[card.tone] }]}>
          <Icon name={card.icon as IconName} size={26} color={TONE_FG[card.tone]} />
          <Text style={[styles.statusTitle, { color: TONE_FG[card.tone] }]}>{card.title}</Text>
          <Text style={styles.statusText}>{card.text}</Text>
          <Text style={styles.code}>Oferta {offer.code}{live ? ` · válida até ${expiresText(offer.expiresAt)}` : ''}</Text>
        </View>

        {offer.counterMessage && r === 'contra' ? <Text style={styles.quote}>“{offer.counterMessage}”</Text> : null}
        <View>{amountRows(o, r).map((row) => <KeyValue key={row.k} k={row.k} v={row.v} bold={row.bold} />)}</View>
        {r === 'analise' ? <View style={styles.waiting}><View style={styles.pulse} /><Text style={styles.waitingText}>Aguardando resposta do vendedor</Text></View> : null}

        {countering ? (
          <View style={styles.counterBox}>
            <Label hint={offer.counterCents ? `entre ${brl(o.offeredCents)} e ${brl(Number(offer.counterCents))}` : undefined}>Sua nova oferta (R$)</Label>
            <Input value={amount} onChangeText={(v) => setAmount(reaisText(Math.round((parseInt(v.replace(/\D/g, ''), 10) || 0) * 100)))} inputMode="numeric" placeholder="0" />
            <Label hint="opcional">Mensagem</Label>
            <Input value={note} onChangeText={setNote} maxLength={500} />
            <Button title="Enviar nova oferta" loading={busy === 'counter'} disabled={!counterValid(counterCents, o)} onPress={() => void act('counter', () => replyOffer(code, { accept: false, amountCents: counterCents, message: note.trim() || undefined }), 'Nova oferta enviada')} />
            <Button title="Cancelar" variant="ghost" onPress={() => setCountering(false)} />
          </View>
        ) : null}

        <View style={styles.timeline}>
          {timeline.map((t, i) => (
            <View key={t.name} style={styles.tl}>
              <View style={styles.tlRail}><View style={[styles.tlDot, t.done && styles.tlDotOn]}>{t.done ? <Icon name="check" size={12} color={theme.bg} /> : null}</View>{i < timeline.length - 1 ? <View style={[styles.tlLine, t.done && { backgroundColor: theme.success }]} /> : null}</View>
              <View style={{ flex: 1, paddingBottom: 14 }}><Text style={[styles.tlName, !t.done && { color: theme.fgMuted }]}>{t.name}</Text><Text style={styles.tlSub}>{t.sub}</Text></View>
              <Text style={styles.tlWhen}>{t.when}</Text>
            </View>
          ))}
        </View>
        <ErrorText>{actError}</ErrorText>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        {closed ? (<>
          <Button title="Acompanhar a compra" onPress={webPurchases} />
          {artwork ? <Button title="Falar com o vendedor" variant="ghost" loading={busy === 'talk'} onPress={() => void talk()} /> : null}
        </>) : r === 'contra' && offer.counterCents !== null ? (<>
          <Button title={`Aceitar e pagar ${brl(Number(offer.counterCents))}`} loading={busy === 'accept'} onPress={() => void act('accept', () => replyOffer(code, { accept: true }), 'Contraproposta aceita · o valor vai para a garantia')} />
          <View style={styles.row}>
            {artwork ? <View style={{ flex: 1 }}><Button title="Conversar antes" variant="ghost" loading={busy === 'talk'} onPress={() => void talk()} /></View> : null}
            {!countering ? <View style={{ flex: 1 }}><Button title="Nova oferta" variant="ghost" onPress={() => setCountering(true)} /></View> : null}
          </View>
          {offer.canRetract ? <Button title="Recusar" variant="danger" loading={busy === 'retract'} onPress={() => confirmRetract('Recusar a contraproposta?', 'Recusar retira a sua oferta. Nada foi cobrado.', 'Oferta retirada')} /> : null}
        </>) : live ? (<>
          {artwork ? <Button title={`Conversar com ${sellerName}`} variant="ghost" loading={busy === 'talk'} onPress={() => void talk()} /> : null}
          {offer.canRetract ? <Button title="Cancelar oferta" variant="danger" loading={busy === 'retract'} onPress={() => confirmRetract('Cancelar a oferta?', 'A reserva da garantia é desfeita na hora.', 'Oferta retirada')} /> : null}
        </>) : (<>
          {publicId ? <Button title="Nova oferta" onPress={() => router.replace(`/artwork/${publicId}/offer`)} /> : null}
          {publicId && o.listPriceCents ? <Button title={`Comprar por ${brl(o.listPriceCents)}`} variant="ghost" onPress={() => router.replace(`/artwork/${publicId}/buy`)} /> : null}
        </>)}
      </View>
      <Toast message={toast} onDone={clearToast} />
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  body: { padding: 16, gap: 14, paddingBottom: 24 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stripWall: { width: 56, height: 56, borderRadius: theme.radiusSm },
  stripSub: { fontSize: 12, color: theme.fgMuted },
  status: { padding: 14, borderRadius: theme.radiusMd, gap: 6 },
  statusTitle: { fontSize: 18, fontWeight: '600' },
  statusText: { fontSize: 13, lineHeight: 19, color: theme.fgBody },
  code: { fontSize: 11, color: theme.fgMuted, fontVariant: ['tabular-nums'] },
  quote: { fontSize: 13, fontStyle: 'italic', color: theme.fgBody, paddingHorizontal: 4 },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.pending500 },
  waitingText: { fontSize: 13, color: theme.fgMuted },
  counterBox: { gap: 8, padding: 12, borderRadius: theme.radiusMd, backgroundColor: theme.surface },
  timeline: { paddingTop: 4 },
  tl: { flexDirection: 'row', gap: 10 },
  tlRail: { width: 20, alignItems: 'center' },
  tlDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: theme.fgDisabled, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' },
  tlDotOn: { backgroundColor: theme.success, borderColor: theme.success },
  tlLine: { flex: 1, width: 2, backgroundColor: theme.border, marginVertical: 2 },
  tlName: { fontSize: 14, fontWeight: '600', color: theme.fg },
  tlSub: { fontSize: 12, lineHeight: 16, color: theme.fgMuted },
  tlWhen: { fontSize: 11, color: theme.fgMuted, paddingTop: 2 },
  footer: { gap: 8, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.bg },
  row: { flexDirection: 'row', gap: 8 },
})
