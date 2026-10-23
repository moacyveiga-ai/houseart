// Galeria · painel do dia (handoff "HouseArt App Galeria" › Galeria): initials ·
// date and name · search · settings; the four KPIs (the first one dark);
// "Precisa de você"; "Obras mais vistas · últimos 7 dias"; the shortcuts.
// Data: GET /api/gallery/panel (the same the web `DayPanel` reads).
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useApi, useReloadOnFocus } from '@/api/hooks'
import type { DayPanel } from '@/api/gallery'
import { colors, theme } from '@/theme'
import { Display, ErrorState, Icon, IconButton, Loading, Wall, type IconName } from '@/ui/kit'
import { useSession } from '@/auth/session'
import { rolePermissions } from './role-core'
import { actionTone, kpiColors, panelTarget, plural, symbolIcon, type PanelTarget } from './gallery-core'

export function DayPanelScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { data, error, loading, reload } = useApi<{ ok: boolean; panel: DayPanel }>('/api/gallery/panel')
  useReloadOnFocus(reload)
  const p = data?.panel
  const can = rolePermissions(useSession().me?.teamRole)

  const go = (t: PanelTarget) => {
    if (t.kind === 'listing') { router.push({ pathname: '/artworks/[id]/listing', params: { id: String(t.id) } }); return }
    if (t.kind === 'web') { router.push({ pathname: '/web', params: { path: t.path, title: t.title } }); return }
    router.navigate({ pathname: `/(tabs)/${t.tab}`, params: t.params } as never)
  }
  const web = (path: string, title: string) => router.push({ pathname: '/web', params: { path, title } })

  const shortcuts: { t: string; icon: IconName; go: () => void }[] = [
    { t: 'Nova obra', icon: 'add-photo-alternate', go: () => web('/artworks/new', 'Cadastrar obra') },
    { t: 'Publicar post', icon: 'edit-square', go: () => go({ kind: 'tab', tab: 'community' }) },
    // Equipe is the Admin's; Vendas and Acervo get the marketplace in its place.
    ...(can.manageTeam ? [{ t: 'Equipe', icon: 'badge' as IconName, go: () => router.push('/gallery/team') }] : []),
    { t: 'Ver marketplace', icon: 'storefront', go: () => web('/e/marketplace', 'Marketplace') },
  ]

  if (loading && !p) return <View style={[styles.fill, { paddingTop: insets.top }]}><Loading /></View>
  if (error && !p) return <View style={[styles.fill, { paddingTop: insets.top }]}><ErrorState message={error} onRetry={reload} /></View>
  if (!p) return null
  const max = p.top.length ? Math.max(...p.top.map((t) => t.views7d)) : 1

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void reload()} tintColor={theme.accent} />}>
        <View style={styles.head}>
          <Pressable accessibilityRole="button" accessibilityLabel="Conta da galeria" onPress={() => router.push('/gallery/account')} style={styles.avatar}><Text style={styles.avatarText}>{p.initials}</Text></Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.date}>{p.dateLabel}</Text>
            <Display size={24} line={30} numberOfLines={1}>{p.name}</Display>
          </View>
          <IconButton name="search" label="Buscar" box={40} onPress={() => router.push('/search')} />
          <IconButton name="settings" label="Conta e configurações" box={40} onPress={() => router.push('/gallery/account')} />
        </View>

        <View style={styles.kpis}>
          {p.kpis.map((k) => {
            const c = kpiColors(k)
            return (
              <Pressable key={k.key} accessibilityRole="button" onPress={() => go(panelTarget(k.href))} style={[styles.kpi, { backgroundColor: c.bg }]}>
                <View style={styles.kpiLabel}><Icon name={symbolIcon(k.icon) as IconName} size={16} color={c.sub} /><Text style={[styles.kpiLabelText, { color: c.sub }]} numberOfLines={1}>{k.label}</Text></View>
                <Text style={[styles.kpiValue, { color: c.fg }]} numberOfLines={1}>{k.value}</Text>
                <Text style={[styles.kpiDetail, { color: c.sub }]} numberOfLines={1}>{k.detail}</Text>
              </Pressable>
            )
          })}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Precisa de você</Text><Text style={styles.sectionNote}>{plural(p.actions.length, 'item', 'itens')}</Text></View>
          {p.actions.length === 0 ? (
            <View style={styles.clear}><Icon name="task-alt" size={22} color={theme.success} /><Text style={styles.clearText}>Tudo em dia por aqui.</Text></View>
          ) : p.actions.map((a, i) => {
            const tone = actionTone(a)
            return (
              <Pressable key={`${a.title}-${i}`} accessibilityRole="button" onPress={() => go(panelTarget(a.href))} style={styles.action}>
                <View style={[styles.actionIcon, { backgroundColor: tone.iconBg }]}><Icon name={symbolIcon(a.icon) as IconName} size={20} /></View>
                <View style={{ flex: 1, minWidth: 0 }}><Text style={styles.actionTitle}>{a.title}</Text><Text style={styles.actionSub} numberOfLines={1}>{a.sub}</Text></View>
                <View style={[styles.tag, { backgroundColor: tone.tagBg }]}><Text style={styles.tagText}>{a.tag}</Text></View>
              </Pressable>
            )
          })}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Obras mais vistas</Text><Text style={styles.sectionNote}>últimos 7 dias</Text></View>
          {p.top.length === 0 ? <Text style={styles.empty}>Nenhuma visualização nos últimos 7 dias.</Text> : p.top.map((t) => (
            <Pressable key={t.id} accessibilityRole="button" onPress={() => go({ kind: 'listing', id: t.id })} style={styles.top}>
              <Wall uri={t.coverUrl} padding={6} style={styles.topWall} square={false} />
              <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                <View style={styles.topLine}><Display italic size={14} line={18} numberOfLines={1} style={{ flex: 1 }}>{t.title}</Display><Text style={styles.topViews}>{t.views7d.toLocaleString('pt-BR')}</Text></View>
                <View style={styles.bar}><View style={[styles.barFill, { width: `${Math.round((t.views7d / max) * 100)}%` }]} /></View>
                <Text style={styles.topStats}>{plural(t.openOffers, 'oferta', 'ofertas')}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <View style={styles.shortcuts}>
          {shortcuts.map((s) => (
            <Pressable key={s.t} accessibilityRole="button" onPress={s.go} style={styles.shortcut}><Icon name={s.icon} size={22} /><Text style={styles.shortcutText}>{s.t}</Text></Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  body: { paddingTop: 6, paddingHorizontal: 16, paddingBottom: 28, gap: 20 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.ink900, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.paper50, fontSize: 13, fontWeight: '600' },
  date: { fontSize: 12, color: theme.fgMuted },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kpi: { width: '48%', flexGrow: 1, padding: 12, borderRadius: theme.radiusMd, gap: 2 },
  kpiLabel: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  kpiLabelText: { fontSize: 12, flexShrink: 1 },
  kpiValue: { fontSize: 20, lineHeight: 26, fontWeight: '600', fontVariant: ['tabular-nums'] },
  kpiDetail: { fontSize: 11, lineHeight: 14 },
  section: { gap: 8 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: theme.fg },
  sectionNote: { fontSize: 12, color: theme.fgMuted },
  action: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radiusMd, backgroundColor: theme.bg },
  actionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 14, fontWeight: '600', color: theme.fg },
  actionSub: { fontSize: 12, lineHeight: 16, color: theme.fgMuted },
  tag: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: theme.radiusFull },
  tagText: { fontSize: 11, fontWeight: '600', color: theme.fg },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: theme.radiusMd, backgroundColor: colors.verified100 },
  clearText: { fontSize: 14, fontWeight: '600', color: theme.fg },
  empty: { fontSize: 13, color: theme.fgMuted },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  topWall: { width: 52, height: 52 },
  topLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'center' },
  topViews: { fontSize: 12, fontWeight: '600', color: theme.fg, fontVariant: ['tabular-nums'] },
  bar: { height: 4, borderRadius: 2, backgroundColor: theme.border, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: theme.accent },
  topStats: { fontSize: 11, color: theme.fgMuted },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  shortcut: { width: '48%', flexGrow: 1, height: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radiusMd, backgroundColor: theme.bg },
  shortcutText: { fontSize: 13, fontWeight: '600', color: theme.fg },
})
