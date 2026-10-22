// Confirmar recebimento (handoff "HouseArt App Colecionador" › compra, etapa
// "Entrega · toque na etiqueta"): the dark reader of "Vincular etiqueta" —
// back · the ring (sand while reading, green once confirmed) · the title and
// text of the phase · "Ver na coleção". The tap confirms the possession: the
// server releases the payment and moves the deed to the buyer in one go.
//
// No native NFC in this build (src/nfc/reader.ts is the point of extension,
// the same one of "Vincular etiqueta"): the person pastes the URL the tag
// opens; when the server says this environment takes it (`simulateAllowed`:
// MARKER_VENDOR=mock outside production) "Simular leitura" posts the tap with
// no read. POST /api/deals/[id]/confirm-delivery decides; the app shows its error.
import { useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, Vibration, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useApi } from '@/api/hooks'
import { confirmDelivery, type Purchases } from '@/api/collector'
import { colors } from '@/theme'
import { Icon, IconButton } from '@/ui/kit'
import { tagReader } from '@/nfc/reader'
import { buyerAction, parseDeliveryRead } from './collector-core'

type Phase = 'reading' | 'done' | 'error'

export function ReceiveScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()
  const dealId = Number(id)
  const { data, error: headError, loading } = useApi<Purchases & { ok: boolean }>('/api/collector/purchases')
  const d = data?.deals.find((x) => x.id === dealId) ?? null
  const reader = tagReader()
  const [phase, setPhase] = useState<Phase | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pasted, setPasted] = useState('')
  const [pasteError, setPasteError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const current: Phase = phase ?? (d && buyerAction(d) === 'done' ? 'done' : 'reading')
  const notNow = d && !phase && buyerAction(d) !== 'receive' && buyerAction(d) !== 'done'

  async function post(sun: { uid: string; ctr: number; cmac: string } | null) {
    if (busy || !d) return
    setBusy(true); setPasteError(null)
    try { await confirmDelivery(d.id, sun); Vibration.vibrate(60); setPhase('done') }
    catch (e) { setError((e as Error).message || 'Leitura inválida. Tente de novo.'); setPhase('error') }
    finally { setBusy(false) }
  }
  function submitPasted() {
    const sun = parseDeliveryRead(pasted)
    if (!sun) { setPasteError('Cole a URL que a etiqueta abriu (com uid, ctr e cmac).'); return }
    void post(sun)
  }

  const ok = current === 'done'
  const texts = ok
    ? { title: 'A obra é sua', text: 'Leitura válida · posse confirmada. A escritura está no seu nome e o pagamento foi liberado ao vendedor.' }
    : current === 'error'
      ? { title: 'Não deu para confirmar', text: error ?? 'Tente de novo.' }
      : { title: 'Encoste o celular no verso da obra', text: 'Bem no centro da etiqueta, até vibrar' }
  const back = () => (router.canGoBack() ? router.back() : router.replace('/purchases' as never))

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.dark, { paddingTop: insets.top }]}>
      <View style={styles.top}>
        <IconButton name="arrow-back" label="Voltar" color={colors.paper50} size={26} onPress={back} />
        <Text style={styles.topTitle}>Confirmar recebimento</Text>
        <View style={{ width: 44 }} />
      </View>
      {loading && !data ? <View style={styles.center}><ActivityIndicator color={colors.sand500} /></View> : headError && !data ? (
        <View style={styles.center}><Text style={styles.text}>{headError}</Text></View>
      ) : !d ? (
        <View style={styles.center}><Text style={styles.text}>Compra não encontrada.</Text></View>
      ) : notNow ? (
        <View style={styles.center}>
          <Icon name="info" size={40} color={colors.ink300} />
          <Text style={styles.title}>{d.artworkTitle}</Text>
          <Text style={styles.text}>A entrega é confirmada depois que o vendedor registra o envio.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]} keyboardShouldPersistTaps="handled">
          <View style={styles.ringWrap}>
            <View style={[styles.ring, { borderColor: ok ? colors.verified500 : current === 'error' ? colors.alert500 : colors.sand500 }]}>
              <View style={[styles.core, { backgroundColor: ok ? colors.verified500 : current === 'error' ? colors.alert500 : colors.sand500 }]}>
                {busy ? <ActivityIndicator color={colors.ink900} /> : <Icon name={ok ? 'check' : current === 'error' ? 'error-outline' : 'contactless'} size={44} color={ok || current === 'error' ? colors.paper50 : colors.ink900} />}
              </View>
            </View>
          </View>
          <View style={styles.texts} accessibilityLiveRegion="polite">
            <Text style={styles.title}>{texts.title}</Text>
            <Text style={styles.text}>{texts.text}</Text>
            <Text style={styles.small}>{d.artworkTitle} · {d.code}</Text>
          </View>

          {!ok ? (
            <View style={styles.alt}>
              {!reader.canScan ? <Text style={styles.altNote}>Este aparelho ainda não lê a etiqueta pelo app. Encoste o celular no verso: ele abre a URL da etiqueta no navegador. Copie a URL e cole aqui.</Text> : null}
              <TextInput value={pasted} onChangeText={(t) => { setPasted(t); setPasteError(null) }} placeholder="https://…?uid=…&ctr=…&cmac=…" placeholderTextColor={colors.ink500} autoCapitalize="none" autoCorrect={false} style={styles.input} accessibilityLabel="URL da etiqueta" />
              {pasteError ? <Text style={styles.err} accessibilityRole="alert">{pasteError}</Text> : null}
              <Pressable accessibilityRole="button" onPress={submitPasted} disabled={busy || !pasted.trim()} style={[styles.cta, (busy || !pasted.trim()) && { opacity: 0.5 }]}><Text style={styles.ctaText}>Confirmar recebimento</Text></Pressable>
              {data?.simulateAllowed ? (
                <Pressable accessibilityRole="button" onPress={() => void post(null)} disabled={busy} style={styles.ghost}>
                  <Icon name="contactless" size={18} color={colors.paper50} /><Text style={styles.ghostText}>Simular leitura</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => router.navigate('/(tabs)/wallet' as never)} style={styles.cta}><Text style={styles.ctaText}>Ver na coleção</Text></Pressable>
          )}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  dark: { flex: 1, backgroundColor: colors.ink900 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 6 },
  topTitle: { fontSize: 14, fontWeight: '600', color: colors.paper50 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  body: { paddingHorizontal: 24, paddingTop: 24, gap: 24, alignItems: 'stretch' },
  ringWrap: { alignItems: 'center', paddingVertical: 16 },
  ring: { width: 160, height: 160, borderRadius: 80, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  core: { width: 92, height: 92, borderRadius: 46, alignItems: 'center', justifyContent: 'center' },
  texts: { alignItems: 'center', gap: 8 },
  title: { fontSize: 24, lineHeight: 30, color: colors.paper50, textAlign: 'center', fontWeight: '600' },
  text: { fontSize: 14, lineHeight: 20, color: colors.ink300, textAlign: 'center' },
  small: { fontSize: 12, color: colors.ink500, textAlign: 'center' },
  err: { fontSize: 13, color: colors.sand100, textAlign: 'center' },
  alt: { gap: 10 },
  altNote: { fontSize: 13, lineHeight: 18, color: colors.ink300 },
  input: { minHeight: 46, borderWidth: 1, borderColor: colors.ink500, borderRadius: 4, paddingHorizontal: 12, color: colors.paper50, fontSize: 14 },
  cta: { height: 52, borderRadius: 8, backgroundColor: colors.sand500, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 15, fontWeight: '600', color: colors.ink900 },
  ghost: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 8, paddingVertical: 10 },
  ghostText: { fontSize: 14, fontWeight: '600', color: colors.paper50 },
})
