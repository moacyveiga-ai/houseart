// Registrar restauro (the web's "Registrar restauro" of the owner panel): the holder of the deed
// writes what was restored, by whom and when; it enters the certificate chain as RESTORED and
// shows in the public provenance. The server decides everything (only the holder, never in a
// sale, stolen or disputed artwork, never a future day); the screen only collects and explains.
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { recordRestoration } from '@/api/collector'
import { theme } from '@/theme'
import { Input, Label } from '@/ui/forms'
import { TopBar } from '@/ui/kit'
import { Button, ErrorText } from '@/ui/primitives'
import { maskDay, restorationDay } from './collector-core'

const MIN = 10
const MAX = 500

export function RestoreScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { id } = useLocalSearchParams<{ id: string }>()
  const artworkId = Number(id)
  const [description, setDescription] = useState('')
  const [restorer, setRestorer] = useState('')
  const [day, setDay] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const short = description.trim().length < MIN

  async function save() {
    if (busy || short) return
    setBusy(true); setError(null)
    try {
      await recordRestoration(artworkId, { description: description.trim(), restorer: restorer.trim(), on: restorationDay(day) })
      router.back()
    } catch (e) { setError((e as Error).message || 'Não foi possível registrar o restauro.') } finally { setBusy(false) }
  }

  return (
    <KeyboardAvoidingView style={[styles.fill, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopBar title="Registrar restauro" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.lead}>O restauro entra na cadeia do certificado e aparece na proveniência pública da obra. Depois de registrado, não pode ser apagado.</Text>
        <View style={{ gap: 6 }}>
          <Label hint={`${description.trim().length}/${MAX}`}>O que foi restaurado</Label>
          <Input value={description} onChangeText={(v) => setDescription(v.slice(0, MAX))} multiline placeholder="Ex.: limpeza da camada pictórica e consolidação de craquelê no canto inferior" style={styles.area} accessibilityLabel="O que foi restaurado" />
        </View>
        <View style={{ gap: 6 }}>
          <Label hint="Opcional">Restaurador ou ateliê</Label>
          <Input value={restorer} onChangeText={(v) => setRestorer(v.slice(0, 120))} placeholder="Nome de quem restaurou" accessibilityLabel="Restaurador ou ateliê" />
        </View>
        <View style={{ gap: 6 }}>
          <Label hint="Opcional">Data do restauro</Label>
          <Input value={day} onChangeText={(v) => setDay(maskDay(v))} placeholder="DD/MM/AAAA" keyboardType="number-pad" accessibilityLabel="Data do restauro" />
        </View>
        <ErrorText>{error}</ErrorText>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <Button title="Registrar restauro" loading={busy} disabled={short} onPress={() => void save()} />
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  body: { padding: 16, gap: 16, paddingBottom: 24 },
  lead: { fontSize: 13, lineHeight: 19, color: theme.fgBody },
  area: { minHeight: 120, textAlignVertical: 'top' },
  footer: { paddingHorizontal: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: theme.border, backgroundColor: theme.bg },
})
