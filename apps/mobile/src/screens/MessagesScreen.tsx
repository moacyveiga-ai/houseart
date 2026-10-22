// Mensagens (handoff "HouseArt App Colecionador" › Mensagens): title, the search
// field "Buscar por pessoa ou obra" (the server filters), the rows with the
// artwork wall + the person's initials, name · when, the artwork title in sand,
// the preview and the unread count. GET /api/messages.
import { useCallback, useEffect, useState } from 'react'
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useApi } from '@/api/hooks'
import type { ConversationRow } from '@/api/types'
import { colors, theme } from '@/theme'
import { Avatar, Display, ErrorState, Icon, Loading, Wall } from '@/ui/kit'
import { avatarTint } from '@/ui/format'

export function MessagesScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => { const t = setTimeout(() => setDebounced(q.trim()), 300); return () => clearTimeout(t) }, [q])
  const { data, error, loading, reload } = useApi<{ items: ConversationRow[] }>(`/api/messages${debounced ? `?q=${encodeURIComponent(debounced)}` : ''}`)
  useFocusEffect(useCallback(() => { void reload() }, [reload]))
  const rows = data?.items ?? []

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <View style={styles.head}>
        <Display size={28} line={36}>Mensagens</Display>
        <View style={styles.search}>
          <Icon name="search" size={20} color={theme.fgMuted} />
          <TextInput value={q} onChangeText={setQ} placeholder="Buscar por pessoa ou obra" placeholderTextColor={theme.fgMuted} style={styles.input} autoCapitalize="none" returnKeyType="search" />
        </View>
      </View>
      {loading && !data ? <Loading /> : error && !data ? <ErrorState message={error} onRetry={reload} /> : (
        <FlatList
          data={rows}
          keyExtractor={(c) => String(c.id)}
          style={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={theme.accent} />}
          renderItem={({ item: c }) => {
            const tint = avatarTint(c.other.name)
            const bold = c.unread > 0
            return (
              <Pressable accessibilityRole="button" onPress={() => router.push(`/messages/${c.id}`)} style={({ pressed }) => [styles.row, bold && { backgroundColor: theme.surface }, pressed && { opacity: 0.7 }]}>
                <View style={styles.pic}>
                  <Wall uri={c.artworkCoverUrl} padding={6} style={styles.picWall} />
                  <View style={styles.picAv}><Avatar initials={c.other.initials} bg={tint.bg} fg={tint.fg} size={22} /></View>
                </View>
                <View style={{ flex: 1, gap: 1 }}>
                  <View style={styles.line}><Text style={[styles.name, bold && { fontWeight: '600' }]} numberOfLines={1}>{c.other.name}</Text><Text style={styles.when}>{c.when}</Text></View>
                  <Display italic size={12} line={16} color={theme.accentStrong}>{c.artworkTitle ?? c.other.sub}</Display>
                  <View style={styles.line}>
                    <Text style={styles.preview} numberOfLines={1}>{c.preview}</Text>
                    {c.unread ? <Text style={styles.badge}>{c.unread}</Text> : null}
                  </View>
                </View>
              </Pressable>
            )
          }}
          ListEmptyComponent={<Text style={styles.empty}>Nenhuma conversa encontrada.</Text>}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  head: { gap: 10, paddingTop: 6, paddingHorizontal: 16, paddingBottom: 12 },
  search: { height: 44, borderRadius: theme.radiusMd, backgroundColor: theme.surface, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 14, color: theme.fg, paddingVertical: 0 },
  list: { borderTopWidth: 1, borderTopColor: theme.border },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.border },
  pic: { width: 52, height: 52 },
  picWall: { width: 52, height: 52 },
  picAv: { position: 'absolute', right: -6, bottom: -6, borderWidth: 2, borderColor: theme.bg, borderRadius: 13 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 14, fontWeight: '500', color: theme.fg },
  when: { fontSize: 11, color: theme.fgMuted },
  preview: { flex: 1, fontSize: 13, lineHeight: 18, color: theme.fgMuted },
  badge: { minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: theme.radiusFull, backgroundColor: theme.fg, color: colors.paper50, fontSize: 10, fontWeight: '600', lineHeight: 18, textAlign: 'center', overflow: 'hidden' },
  empty: { padding: 32, paddingHorizontal: 24, fontSize: 14, color: theme.fgMuted },
})
