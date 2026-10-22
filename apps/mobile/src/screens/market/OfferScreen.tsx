// Fazer oferta (handoff "HouseArt App Colecionador" › sheet `oferta`, drawn as
// the five steps of the web wizard): Valor (sugestões −5/−10/−15 %, a linha
// dos 70 %) · Condições (validade 24/48/72 h, mensagem) · Identidade (CPF,
// celular por SMS, e-mail da conta) · Garantia (cartão da carteira, Pix,
// transferência; CEP de entrega) · Revisão. POST /api/public/offers; the logged
// buyer with a proven e-mail lands on /offer/[code] at once, else the code.
import { useCallback, useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useApi } from '@/api/hooks'
import { confirmOffer, identity as fetchIdentity, listCards, setIdentity, shippingQuote, startOffer, startPhone, verifyPhone, type ShippingQuote } from '@/api/market'
import type { ArtworkPage, GuaranteeMethod, IdentityView, PaymentMethodView } from '@/api/types'
import { useSession } from '@/auth/session'
import { colors, theme } from '@/theme'
import { CardForm } from '@/ui/CardForm'
import { Input, KeyValue, Label, OptionCard, Segments } from '@/ui/forms'
import { Chip, Display, ErrorState, Icon, IconButton, Loading, Toast, Wall } from '@/ui/kit'
import { Button, ErrorText } from '@/ui/primitives'
import { brl } from '@/ui/format'
import {
  GUARANTEES, STEPS, SUGGESTIONS, VALIDITIES, WARNING_LINE, belowWarning, canAdvance, ctaOf, defaultOfferCents, formatCepInput, formatCpfInput, formatPhoneInput,
  reaisText, reviewRows, sellerWord, suggestionCents, suggestionLabel, typedCents, type StepIndex,
} from './offer-core'

export function OfferScreen({ publicId }: { publicId: string }) {
  const insets = useSafeAreaInsets()
  const { data, error, loading, reload } = useApi<ArtworkPage>(`/api/public/artworks/${encodeURIComponent(publicId)}`)
  if (loading && !data) return <View style={[styles.fill, { paddingTop: insets.top }]}><Loading /></View>
  if (!data) return <View style={[styles.fill, { paddingTop: insets.top }]}><ErrorState message={error ?? 'Obra não encontrada.'} onRetry={reload} /></View>
  if (data.status !== 'LISTED' || data.priceCents === null || !data.acceptsOffers) return <View style={[styles.fill, { paddingTop: insets.top }]}><ErrorState message={data.priceCents === null ? 'Esta obra é vendida sob consulta: converse com o vendedor.' : 'Esta obra não está aceitando propostas.'} /></View>
  return <Wizard artwork={data} />
}

function Wizard({ artwork: a }: { artwork: ArtworkPage }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { me } = useSession()
  const price = Number(a.priceCents)
  const [step, setStep] = useState<StepIndex>(1)
  const [offerCents, setOfferCents] = useState(() => defaultOfferCents(price))
  const [amountText, setAmountText] = useState(() => reaisText(defaultOfferCents(price)))
  const [validityHours, setValidity] = useState<24 | 48 | 72>(48)
  const [message, setMessage] = useState('')
  const [identity, setIdentityView] = useState<IdentityView | null>(null)
  const [guarantee, setGuarantee] = useState<GuaranteeMethod>('CARD_HOLD')
  const [cards, setCards] = useState<PaymentMethodView[] | null>(null)
  const [cardId, setCardId] = useState<number | null>(null)
  const [adding, setAdding] = useState(false)
  const [cep, setCep] = useState('')
  const [quote, setQuote] = useState<ShippingQuote | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [otp, setOtp] = useState<{ code: string; value: string } | null>(null)
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])

  useEffect(() => { if (step === 3 && !identity) fetchIdentity().then(setIdentityView).catch(() => setIdentityView({ name: me?.name ?? '', cpfMask: null, phoneMask: null, phoneVerified: false, emailVerified: false, city: '' })) }, [step, identity, me?.name])
  useEffect(() => {
    if (step !== 4 || cards !== null) return
    listCards().then((list) => { setCards(list); setCardId((c) => c ?? (list.find((m) => m.isDefault) ?? list[0])?.id ?? null); if (!list.length) setAdding(true) }).catch(() => setCards([]))
  }, [step, cards])

  const card = cards?.find((m) => m.id === cardId) ?? null
  const identityState = { cpfOk: !!identity?.cpfMask, phoneOk: !!identity?.phoneVerified }
  const blocked = !canAdvance(step, { offerCents, priceCents: price, identity: identityState, guarantee, hasCard: !!card, accepted })
  const commit = (cents: number) => { const v = Math.max(0, Math.min(price, cents)); setOfferCents(v); setAmountText(reaisText(v)) }

  async function changeCep(raw: string) {
    const v = formatCepInput(raw)
    setCep(v)
    if (v.replace(/\D/g, '').length !== 8) { setQuote(null); return }
    try { setQuote(await shippingQuote(a.publicId, v, offerCents)) } catch { setQuote(null) }
  }

  async function send() {
    if (!me || blocked || busy) return
    setBusy(true); setError(null)
    try {
      const r = await startOffer({
        publicId: a.publicId, buyerName: me.name, buyerEmail: me.email, buyerCity: identity?.city || undefined, offeredCents: offerCents, message: message.trim() || undefined,
        validityHours, guaranteeMethod: guarantee, paymentMethodId: guarantee === 'CARD_HOLD' && card ? card.id : undefined, deliveryCep: quote?.cep ?? undefined,
      })
      if (r.confirmed) { router.replace(`/offer/${r.code}`); return }
      setOtp({ code: r.code, value: '' })
    } catch (e) { setError((e as Error).message || 'Não foi possível enviar a oferta.') } finally { setBusy(false) }
  }
  async function confirm() {
    if (!otp || busy) return
    setBusy(true); setError(null)
    try { await confirmOffer(otp.code, otp.value); router.replace(`/offer/${otp.code}`) } catch (e) { setError((e as Error).message || 'Código inválido.') } finally { setBusy(false) }
  }
  const next = () => { if (step === 5) void send(); else if (!blocked) { setError(null); setStep((s) => (s + 1) as StepIndex) } }
  const back = () => { if (step === 1) { if (router.canGoBack()) router.back(); else router.replace(`/artwork/${a.publicId}`) } else { setError(null); setStep((s) => (s - 1) as StepIndex) } }
  const seller = sellerWord(a.seller.kind)

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.fill, { paddingTop: insets.top }]}>
      <View style={styles.head}>
        <View style={styles.headRow}><IconButton name={step === 1 ? 'close' : 'arrow-back'} label={step === 1 ? 'Fechar' : 'Voltar'} onPress={back} /><Text style={styles.stepText}>Passo {step} de {STEPS.length} · {STEPS[step - 1]!.name}</Text></View>
        <Segments total={STEPS.length} current={step} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        <View style={styles.strip}>
          <Wall uri={a.cover} padding={6} style={styles.stripWall} square={false} />
          <View style={{ flex: 1 }}><Display italic size={15} line={20} numberOfLines={1}>{a.title}</Display><Text style={styles.stripSub}>Preço pedido {brl(a.priceCents)} · {a.seller.name}</Text></View>
        </View>

        {step === 1 ? (<>
          <Text style={styles.h1}>Quanto você quer oferecer?</Text>
          <Text style={styles.lead}>{seller.charAt(0).toUpperCase() + seller.slice(1)} responde em até {validityHours} horas. Você só é cobrado se a oferta for aceita.</Text>
          <Label>Sua oferta</Label>
          <View style={styles.amount}><Text style={styles.cur}>R$</Text><Input value={amountText} onChangeText={(v) => { setAmountText(v.replace(/[^\d.]/g, '')); setOfferCents(typedCents(v, price)) }} onBlur={() => commit(offerCents)} inputMode="numeric" accessibilityLabel="Valor da oferta" style={styles.amountInput} /></View>
          <View style={styles.chips}>{SUGGESTIONS.map((p) => <Chip key={p} label={suggestionLabel(price, p)} on={offerCents === suggestionCents(price, p)} onPress={() => commit(suggestionCents(price, p))} />)}</View>
          {belowWarning(offerCents, price) ? <View style={styles.warn}><Icon name="info-outline" size={18} color={colors.pending500} /><Text style={styles.warnText}>{WARNING_LINE}</Text></View> : null}
          {blocked && offerCents > 0 ? <Text style={styles.note}>O valor mínimo para enviar é metade do preço pedido.</Text> : null}
        </>) : null}

        {step === 2 ? (<>
          <Text style={styles.h1}>Condições da oferta</Text>
          <Label>Validade da oferta</Label>
          <View style={styles.chips}>{VALIDITIES.map((v) => <Chip key={v.hours} label={v.name} on={validityHours === v.hours} onPress={() => setValidity(v.hours)} />)}</View>
          <Label hint="opcional">Mensagem para o vendedor</Label>
          <Input value={message} onChangeText={setMessage} multiline maxLength={500} placeholder="Ex.: posso retirar na galeria esta semana" />
          <View style={styles.notes}>
            <View style={styles.noteRow}><Icon name="lock" size={16} /><Text style={styles.noteText}>Nada é cobrado agora. Se o vendedor aceitar, você paga em garantia.</Text></View>
            <View style={styles.noteRow}><Icon name="swap-horiz" size={16} /><Text style={styles.noteText}>O vendedor pode aceitar, recusar ou fazer contraproposta.</Text></View>
          </View>
        </>) : null}

        {step === 3 ? (<>
          <Text style={styles.h1}>Confirme sua identidade</Text>
          <Text style={styles.lead}>Ofertas só são enviadas por compradores verificados. Isso protege você, {seller} e o artista.</Text>
          {identity && me ? <IdentityChecks identity={identity} viewerName={me.name} viewerEmail={me.email} onIdentity={setIdentityView} onToast={setToast} /> : <Loading />}
          <View style={styles.noteRow}><Icon name="shield" size={16} /><Text style={styles.noteText}>Seus dados ficam protegidos conforme a LGPD. {a.seller.kind === 'GALLERY' ? 'A galeria' : 'O vendedor'} vê apenas seu nome e cidade.</Text></View>
        </>) : null}

        {step === 4 ? (<>
          <Text style={styles.h1}>Garantia da oferta</Text>
          <Text style={styles.lead}>Reservamos o valor sem cobrar. Se {seller} recusar ou a oferta expirar, a reserva é desfeita na hora.</Text>
          <View style={{ gap: 8 }}>{GUARANTEES.map((g) => <OptionCard key={g.key} on={guarantee === g.key} icon={g.icon} name={g.name} sub={g.key === 'CARD_HOLD' && card ? `${card.label} · o valor é reservado, não cobrado` : g.sub} onPress={() => setGuarantee(g.key)} />)}</View>
          {guarantee === 'CARD_HOLD' ? (
            cards === null ? <Loading /> : (
              <View style={{ gap: 8 }}>
                {cards.map((m) => <OptionCard key={m.id} on={cardId === m.id} icon="credit-card" name={m.label} sub={`Vence ${m.exp}${m.isDefault ? ' · padrão' : ''}`} onPress={() => setCardId(m.id)} />)}
                {adding ? <CardForm holder={me?.name ?? ''} firstCard={cards.length === 0} onSaved={(m) => { setCards((cs) => [...(cs ?? []).map((c) => (m.isDefault ? { ...c, isDefault: false } : c)), m]); setCardId(m.id); setAdding(false); setToast(`${m.label} salvo na carteira`) }} onCancel={cards.length ? () => setAdding(false) : undefined} />
                  : <Pressable accessibilityRole="button" onPress={() => setAdding(true)} style={styles.addCard}><Icon name="add-card" size={20} /><Text style={styles.addCardText}>Adicionar cartão</Text></Pressable>}
                {!cards.length && !adding ? <Text style={styles.note}>Nenhum cartão guardado. Adicione um para reservar o valor — nada é cobrado agora.</Text> : null}
              </View>
            )
          ) : null}
          <Label hint="opcional">CEP de entrega</Label>
          <Input value={cep} onChangeText={(v) => void changeCep(v)} inputMode="numeric" placeholder="00000-000" />
          <Text style={styles.note}>{quote ? `Frete ${brl(quote.shippingCents)} · seguro ${brl(quote.insuranceCents)}` : 'Frete especializado e seguro são calculados pelo CEP.'}</Text>
          <View style={styles.noteRow}><Icon name="lock" size={16} /><Text style={styles.noteText}>Se aceita, o pagamento fica em garantia e só é liberado {a.seller.kind === 'GALLERY' ? 'à galeria' : 'ao vendedor'} depois que você confirmar o recebimento pela etiqueta da obra.</Text></View>
        </>) : null}

        {step === 5 ? (<>
          <Text style={styles.h1}>Revise e envie</Text>
          <View>{reviewRows({ offerCents, validityHours, message, guarantee, cardLabel: card?.label ?? null, cepLabel: quote ? `CEP ${cep} · frete ${brl(quote.shippingCents)} + seguro ${brl(quote.insuranceCents)}` : null }).map((r) => <KeyValue key={r.key} k={r.key} v={r.value} onEdit={otp ? undefined : () => setStep(r.step)} />)}</View>
          {otp ? (
            <View style={styles.otp}>
              <Text style={styles.cardTitle}>Confirme pelo código do e-mail</Text>
              <Text style={styles.note}>Enviamos um código de 6 dígitos para {me?.email}. A oferta {otp.code} só é registrada depois dele.</Text>
              <Input value={otp.value} onChangeText={(v) => setOtp({ ...otp, value: v.replace(/\D/g, '').slice(0, 6) })} inputMode="numeric" maxLength={6} placeholder="000000" />
              <Button title="Confirmar oferta" loading={busy} disabled={otp.value.length < 6} onPress={() => void confirm()} />
            </View>
          ) : (
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} onPress={() => setAccepted((v) => !v)} style={styles.accept}>
              <Icon name={accepted ? 'check-box' : 'check-box-outline-blank'} size={22} />
              <Text style={styles.acceptText}>Entendo que esta oferta é vinculante: se {seller} aceitar dentro da validade, a compra é concluída automaticamente com o método de garantia escolhido.</Text>
            </Pressable>
          )}
        </>) : null}
        <ErrorText>{error}</ErrorText>
      </ScrollView>
      {otp ? null : (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          <Button title={ctaOf(step, offerCents)} loading={busy} disabled={blocked} onPress={next} />
        </View>
      )}
      <Toast message={toast} onDone={clearToast} />
    </KeyboardAvoidingView>
  )
}

/** Step 3: CPF e dados pessoais · Celular (SMS) · E-mail (the account). */
function IdentityChecks({ identity, viewerName, viewerEmail, onIdentity, onToast }: { identity: IdentityView; viewerName: string; viewerEmail: string; onIdentity: (i: IdentityView) => void; onToast: (t: string) => void }) {
  const [cpf, setCpf] = useState('')
  const [city, setCity] = useState(identity.city)
  const [cpfOpen, setCpfOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [sms, setSms] = useState<{ token: string; mask: string; echo?: string } | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const cpfOk = !!identity.cpfMask, phoneOk = identity.phoneVerified, emailOk = identity.emailVerified

  async function saveCpf() {
    setBusy(true); setErr(null)
    try { onIdentity(await setIdentity({ cpf: cpf.replace(/\D/g, ''), city: city || undefined })); setCpfOpen(false); onToast('CPF confirmado') } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  async function sendSms() {
    setBusy(true); setErr(null)
    try { const r = await startPhone(phone); setSms({ token: r.token, mask: r.phoneMask, echo: r.echo }) } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  async function confirmSms() {
    if (!sms) return
    setBusy(true); setErr(null)
    try { await verifyPhone(sms.token, code); onIdentity(await fetchIdentity()); setPhoneOpen(false); setSms(null); onToast('Celular confirmado') } catch (e) { setErr((e as Error).message) } finally { setBusy(false) }
  }
  const Item = ({ ok, icon, name, sub, open, onOpen, children }: { ok: boolean; icon: 'badge' | 'smartphone' | 'mail'; name: string; sub: string; open?: boolean; onOpen?: () => void; children?: React.ReactNode }) => (
    <View style={[styles.item, ok && styles.itemOk]}>
      <View style={styles.itemRow}>
        <Icon name={ok ? 'check' : icon} size={22} color={ok ? theme.success : theme.fg} />
        <View style={{ flex: 1 }}><Text style={styles.cardTitle}>{name}</Text><Text style={styles.note}>{sub}</Text></View>
        {ok ? <Text style={styles.verified}>Verificado</Text> : onOpen && !open ? <Pressable accessibilityRole="button" onPress={onOpen} style={styles.inkBtn}><Text style={styles.inkBtnText}>Confirmar</Text></Pressable> : null}
      </View>
      {!ok && open ? children : null}
    </View>
  )
  return (
    <View style={{ gap: 8 }}>
      <Item ok={cpfOk} icon="badge" name="CPF e dados pessoais" sub={cpfOk ? `${identity.name || viewerName} · ${identity.cpfMask}` : `${viewerName} · informe o CPF do titular da oferta`} open={cpfOpen} onOpen={() => setCpfOpen(true)}>
        <Label>CPF</Label><Input value={cpf} onChangeText={(v) => setCpf(formatCpfInput(v))} inputMode="numeric" placeholder="000.000.000-00" />
        <Label>Cidade/UF</Label><Input value={city} onChangeText={setCity} placeholder="Salvador/BA" />
        <Button title="Confirmar" loading={busy} disabled={cpf.replace(/\D/g, '').length !== 11} onPress={() => void saveCpf()} />
      </Item>
      <Item ok={phoneOk} icon="smartphone" name={phoneOk ? 'Celular confirmado' : 'Celular'} sub={phoneOk ? `Confirmado por SMS em ${identity.phoneMask}` : sms ? `Código enviado por SMS para ${sms.mask}` : 'Enviamos um código por SMS para confirmar o número'} open={phoneOpen} onOpen={() => setPhoneOpen(true)}>
        {sms ? (<>
          <Label>Código do SMS</Label><Input value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" maxLength={6} />
          {sms.echo ? <Text style={styles.note}>Ambiente de teste · código {sms.echo}</Text> : null}
          <Button title="Confirmar" loading={busy} disabled={code.length < 6} onPress={() => void confirmSms()} />
          <Button title="Trocar número" variant="ghost" onPress={() => { setSms(null); setCode('') }} />
        </>) : (<>
          <Label>Celular com DDD</Label><Input value={phone} onChangeText={(v) => setPhone(formatPhoneInput(v))} inputMode="tel" placeholder="(71) 99999-0000" />
          <Button title="Enviar código" loading={busy} disabled={phone.replace(/\D/g, '').length < 10} onPress={() => void sendSms()} />
        </>)}
      </Item>
      <Item ok={emailOk} icon="mail" name={emailOk ? 'E-mail confirmado' : 'E-mail'} sub={emailOk ? `${viewerEmail} · confirmado pela sua conta` : `Código de 6 dígitos enviado para ${viewerEmail} no envio da oferta`} />
      <ErrorText>{err}</ErrorText>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  head: { paddingHorizontal: 16, paddingBottom: 10, gap: 8 },
  headRow: { flexDirection: 'row', alignItems: 'center', marginLeft: -10 },
  stepText: { fontSize: 13, fontWeight: '600', color: theme.fgMuted },
  body: { padding: 16, paddingTop: 4, gap: 12, paddingBottom: 32 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  stripWall: { width: 56, height: 56, borderRadius: theme.radiusSm },
  stripSub: { fontSize: 12, color: theme.fgMuted },
  h1: { fontSize: 22, lineHeight: 28, fontWeight: '600', color: theme.fg },
  lead: { fontSize: 14, lineHeight: 20, color: theme.fgMuted },
  amount: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: theme.fgDisabled, borderRadius: theme.radiusSm, paddingLeft: 12 },
  cur: { fontSize: 18, fontWeight: '600', color: theme.fgMuted },
  amountInput: { flex: 1, borderWidth: 0, fontSize: 26, fontWeight: '600', paddingLeft: 0, fontVariant: ['tabular-nums'] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  warn: { flexDirection: 'row', gap: 8, padding: 10, borderRadius: theme.radiusMd, backgroundColor: colors.pending100 },
  warnText: { flex: 1, fontSize: 13, lineHeight: 18, color: theme.fg },
  notes: { gap: 6, paddingTop: 4 },
  noteRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17, color: theme.fgMuted },
  note: { fontSize: 12, lineHeight: 17, color: theme.fgMuted },
  addCard: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: theme.radiusMd, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.fgDisabled },
  addCardText: { fontSize: 14, fontWeight: '600', color: theme.fg },
  item: { gap: 8, padding: 12, borderRadius: theme.radiusMd, borderWidth: 1, borderColor: theme.border },
  itemOk: { backgroundColor: colors.verified100, borderColor: colors.verified100 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: theme.fg },
  verified: { fontSize: 12, fontWeight: '600', color: theme.success },
  inkBtn: { height: 34, paddingHorizontal: 12, borderRadius: theme.radiusMd, backgroundColor: theme.fg, alignItems: 'center', justifyContent: 'center' },
  inkBtnText: { fontSize: 13, fontWeight: '600', color: theme.bg },
  otp: { gap: 8, padding: 12, borderRadius: theme.radiusMd, backgroundColor: theme.surface },
  accept: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  acceptText: { flex: 1, fontSize: 13, lineHeight: 18, color: theme.fgBody },
  footer: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.bg },
})
