// Início do artista (handoff "HouseArt App Artista" › Início): date and
// "Olá, <nome>" with the initials, the dark "Nova obra · Câmera guiada"
// button, "Próximas ações", "Suas obras" in a 2-column grid with the status
// line, and the four numbers of the web home under them.
// Data: GET /api/artist/home (the same `lib/dashboard` of the web Início).
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useApi, useReloadOnFocus } from '@/api/hooks'
import type { ArtistHome } from '@/api/artist'
import { colors, theme } from '@/theme'
import { Display, ErrorState, Icon, IconButton, Loading, Wall } from '@/ui/kit'
import { actionTarget, helloOf, iconOf, workStatus } from './artist-core'

export function ArtistHomeScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { data, error, loading, reload } = useApi<{ ok: boolean; home: ArtistHome }>('/api/artist/home')
  useReloadOnFocus(reload)
  const h = data?.home

  const goAction = (href: string) => {
    const t = actionTarget(href)
    if (t.kind === 'web') { router.push({ pathname: '/web', params: { path: t.path, title: t.title } }); return }
    router.navigate({ pathname: `/${t.tab}`, params: t.filter ? { filter: t.filter } : {} } as never)
  }
  const openWork = (w: ArtistHome['recent'][number]) => {
    if (w.status === 'DRAFT') { router.push({ pathname: '/artworks/new', params: { id: String(w.id) } }); return }
    if (w.status === 'IN_CERTIFICATION') { router.push({ pathname: '/certification/link/[artworkId]', params: { artworkId: String(w.id) } }); return }
    router.push({ pathname: '/artworks/[id]/listing', params: { id: String(w.id) } })
  }

  if (loading && !h) return <View style={[styles.fill, { paddingTop: insets.top }]}><Loading /></View>
  if (error && !h) return <View style={[styles.fill, { paddingTop: insets.top }]}><ErrorState message={error} onRetry={reload} /></View>
  if (!h) return null

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void reload()} tintColor={theme.accent} />}>
        <View style={styles.head}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.date}>{h.dateLabel}</Text>
            <Display size={28} line={36} numberOfLines={1}>{helloOf(h.name)}</Display>
          </View>
          <IconButton name="contactless" label="Verificar obra" box={40} onPress={() => router.push('/verify' as never)} />
          <Pressable accessibilityRole="button" accessibilityLabel="Perfil e configurações" onPress={() => router.push('/settings')} style={styles.avatar}><Text style={styles.avatarText}>{h.initials}</Text></Pressable>
        </View>

        <Pressable accessibilityRole="button" onPress={() => router.push('/artworks/new')} style={styles.newWork}>
          <View style={styles.newIcon}><Icon name="add-a-photo" size={26} color={colors.ink900} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.newTitle}>Nova obra</Text>
            <Text style={styles.newSub}>Câmera guiada · cerca de 6 minutos</Text>
          </View>
        </Pressable>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Próximas ações</Text>
          {h.actions.length === 0 ? <Text style={styles.empty}>Nada pendente por agora.</Text> : h.actions.map((a) => (
            <Pressable key={a.title} accessibilityRole="button" onPress={() => goAction(a.href)} style={styles.action}>
              <View style={styles.actionIcon}><Icon name={iconOf(a.icon)} size={20} /></View>
              <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.actionTitle}>{a.title}</Text><Text style={styles.actionSub} numberOfLines={1}>{a.subtitle}</Text></View>
              <Icon name="chevron-right" size={20} color={theme.fgMuted} />
            </Pressable>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Suas obras</Text>
          {h.recent.length === 0 ? <Text style={styles.empty}>Cadastre a primeira obra para começar.</Text> : (
            <View style={styles.grid}>
              {h.recent.map((w) => {
                const st = workStatus(w.status)
                return (
                  <Pressable key={w.id} accessibilityRole="button" accessibilityLabel={w.title} onPress={() => openWork(w)} style={styles.cell}>
                    <Wall uri={w.coverUrl} padding={16} />
                    <Display italic size={14} line={18} numberOfLines={1}>{w.title}</Display>
                    <Text style={[styles.cellStatus, { color: st.color }]}>{st.label}</Text>
                  </Pressable>
                )
              })}
            </View>
          )}
        </View>

        <View style={styles.kpis}>
          {h.kpis.map((k) => (
            <View key={k.label} style={styles.kpi}>
              <Text style={styles.kpiLabel} numberOfLines={1}>{k.label}</Text>
              <Text style={styles.kpiValue} numberOfLines={1}>{k.value}</Text>
              {k.note ? <Text style={styles.kpiNote} numberOfLines={1}>{k.note}</Text> : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  body: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 32, gap: 24 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  date: { fontSize: 14, color: theme.fgMuted },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.paper200, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontWeight: '600', color: theme.fg },
  newWork: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, borderRadius: theme.radiusMd, backgroundColor: colors.ink900 },
  newIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.sand500, alignItems: 'center', justifyContent: 'center' },
  newTitle: { fontSize: 16, fontWeight: '600', color: colors.paper50 },
  newSub: { fontSize: 12, color: colors.ink300 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: theme.fg },
  empty: { fontSize: 14, color: theme.fgMuted },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radiusMd, backgroundColor: theme.bg },
  actionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.surface, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 14, fontWeight: '600', color: theme.fg },
  actionSub: { fontSize: 12, lineHeight: 16, color: theme.fgMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  cell: { width: '47%', flexGrow: 1, gap: 4 },
  cellStatus: { fontSize: 12, fontWeight: '600' },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { width: '48%', flexGrow: 1, padding: 12, borderRadius: theme.radiusMd, backgroundColor: theme.surface, gap: 2 },
  kpiLabel: { fontSize: 12, color: theme.fgMuted },
  kpiValue: { fontSize: 20, lineHeight: 26, fontWeight: '600', color: theme.fg, fontVariant: ['tabular-nums'] },
  kpiNote: { fontSize: 11, color: theme.fgMuted },
})
