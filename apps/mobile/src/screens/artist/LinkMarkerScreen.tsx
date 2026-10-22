// Vincular etiqueta (handoff "HouseArt App Artista" › leitor, LT.vincular):
// the dark reader — back · "Vincular etiqueta" · the ring (sand while
// reading, green once linked or signed) · the title and text of the phase ·
// "Assinar certificado digitalmente" → "Certificado assinado".
//
// No native NFC in this build (see src/nfc/reader.ts): the person pastes the
// URL the tag carries — the same field of the web `/certification/link/[id]`
// — and, when the server says this environment takes it (MARKER_VENDOR=mock
// outside production), "Simular leitura" posts a simulated tap by UID. The
// server decides everything (POST /api/markers/link); the app shows its
// error text, never an invented one.
import { useCallback, useState } from 'react'
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, Vibration, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useApi } from '@/api/hooks'
import { linkMarker, signCertificate, type LinkHead } from '@/api/artist'
import { colors } from '@/theme'
import { Icon, IconButton, Toast } from '@/ui/kit'
import { tagReader } from '@/nfc/reader'
import { linkTexts, parsePastedMarker, type LinkPhase } from './artist-core'

export function LinkMarkerScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { artworkId: raw } = useLocalSearchParams<{ artworkId: string }>()
  const artworkId = raw && /^\d+$/.test(raw) ? Number(raw) : 0
  const { data: head, error: headError, loading } = useApi<LinkHead>(artworkId ? `/api/artist/artworks/${artworkId}/link` : null)
  const reader = tagReader()

  const [override, setOverride] = useState<{ phase: LinkPhase; publicId: string | null; certificateId: number | null; error: string | null } | null>(null)
  const [pasted, setPasted] = useState('')
  const [pasteError, setPasteError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')

  // The phase comes from the server head until the person acts on this screen.
  const base: { phase: LinkPhase; publicId: string | null; certificateId: number | null; error: string | null } = head
    ? { phase: head.signed ? 'signed' : head.artwork.publicId ? 'linked' : 'reading', publicId: head.artwork.publicId, certificateId: head.certificateId, error: null }
    : { phase: 'reading', publicId: null, certificateId: null, error: null }
  const st = override ?? base
  const title = head?.artwork.title ?? ''
  const texts = linkTexts(st.phase, title, st.publicId, st.error)
  const notInCertification = head && head.artwork.status !== 'IN_CERTIFICATION' && !head.signed
  const ok = st.phase === 'linked' || st.phase === 'signing' || st.phase === 'signed'

  const post = useCallback(async (body: Parameters<typeof linkMarker>[0]) => {
    if (busy) return
    setBusy(true); setPasteError(null)
    try {
      const r = await linkMarker(body)
      Vibration.vibrate(60)
      setOverride({ phase: 'linked', publicId: r.publicId, certificateId: r.certificateId ?? null, error: null })
    } catch (e) {
      setOverride({ phase: 'error', publicId: null, certificateId: null, error: (e as Error).message || 'Leitura inválida. Tente de novo.' })
    } finally { setBusy(false) }
  }, [busy])

  function submitPasted() {
    const p = parsePastedMarker(pasted)
    const sim = !!head?.simulateAllowed
    if (!p) { setPasteError('Cole a URL gravada na etiqueta (com uid, ctr e cmac)' + (sim ? ' ou o UID de 14 caracteres.' : '.')); return }
    if (p.kind === 'sun') void post({ ...p.read, artworkId })
    else if (sim) void post({ uid: p.uid, artworkId, simulate: true })
    else setPasteError('Só o UID não basta: a leitura precisa da URL completa da etiqueta (uid, ctr e cmac).')
  }

  /** Dev only (the server decides): a simulated tap by the UID of a tag of the kit. */
  function simulate() {
    const p = parsePastedMarker(pasted)
    if (p?.kind === 'uid') { void post({ uid: p.uid, artworkId, simulate: true }); return }
    setPasteError('Para simular, digite o UID da etiqueta do seu kit (14 caracteres).')
  }

  async function sign() {
    if (!st.certificateId || st.phase !== 'linked' || busy) return
    setBusy(true)
    setOverride({ ...st, phase: 'signing', error: null })
    try {
      await signCertificate(st.certificateId)
      setOverride({ ...st, phase: 'signed', error: null })
      setToast(`${title} · certificado assinado`)
    } catch (e) {
      setOverride({ ...st, phase: 'linked', error: (e as Error).message || 'Não foi possível assinar.' })
    } finally { setBusy(false) }
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/certification' as never))

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.dark, { paddingTop: insets.top }]}>
      <View style={styles.top}>
        <IconButton name="arrow-back" label="Voltar" color={colors.paper50} size={26} onPress={back} />
        <Text style={styles.topTitle}>Vincular etiqueta</Text>
        <View style={{ width: 44 }} />
      </View>
      {loading && !head ? <View style={styles.center}><ActivityIndicator color={colors.sand500} /></View> : headError && !head ? (
        <View style={styles.center}><Text style={styles.text}>{headError}</Text></View>
      ) : notInCertification ? (
        <View style={styles.center}>
          <Icon name="info" size={40} color={colors.ink300} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.text}>{head?.artwork.status === 'DRAFT' ? 'Esta obra ainda não foi enviada para certificação — termine o cadastro e envie.' : 'Esta obra não está em certificação.'}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]} keyboardShouldPersistTaps="handled">
          <View style={styles.ringWrap}>
            <View style={[styles.ring, { borderColor: ok ? colors.verified500 : st.phase === 'error' ? colors.alert500 : colors.sand500 }]}>
              <View style={[styles.core, { backgroundColor: ok ? colors.verified500 : st.phase === 'error' ? colors.alert500 : colors.sand500 }]}>
                {busy && st.phase !== 'signing' ? <ActivityIndicator color={colors.ink900} /> : (
                  <Icon name={st.phase === 'signed' ? 'description' : ok ? 'check' : st.phase === 'error' ? 'link-off' : 'contactless'} size={44} color={ok || st.phase === 'error' ? colors.paper50 : colors.ink900} />
                )}
              </View>
            </View>
          </View>
          <View style={styles.texts} accessibilityLiveRegion="polite">
            <Text style={styles.title}>{texts.title}</Text>
            <Text style={styles.text}>{texts.text}</Text>
            {st.phase === 'linked' && st.error ? <Text style={styles.err}>{st.error}</Text> : null}
          </View>

          {st.phase === 'reading' || st.phase === 'error' ? (
            <View style={styles.alt}>
              {!reader.canScan ? <Text style={styles.altNote}>Este aparelho ainda não lê a etiqueta pelo app. Encoste o celular no verso: ele abre a URL da etiqueta no navegador. Copie a URL e cole aqui.</Text> : null}
              <TextInput value={pasted} onChangeText={(t) => { setPasted(t); setPasteError(null) }} placeholder="https://…?uid=…&ctr=…&cmac=…" placeholderTextColor={colors.ink500} autoCapitalize="none" autoCorrect={false} style={styles.input} accessibilityLabel="URL da etiqueta" />
              {pasteError ? <Text style={styles.err} accessibilityRole="alert">{pasteError}</Text> : null}
              <Pressable accessibilityRole="button" onPress={submitPasted} disabled={busy || !pasted.trim()} style={[styles.cta, (busy || !pasted.trim()) && { opacity: 0.5 }]}><Text style={styles.ctaText}>Vincular</Text></Pressable>
              {head?.simulateAllowed ? (
                <Pressable accessibilityRole="button" onPress={simulate} disabled={busy} style={styles.ghost}>
                  <Icon name="contactless" size={18} color={colors.paper50} /><Text style={styles.ghostText}>Simular leitura</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {st.phase === 'linked' || st.phase === 'signing' ? (
            <>
              <Text style={styles.decl}>Ao assinar, você declara ser a autora desta obra. O certificado recebe carimbo do tempo e não pode ser alterado; mudanças futuras viram novos eventos na cadeia de titularidade.</Text>
              <Pressable accessibilityRole="button" onPress={() => void sign()} disabled={st.phase === 'signing' || !st.certificateId} style={[styles.cta, (st.phase === 'signing' || !st.certificateId) && { opacity: 0.6 }]}>
                <Text style={styles.ctaText}>{st.phase === 'signing' ? 'Assinando…' : st.certificateId ? 'Assinar certificado digitalmente' : 'Preparando o certificado…'}</Text>
              </Pressable>
            </>
          ) : null}

          {st.phase === 'signed' ? (
            <Pressable accessibilityRole="button" onPress={() => router.navigate('/(tabs)/certification' as never)} style={styles.cta}><Text style={styles.ctaText}>Voltar à certificação</Text></Pressable>
          ) : null}
        </ScrollView>
      )}
      <Toast message={toast} onDone={() => setToast('')} />
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
  text: { fontSize: 14, color: colors.ink300, textAlign: 'center' },
  err: { fontSize: 13, color: colors.sand100, textAlign: 'center' },
  alt: { gap: 10 },
  altNote: { fontSize: 13, color: colors.ink300 },
  input: { minHeight: 46, borderWidth: 1, borderColor: colors.ink500, borderRadius: 4, paddingHorizontal: 12, color: colors.paper50, fontSize: 14 },
  cta: { height: 52, borderRadius: 8, backgroundColor: colors.sand500, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 15, fontWeight: '600', color: colors.ink900 },
  ghost: { flexDirection: 'row', alignSelf: 'center', alignItems: 'center', gap: 8, paddingVertical: 10 },
  ghostText: { fontSize: 14, fontWeight: '600', color: colors.paper50 },
  decl: { fontSize: 12, color: colors.ink300, textAlign: 'center' },
})
