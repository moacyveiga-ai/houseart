import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSession } from '@/auth/session'
import type { ProfileKind } from '@/auth/types'
import { Button, ErrorText, Muted } from '@/ui/primitives'
import { theme } from '@/theme'

/** "Escolha de perfil": the account has several profiles; the tabs follow the chosen one. */
export default function Profiles() {
  const { me, profiles, switchProfile, signOut } = useSession()
  const router = useRouter()
  const [busy, setBusy] = useState<ProfileKind | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function pick(kind: ProfileKind) {
    if (busy) return
    setError(null); setBusy(kind)
    try { await switchProfile(kind); router.replace('/(tabs)') } catch (e) { setError((e as Error).message) } finally { setBusy(null) }
  }

  return (
    <ScrollView style={styles.fill} contentContainerStyle={styles.body}>
      <Muted>Como você quer usar o HouseArt agora?</Muted>
      {profiles.map((p) => {
        const on = me?.activeProfileKind === p.kind
        return (
          <Pressable key={p.kind} accessibilityRole="button" onPress={() => pick(p.kind)} style={({ pressed }) => [styles.card, on && styles.cardOn, pressed && styles.pressed]}>
            <Text style={styles.cardTitle}>{p.name}</Text>
            <Text style={styles.cardDesc}>{p.description}</Text>
            {busy === p.kind ? <Text style={styles.cardDesc}>Abrindo…</Text> : null}
          </Pressable>
        )
      })}
      <ErrorText>{error}</ErrorText>
      <View style={styles.foot}><Button title="Sair" variant="ghost" onPress={() => void signOut()} /></View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  body: { padding: 24, gap: 12 },
  card: { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, borderRadius: theme.radiusMd, padding: 16, gap: 4 },
  cardOn: { borderColor: theme.accent },
  pressed: { opacity: 0.8 },
  cardTitle: { fontSize: 18, fontWeight: '600', color: theme.fg },
  cardDesc: { fontSize: 14, color: theme.fgMuted, lineHeight: 20 },
  foot: { marginTop: 24 },
})
