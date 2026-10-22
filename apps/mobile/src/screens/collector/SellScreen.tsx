// Vender esta obra (handoff "HouseArt App Colecionador" › vender, and the web
// SellSheet): for ONE artwork the person holds. Without the green seal the
// screen is "Certifique primeiro" (POST …/services CERTIFICATION); already for
// sale, "Gestão do anúncio". Otherwise two steps — "Preço e modalidade" (mode
// cards, the asked price, the minimum the person accepts, the automatic
// negotiator and its auto-accept percentage) and "Revise o anúncio" (the
// estimate of GET …/sell-estimate: the 4 % of the seller, the resale royalty
// of 5 % over the appreciation, the net and what the buyer pays — the server's
// math). Publishing asks for the Pix first, as the prototype does.
//
// The minimum is TYPED here and goes up in POST …/sell; the app never reads it
// back nor shows it after publishing (the server keeps it to itself).
import { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useApi } from '@/api/hooks'
import { orderService, payoutAccount, sellArtwork, sellEstimate, type SellEstimate } from '@/api/collector'
import type { WalletItem } from '@/api/types'
import { colors, theme } from '@/theme'
import { Segments, Toggle } from '@/ui/forms'
import { Display, ErrorState, Icon, IconButton, Loading, Toast, Wall, type IconName } from '@/ui/kit'
import { Button, ErrorText } from '@/ui/primitives'
import { brl } from '@/ui/format'
import { priceMask, priceReais } from '../gallery/gallery-core'
import { autoAcceptBps, sellProblems, type SellMode } from './collector-core'

export function SellScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()
  const artworkId = Number(id)
  const wallet = useApi<{ items: WalletItem[] }>('/api/collector/wallet')
  const a = wallet.data?.items.find((x) => x.artworkId === artworkId) ?? null

  const [step, setStep] = useState<0 | 1>(0)
  const [mode, setMode] = useState<SellMode>('offers')
  const [price, setPrice] = useState('')
  const [min, setMin] = useState('')
  const [negotiator, setNegotiator] = useState(true)
  const [acceptPct, setAcceptPct] = useState('92')
  const [est, setEst] = useState<SellEstimate | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const listReais = priceReais(price)
  const minReais = mode === 'fixed' ? listReais : priceReais(min)
  const bps = mode === 'fixed' || !negotiator ? 10000 : autoAcceptBps(acceptPct)
  const problems = listReais > 0 ? sellProblems(listReais, minReais, mode, bps) : []
  const ok = listReais > 0 && problems.length === 0

  // The estimate is the server's: fetched when the review opens.
  useEffect(() => {
    if (step !== 1 || !a) return
    let alive = true
    setEst(null)
    sellEstimate(a.artworkId, BigInt(listReais) * 100n).then((r) => { if (alive) setEst(r.estimate) }).catch((e: Error) => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [step, a, listReais])

  async function certify() {
    if (!a || busy) return
    setBusy(true); setError(null)
    try { await orderService(a.artworkId, 'CERTIFICATION'); setToast('Certificação pedida · acompanhe na página da obra') } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  async function publish() {
    if (!a || busy) return
    setBusy(true); setError(null)
    try {
      let pix = null
      try { pix = await payoutAccount() } catch { pix = null }
      if (!pix) { setBusy(false); setToast('Cadastre uma chave Pix para receber pela venda'); router.push('/sales/payout' as never); return }
      await sellArtwork(a.artworkId, {
        listPriceCents: String(listReais * 100), reservePriceCents: String(minReais * 100),
        autoNegotiatorOn: mode === 'offers' && negotiator, autoAcceptMinBps: bps, fixedPrice: mode === 'fixed',
      })
      // Nothing of the mandate stays in memory once it went up.
      setMin('')
      router.replace({ pathname: '/artworks/[id]/listing', params: { id: String(a.artworkId) } })
    } catch (e) { setError((e as Error).message || 'Não foi possível anunciar agora.') } finally { setBusy(false) }
  }

  const close = () => (step === 1 ? setStep(0) : router.back())
  const head = (stepTxt?: string) => (
    <View style={styles.bar}>
      <IconButton name={step === 1 ? 'arrow-back' : 'close'} label={step === 1 ? 'Voltar' : 'Fechar'} onPress={close} />
      <Text style={styles.barTitle}>Vender uma obra</Text>
      <Text style={styles.barStep}>{stepTxt ?? ''}</Text>
    </View>
  )
  const work = (sub: string) => (
    <View style={styles.work}>
      <Wall uri={a?.cover} padding={6} style={styles.workWall} square={false} />
      <View style={{ flex: 1, minWidth: 0 }}><Display italic size={15} line={20} numberOfLines={2}>{a?.title ?? ''}</Display><Text style={styles.muted}>{sub}</Text></View>
    </View>
  )
  const block = (icon: IconName, title: string, lead: string) => (
    <View style={styles.block}><View style={styles.blockIcon}><Icon name={icon} size={28} /></View><Text style={styles.blockTitle}>{title}</Text><Text style={styles.blockLead}>{lead}</Text></View>
  )

  if (wallet.loading && !wallet.data) return <View style={[styles.fill, { paddingTop: insets.top }]}>{head()}<Loading /></View>
  if (!a) return <View style={[styles.fill, { paddingTop: insets.top }]}>{head()}<ErrorState message={wallet.error ?? 'Esta obra não está na sua coleção.'} onRetry={wallet.reload} /></View>

  const registered = a.registeredCents ? Number(a.registeredCents) : null
  const foot = (children: React.ReactNode) => <View style={[styles.foot, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>{children}</View>

  if (!a.sealGreen) {
    return (
      <View style={[styles.fill, { paddingTop: insets.top }]}>
        {head()}
        <ScrollView contentContainerStyle={styles.body}>{work(a.artist)}{block('verified', 'Certifique primeiro', 'Só obras com o selo verde vão ao marketplace. A certificação confere a obra, cola a etiqueta no verso e emite a escritura em seu nome.')}<ErrorText>{error}</ErrorText></ScrollView>
        {foot(<Button title="Pedir certificação" loading={busy} onPress={() => void certify()} />)}
        <Toast message={toast} onDone={() => setToast('')} />
      </View>
    )
  }
  if (a.status === 'LISTED') {
    return (
      <View style={[styles.fill, { paddingTop: insets.top }]}>
        {head()}
        <ScrollView contentContainerStyle={styles.body}>{work(a.artist)}{block('sell', 'Esta obra já está à venda', 'Preço, mínimo e negociador ficam na gestão do anúncio.')}</ScrollView>
        {foot(<Button title="Gestão do anúncio" onPress={() => router.replace({ pathname: '/artworks/[id]/listing', params: { id: String(a.artworkId) } })} />)}
      </View>
    )
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.fill, { paddingTop: insets.top }]}>
      {head(step === 0 ? 'Passo 1 de 2' : 'Passo 2 de 2')}
      <View style={styles.headPad}>
        <Segments total={2} current={step + 1} />
        <Display size={24} line={31} style={{ marginTop: 14 }}>{step === 0 ? 'Preço e modalidade' : 'Revise o anúncio'}</Display>
      </View>
      {step === 0 ? (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {work(a.artist + (registered ? ` · registrada por ${brl(registered)}` : ''))}
          <View style={styles.modes}>
            {([['offers', 'Aceitar ofertas', 'Você define um mínimo e negocia', 'swap-horiz'], ['fixed', 'Preço fixo', 'Compra direta, sem negociação', 'sell']] as const).map(([k, n, s, icon]) => (
              <Pressable key={k} accessibilityRole="radio" accessibilityState={{ checked: mode === k }} onPress={() => setMode(k)} style={[styles.mode, mode === k && styles.modeOn]}>
                <Icon name={icon} size={22} /><Text style={styles.modeName}>{n}</Text><Text style={styles.modeSub}>{s}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Preço pedido</Text>
          <View style={styles.money}><Text style={styles.moneyPre}>R$</Text><TextInput value={price} onChangeText={(t) => { setPrice(priceMask(t)); setError(null) }} keyboardType="number-pad" placeholder="0" placeholderTextColor={theme.fgDisabled} style={styles.moneyInput} accessibilityLabel="Preço pedido em reais" /></View>
          {mode === 'offers' ? (<>
            <Text style={styles.label}>Mínimo que você aceita <Text style={styles.hint}>· nunca aparece para o comprador</Text></Text>
            <View style={[styles.money, problems.some((p) => p.includes('mínimo')) && { borderColor: theme.error }]}><Text style={styles.moneyPre}>R$</Text><TextInput value={min} onChangeText={(t) => { setMin(priceMask(t)); setError(null) }} keyboardType="number-pad" placeholder="0" placeholderTextColor={theme.fgDisabled} style={styles.moneyInput} accessibilityLabel="Mínimo que você aceita em reais" /></View>
            <Text style={styles.note}>Ofertas abaixo disso são recusadas sem você ver. O valor fica só com você e com o negociador.</Text>
            <View style={styles.switchRow}>
              <View style={{ flex: 1, gap: 2 }}><Text style={styles.switchName}>Negociador automático</Text><Text style={styles.switchSub}>Responde às propostas por você, dentro do seu mínimo, e nunca revela esse valor.</Text></View>
              <Toggle on={negotiator} onPress={() => setNegotiator(!negotiator)} label="Negociador automático" />
            </View>
            {negotiator ? (
              <View style={styles.pctRow}>
                <Text style={styles.pctLabel}>Aceitar automaticamente acima de</Text>
                <View style={styles.pctBox}><TextInput value={acceptPct} onChangeText={(t) => setAcceptPct(t.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" style={styles.pctInput} accessibilityLabel="Percentual do preço pedido" /><Text style={styles.moneyPre}>%</Text></View>
              </View>
            ) : null}
          </>) : null}
          {problems.length ? <Text style={styles.err} accessibilityRole="alert">{problems.join(' ')}</Text> : null}
          <View style={styles.info}><Icon name="info-outline" size={16} color={theme.fgMuted} /><Text style={styles.infoText}>Mercado secundário: o comprador paga 8 % sobre o preço e 4 % saem da sua parte. O artista recebe 5 % da valorização.</Text></View>
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {work(mode === 'offers' ? `Aceita ofertas${negotiator ? ` · negociador aceita acima de ${bps / 100} %` : ''}` : 'Preço fixo')}
          {!est ? (error ? null : <Loading />) : (
            <View style={styles.lines}>
              <Line k="Preço pedido" v={brl(est.listCents)} bold />
              <Line k="Taxa HouseArt · 4 % do vendedor" v={`− ${brl(est.sellerFeeCents)}`} />
              <Line k={`Direito de sequência · 5 % da valorização${registered ? '' : ' · sem valor registrado'}`} v={`− ${brl(est.royaltyCents)}`} />
              <Line k="Você recebe · estimativa" v={brl(est.netCents)} bold />
              <Line k="O comprador paga · com 8 % da HouseArt" v={brl(est.buyerPaysCents)} />
            </View>
          )}
          <Text style={styles.note}>O comprador paga em garantia. Você recebe quando ele confirmar a entrega com o toque na etiqueta, e a escritura muda de nome no mesmo instante.</Text>
          {registered ? <Text style={styles.note}>O direito de sequência é calculado sobre o valor registrado ({brl(registered)}); o valor final sai do último preço de venda registrado.</Text> : null}
          <ErrorText>{error}</ErrorText>
        </ScrollView>
      )}
      {foot(step === 0
        ? <Button title="Continuar" disabled={!ok} onPress={() => { setError(null); setStep(1) }} />
        : <Button title="Publicar no marketplace" loading={busy} disabled={!est} onPress={() => void publish()} />)}
      <Toast message={toast} onDone={() => setToast('')} />
    </KeyboardAvoidingView>
  )
}

function Line({ k, v, bold }: { k: string; v: string; bold?: boolean }) {
  return <View style={styles.line}><Text style={[styles.lineK, bold && { color: theme.fg, fontWeight: '600' }]}>{k}</Text><Text style={[styles.lineV, bold && { fontWeight: '600' }]}>{v}</Text></View>
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  bar: { height: 48, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, gap: 4 },
  barTitle: { flex: 1, fontSize: 16, fontWeight: '600', color: theme.fg },
  barStep: { fontSize: 12, color: theme.fgMuted, paddingRight: 10 },
  headPad: { paddingHorizontal: 16, paddingBottom: 4 },
  body: { padding: 16, gap: 12, paddingBottom: 24 },
  work: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  workWall: { width: 64, height: 64 },
  muted: { fontSize: 12, lineHeight: 16, color: theme.fgMuted },
  block: { alignItems: 'center', gap: 8, padding: 20, borderRadius: theme.radiusMd, backgroundColor: theme.surface },
  blockIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' },
  blockTitle: { fontSize: 18, fontWeight: '600', color: theme.fg },
  blockLead: { fontSize: 13, lineHeight: 19, color: theme.fgBody, textAlign: 'center' },
  modes: { flexDirection: 'row', gap: 8 },
  mode: { flex: 1, gap: 4, padding: 12, borderRadius: theme.radiusMd, borderWidth: 1, borderColor: theme.border },
  modeOn: { borderColor: theme.fg, backgroundColor: theme.surface },
  modeName: { fontSize: 14, fontWeight: '600', color: theme.fg },
  modeSub: { fontSize: 12, lineHeight: 16, color: theme.fgMuted },
  label: { fontSize: 13, fontWeight: '600', color: theme.fg },
  hint: { fontWeight: '400', color: theme.fgMuted },
  money: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderRadius: theme.radiusSm, borderWidth: 1.5, borderColor: theme.fg },
  moneyPre: { fontSize: 17, color: theme.fgMuted },
  moneyInput: { flex: 1, minWidth: 0, fontSize: 22, fontWeight: '600', color: theme.fg, paddingVertical: 0, fontVariant: ['tabular-nums'] },
  note: { fontSize: 12, lineHeight: 17, color: theme.fgMuted },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  switchName: { fontSize: 14, fontWeight: '600', color: theme.fg },
  switchSub: { fontSize: 12, lineHeight: 16, color: theme.fgMuted },
  pctRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pctLabel: { flex: 1, fontSize: 13, color: theme.fgBody },
  pctBox: { width: 90, height: 44, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, borderRadius: theme.radiusSm, borderWidth: 1, borderColor: theme.fgDisabled },
  pctInput: { flex: 1, fontSize: 16, fontWeight: '600', color: theme.fg, paddingVertical: 0 },
  err: { fontSize: 13, color: theme.error },
  info: { flexDirection: 'row', gap: 6, padding: 10, borderRadius: theme.radiusSm, backgroundColor: colors.paper100 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 17, color: theme.fgMuted },
  lines: { borderTopWidth: 1, borderTopColor: theme.border },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: theme.border },
  lineK: { flex: 1, fontSize: 13, color: theme.fgMuted },
  lineV: { fontSize: 14, color: theme.fg, fontVariant: ['tabular-nums'] },
  foot: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.bg },
})
