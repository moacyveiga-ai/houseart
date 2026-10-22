// The native "Perfil": who is signed in, push toggle (prepared), the native
// shortcuts every profile shares (Compras, Carteira e cartões, Pix para receber
// vendas, Verificar obra), the web account page, profile switch and sign out. Tab for the collector, pushed
// screen (/settings) for the others.
import { Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { API_URL, PUSH_API_READY } from '@/config'
import { useSession } from '@/auth/session'
import { usePushToggle } from '@/push/usePushToggle'
import { Button, Muted, Row } from '@/ui/primitives'
import { theme } from '@/theme'

const PROFILE_NAMES: Record<string, string> = {
  COLLECTOR: 'Colecionador', GALLERY: 'Galeria', ARTIST: 'Artista', ADVISOR: 'Consultor de arte', APPRAISER: 'Avaliador', STAFF: 'Equipe HouseArt',
}

export function ProfileScreen() {
  const { me, profiles, signOut } = useSession()
  const router = useRouter()
  const push = usePushToggle()

  function confirmSignOut() {
    Alert.alert('Sair', 'Encerrar a sessão neste aparelho?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: () => void signOut() },
    ])
  }

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.body}>
      <View style={styles.block}>
        <Row label="Nome" value={me?.name ?? '—'} />
        <Row label="E-mail" value={me?.email ?? '—'} />
        <Row label="Perfil" value={me?.activeProfileKind ? (PROFILE_NAMES[me.activeProfileKind] ?? me.activeProfileKind) : '—'} />
      </View>

      <View style={styles.block}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={styles.toggleLabel}>Avisos no celular</Text>
            <Muted>{PUSH_API_READY ? 'Receba ofertas, mensagens e certificados por notificação.' : 'Em breve.'}</Muted>
          </View>
          <Switch value={push.on} onValueChange={(v) => void push.toggle(v)} disabled={push.busy || !PUSH_API_READY} trackColor={{ true: theme.accent, false: theme.border }} />
        </View>
      </View>

      <View style={styles.actions}>
        <Button title="Compras" variant="ghost" onPress={() => router.push('/purchases' as never)} />
        <Button title="Carteira e cartões" variant="ghost" onPress={() => router.push('/wallet/cards' as never)} />
        <Button title="Pix para receber vendas" variant="ghost" onPress={() => router.push('/sales/payout' as never)} />
        <Button title="Verificar obra" variant="ghost" onPress={() => router.push('/verify' as never)} />
        <Button title="Minha conta (site)" variant="ghost" onPress={() => router.push('/account-web')} />
        {profiles.length > 1 ? <Button title="Trocar de perfil" variant="ghost" onPress={() => router.push('/profiles')} /> : null}
        <Button title="Sair" variant="danger" onPress={confirmSignOut} />
      </View>
      <Muted>Servidor: {API_URL}</Muted>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  body: { padding: 24, gap: 24 },
  block: { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, borderRadius: theme.radiusMd, paddingHorizontal: 16 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  toggleText: { flex: 1, gap: 2 },
  toggleLabel: { fontSize: 16, color: theme.fg, fontWeight: '500' },
  actions: { gap: 12 },
})
