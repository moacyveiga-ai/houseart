import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSession } from '@/auth/session'
import { Button, ErrorText, Field, Muted, Title } from '@/ui/primitives'
import { theme } from '@/theme'

export default function CodeLogin() {
  const { startCode, verifyCode } = useSession()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [email, setEmail] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function start() {
    if (busy) return
    setError(null); setBusy(true)
    try { setToken(await startCode(email.trim())) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  async function verify() {
    if (busy || !token) return
    setError(null); setBusy(true)
    try { await verifyCode(token, code) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <Title>Entrar com código</Title>
        {token ? (
          <>
            <Muted>Se este e-mail tiver conta, enviamos um código de 6 dígitos. Digite-o abaixo.</Muted>
            <View style={styles.form}>
              <Field placeholder="Código" keyboardType="number-pad" textContentType="oneTimeCode" maxLength={6} value={code} onChangeText={setCode} onSubmitEditing={verify} />
              <ErrorText>{error}</ErrorText>
              <Button title="Confirmar" onPress={verify} loading={busy} disabled={code.replace(/\D/g, '').length < 4} />
              <Button title="Pedir outro código" variant="ghost" onPress={() => { setToken(null); setCode('') }} />
            </View>
          </>
        ) : (
          <>
            <Muted>Enviamos um código para o seu e-mail; sem senha.</Muted>
            <View style={styles.form}>
              <Field placeholder="E-mail" autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={email} onChangeText={setEmail} onSubmitEditing={start} />
              <ErrorText>{error}</ErrorText>
              <Button title="Enviar código" onPress={start} loading={busy} disabled={!email.includes('@')} />
              <Button title="Voltar" variant="ghost" onPress={() => router.back()} />
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  body: { padding: 24, gap: 8 },
  form: { gap: 12, marginTop: 16 },
})
