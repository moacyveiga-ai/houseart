// Ofertas recebidas (handoff "HouseArt App Galeria" › Negócios › Ofertas,
// `ngOfertasLista`): the insight line, then a card per proposal — wall ·
// title · "Preço …" · the value with "% do preço" · the buyer line with the
// expiry pill · the message · "N outras ofertas nesta obra" · Aceitar ·
// Contrapropor · Recusar (open ones) or the resolved pill. The counter is a
// sheet with the suggested value (halfway, rounded to R$ 500). Writes go to
// POST /api/offers/[id]/{accept,refuse,counter}; the server is the authority.
import { useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import { acceptOffer, counterOffer, refuseOffer, type OfferRow } from '@/api/gallery'
import { colors, theme } from '@/theme'
import { BottomSheet } from '@/ui/forms'
import { Avatar, Display, Icon, Wall } from '@/ui/kit'
import { Button } from '@/ui/primitives'
import { avatarTint, brl, initialsOf } from '@/ui/format'
import { offerPct, offerResolved, offersSummary, otherOffersLine, priceCents, priceMask, sellerCanAnswer, sortOffers, suggestedCounterReais } from './gallery-core'

interface Props { offers: OfferRow[]; onChanged: () => Promise<void>; onToast: (message: string) => void }

export function OffersSection({ offers, onChanged, onToast }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState<number | null>(null)
  const [counter, setCounter] = useState<OfferRow | null>(null)
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const rows = sortOffers(offers)
  const summary = offersSummary(offers)

  async function act(o: OfferRow, action: 'accept' | 'refuse' | 'counter') {
    if (busy) return
    setBusy(o.id)
    try {
      if (action === 'accept') { await acceptOffer(o.id); onToast(`Oferta aceita · ${o.buyer} tem 24 h para pagar em garantia`) }
      else if (action === 'refuse') { await refuseOffer(o.id); onToast(`Oferta recusada · ${o.buyer} foi avisado`) }
      else { await counterOffer(o.id, priceCents(amount), note.trim() || undefined); setCounter(null); onToast(`Contraproposta enviada para ${o.buyer}`) }
      await onChanged()
    } catch (e) { onToast((e as Error).message || 'Não foi possível responder.') } finally { setBusy(null) }
  }
  const openCounter = (o: OfferRow) => { setCounter(o); setAmount(priceMask(suggestedCounterReais(o))); setNote('') }

  return (
    <View style={styles.wrap}>
      {summary ? <View style={styles.summary}><Icon name="insights" size={20} /><Text style={styles.summaryText}>{summary}</Text></View> : null}
      {rows.length === 0 ? <Text style={styles.empty}>Nenhuma oferta aberta agora.</Text> : rows.map((o) => {
        const pct = offerPct(o)
        const tint = avatarTint(o.buyer)
        const others = otherOffersLine(o, offers)
        const last = o.rounds[o.rounds.length - 1]
        const message = last?.author === 'BUYER' ? last.message : o.rounds[0]?.message ?? null
        const canAnswer = sellerCanAnswer(o)
        const resolved = o.open ? null : offerResolved(o)
        return (
          <View key={o.id} style={[styles.card, { borderColor: o.open ? theme.fg : theme.border }]}>
            <View style={styles.cardHead}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Abrir ${o.artworkTitle}`} onPress={() => router.push({ pathname: '/artworks/[id]/listing', params: { id: String(o.artworkId) } })}><Wall uri={o.artworkCover} padding={6} style={styles.cardWall} square={false} /></Pressable>
              <View style={{ flex: 1, minWidth: 0 }}><Display italic size={14} line={18} numberOfLines={1}>{o.artworkTitle}</Display><Text style={styles.muted}>Preço {o.listPriceCents ? brl(o.listPriceCents) : '—'}</Text></View>
              <View style={{ alignItems: 'flex-end' }}><Text style={styles.value}>{brl(o.currentCents)}</Text>{pct ? <Text style={[styles.pct, { color: pct.color }]}>{pct.text}</Text> : null}</View>
            </View>
            <View style={styles.buyer}>
              <Avatar initials={initialsOf(o.buyer)} bg={tint.bg} fg={tint.fg} size={32} />
              <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.buyerName} numberOfLines={1}>{o.buyer}</Text><Text style={styles.buyerSub}>{o.code}</Text></View>
              <View style={[styles.pill, { backgroundColor: o.open ? colors.pending100 : theme.surface }]}><Text style={styles.pillText}>{o.open ? `expira em ${o.expiresIn}` : o.statusLabel}</Text></View>
            </View>
            {message ? <Text style={styles.message}>“{message}”</Text> : null}
            {others ? <View style={styles.others}><Icon name="stacked-line-chart" size={16} color={theme.accentStrong} /><Text style={styles.othersText}>{others}</Text></View> : null}
            {o.open ? (
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" disabled={!canAnswer || busy === o.id} onPress={() => void act(o, 'accept')} style={[styles.act, styles.actAccept, (!canAnswer || busy === o.id) && styles.off]}><Text style={styles.actText}>Aceitar</Text></Pressable>
                <Pressable accessibilityRole="button" disabled={!canAnswer || busy === o.id} onPress={() => openCounter(o)} style={[styles.act, styles.actCounter, (!canAnswer || busy === o.id) && styles.off]}><Text style={styles.actText}>Contrapropor</Text></Pressable>
                <Pressable accessibilityRole="button" disabled={busy === o.id} onPress={() => void act(o, 'refuse')} style={[styles.act, styles.actRefuse, busy === o.id && styles.off]}><Text style={styles.actText}>Recusar</Text></Pressable>
              </View>
            ) : null}
            {resolved ? <View style={[styles.resolved, { backgroundColor: resolved.bg }]}><Text style={styles.resolvedText}>{resolved.label}</Text></View> : null}
            {o.open && !canAnswer ? <Text style={styles.muted}>Contraproposta enviada · aguardando {o.buyer}</Text> : null}
          </View>
        )
      })}

      <BottomSheet open={!!counter} title="Contrapropor" onClose={() => setCounter(null)} height="60%"
        footer={<Button title="Enviar contraproposta" disabled={priceCents(amount) <= 0} loading={!!counter && busy === counter.id} onPress={() => counter && void act(counter, 'counter')} />}>
        {counter ? (
          <>
            <Text style={styles.sheetSub}>{counter.buyer} ofereceu {brl(counter.currentCents)} em {counter.artworkTitle}.{counter.listPriceCents ? ` Seu preço é ${brl(counter.listPriceCents)}.` : ''}</Text>
            <Text style={styles.label}>Sua contraproposta</Text>
            <View style={styles.bigField}><Text style={styles.bigCurrency}>R$</Text><TextInput value={amount} onChangeText={(v) => setAmount(priceMask(v))} inputMode="numeric" keyboardType="number-pad" autoFocus style={styles.bigInput} accessibilityLabel="Valor da contraproposta em reais" /></View>
            <Text style={styles.label}>Mensagem <Text style={styles.hint}>· opcional</Text></Text>
            <TextInput value={note} onChangeText={setNote} multiline placeholder="Uma linha para o comprador" placeholderTextColor={theme.fgDisabled} style={styles.note} maxLength={300} />
          </>
        ) : null}
      </BottomSheet>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: theme.radiusMd, backgroundColor: colors.sand100 },
  summaryText: { flex: 1, fontSize: 13, lineHeight: 18, color: theme.fg },
  empty: { paddingVertical: 24, fontSize: 14, color: theme.fgMuted },
  card: { gap: 12, padding: 14, borderWidth: 1, borderRadius: theme.radiusMd, backgroundColor: theme.bg },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardWall: { width: 56, height: 56 },
  muted: { fontSize: 12, lineHeight: 16, color: theme.fgMuted },
  value: { fontSize: 18, fontWeight: '600', color: theme.fg, fontVariant: ['tabular-nums'] },
  pct: { fontSize: 11, fontWeight: '600' },
  buyer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  buyerName: { fontSize: 13, fontWeight: '600', color: theme.fg },
  buyerSub: { fontSize: 11, lineHeight: 15, color: theme.fgMuted },
  pill: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: theme.radiusFull },
  pillText: { fontSize: 11, fontWeight: '600', color: theme.fg },
  message: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: theme.radiusSm, backgroundColor: theme.surface, fontSize: 13, lineHeight: 18, color: theme.fgBody },
  others: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  othersText: { fontSize: 12, fontWeight: '600', color: theme.accentStrong },
  actions: { flexDirection: 'row', gap: 6 },
  act: { flex: 1, height: 40, borderRadius: theme.radiusMd, alignItems: 'center', justifyContent: 'center' },
  actAccept: { backgroundColor: theme.accent },
  actCounter: { borderWidth: 1, borderColor: theme.fg },
  actRefuse: { backgroundColor: theme.surface },
  actText: { fontSize: 13, fontWeight: '600', color: theme.fg },
  off: { opacity: 0.45 },
  resolved: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: theme.radiusSm },
  resolvedText: { fontSize: 13, fontWeight: '600', color: theme.fg },
  sheetSub: { fontSize: 14, lineHeight: 21, color: theme.fgMuted },
  label: { fontSize: 13, fontWeight: '600', color: theme.fg },
  hint: { fontWeight: '400', color: theme.fgMuted },
  bigField: { height: 60, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, borderRadius: theme.radiusSm, borderWidth: 1.5, borderColor: theme.fg },
  bigCurrency: { fontSize: 18, color: theme.fgMuted },
  bigInput: { flex: 1, minWidth: 0, fontSize: 24, fontWeight: '600', color: theme.fg, paddingVertical: 0, fontVariant: ['tabular-nums'] },
  note: { minHeight: 70, borderWidth: 1, borderColor: theme.fgDisabled, borderRadius: theme.radiusSm, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: theme.fg, textAlignVertical: 'top' },
})
