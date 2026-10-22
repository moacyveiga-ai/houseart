import { useState } from 'react'
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native'
import { Link } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSession } from '@/auth/session'
import { Button, ErrorText, Field, Muted, Title } from '@/ui/primitives'
import { theme } from '@/theme'

export default function Login() {
  const { signInWithPassword } = useSession()
  const insets = useSafeAreaInsets()
  const [credential, setCredential] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (busy) return
    setError(null)
    setBusy(true)
    try { await signInWithPassword(credential.trim(), password) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.body, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
        <Image source={require('../../assets/icon.png')} style={styles.logo} accessibilityLabel="HouseArt" />
        <Title>Entrar</Title>
        <Muted>Use o e-mail e a senha da sua conta HouseArt.</Muted>
        <View style={styles.form}>
          <Field placeholder="E-mail" autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="username" value={credential} onChangeText={setCredential} />
          <Field placeholder="Senha" secureTextEntry autoComplete="password" textContentType="password" value={password} onChangeText={setPassword} onSubmitEditing={submit} />
          <ErrorText>{error}</ErrorText>
          <Button title="Entrar" onPress={submit} loading={busy} disabled={!credential || !password} />
          <Link href="/(auth)/code" asChild><Button title="Entrar com código por e-mail" variant="ghost" /></Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  body: { padding: 24, gap: 8 },
  logo: { width: 72, height: 72, borderRadius: 16, marginBottom: 16 },
  form: { gap: 12, marginTop: 16 },
})
