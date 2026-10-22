// Carteira de escrituras do artista (handoff "HouseArt App Artista" ›
// Carteira): "N obras · N escrituras emitidas" over "Carteira", the works in
// certification with the stage and the next step (Vincular no app → the
// native reader; Emitir → the web Certificação), then the issued deeds as
// the prototype's cards (wall · title · ID · "Versão N"). Tapping an issued
// deed opens the public certificate (/verify/[publicId]) in the WebView.
// Data: GET /api/artist/certificates.
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useApi, useReloadOnFocus } from '@/api/hooks'
import type { CertItem, Certificates } from '@/api/artist'
import { colors, theme } from '@/theme'
import { Display, ErrorState, Icon, Loading, Wall } from '@/ui/kit'
import { certTarget, versionLabel } from './artist-core'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function DeedsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { data, error, loading, reload } = useApi<Certificates>('/api/artist/certificates')
  useReloadOnFocus(reload)

  const open = (i: CertItem) => {
    const t = certTarget(i)
    if (t.kind === 'link') router.push({ pathname: '/certification/link/[artworkId]', params: { artworkId: String(t.artworkId) } })
    else if (t.kind === 'verify') router.push({ pathname: '/verify', params: { id: t.publicId } })
    else if (t.kind === 'web') router.push({ pathname: '/web', params: { path: t.path, title: t.title } })
  }

  if (loading && !data) return <View style={[styles.fill, { paddingTop: insets.top }]}><Loading /></View>
  if (error && !data) return <View style={[styles.fill, { paddingTop: insets.top }]}><ErrorState message={error} onRetry={reload} /></View>
  if (!data) return null
  const issued = data.items.filter((i) => i.stage >= 5)
  const pending = data.items.filter((i) => i.stage < 5)
  const kit = data.orders.some((o) => o.status === 'SHIPPED') ? 'Kit de etiquetas a caminho' : data.orders.some((o) => o.status === 'REQUESTED') ? 'Kit de etiquetas pedido' : null

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void reload()} tintColor={theme.accent} />}>
        <View>
          <Text style={styles.summary}>{plural(data.items.length, 'obra', 'obras')} · {plural(issued.length, 'escritura emitida', 'escrituras emitidas')}</Text>
          <Display size={28} line={36}>Carteira</Display>
        </View>

        {kit ? (
          <View style={styles.banner}>
            <Icon name="local-shipping" size={24} />
            <View style={{ flex: 1 }}><Text style={styles.bannerTitle}>{kit}</Text><Text style={styles.bannerSub}>Quando chegar, vincule cada etiqueta pelo app.</Text></View>
          </View>
        ) : null}

        {pending.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Em certificação</Text>
            {pending.map((i) => {
              const t = certTarget(i)
              return (
                <Pressable key={i.artworkId} accessibilityRole="button" disabled={t.kind === 'none'} onPress={() => open(i)} style={styles.row}>
                  <Wall uri={i.coverUrl} padding={8} style={styles.rowWall} square={false} />
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Display italic size={15} line={20} numberOfLines={1}>{i.title}</Display>
                    <Text style={styles.stage}>{i.stageLabel} · etapa {i.stage + 1} de 6</Text>
                    <View style={styles.bar}><View style={[styles.barFill, { width: `${Math.round(((i.stage + 1) / 6) * 100)}%` }]} /></View>
                  </View>
                  {t.kind === 'none' ? <Text style={styles.wait}>{i.actionLabel}</Text> : <View style={styles.actionPill}><Text style={styles.actionText}>{i.actionLabel}</Text></View>}
                </Pressable>
              )
            })}
          </View>
        ) : null}

        <View style={styles.section}>
          {pending.length ? <Text style={styles.sectionTitle}>Escrituras</Text> : null}
          {issued.length === 0 ? <Text style={styles.empty}>Nenhuma escritura emitida ainda. Cadastre uma obra e vincule a etiqueta para emitir o certificado.</Text> : issued.map((i) => (
            <Pressable key={i.artworkId} accessibilityRole="button" accessibilityLabel={i.title} onPress={() => open(i)} style={styles.card}>
              <Wall uri={i.coverUrl} padding={12} style={styles.cardWall} square={false} />
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <Display italic size={15} line={20} numberOfLines={2}>{i.title}</Display>
                <Text style={styles.id}>{i.publicId ?? '—'}</Text>
                <View style={styles.cardFoot}>
                  <View style={styles.verified}><Icon name="verified" size={14} color={colors.verified500} /><Text style={styles.verifiedText}>{i.status === 'SOLD' ? 'Vendida' : 'Autenticada'}</Text></View>
                  <Text style={styles.version}>{versionLabel(i.version)}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  body: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 32, gap: 20 },
  summary: { fontSize: 14, color: theme.fgMuted },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: theme.radiusMd, backgroundColor: colors.sand100 },
  bannerTitle: { fontSize: 14, fontWeight: '600', color: theme.fg },
  bannerSub: { fontSize: 12, color: theme.fgBody },
  section: { gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: theme.fg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  rowWall: { width: 56, height: 56 },
  stage: { fontSize: 12, color: theme.fgMuted },
  bar: { height: 4, borderRadius: 2, backgroundColor: theme.border, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: colors.pending500 },
  wait: { fontSize: 12, color: theme.fgMuted },
  actionPill: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: theme.radiusMd, backgroundColor: theme.fg },
  actionText: { fontSize: 12, fontWeight: '600', color: theme.bg },
  empty: { fontSize: 14, color: theme.fgMuted },
  card: { flexDirection: 'row', gap: 16, padding: 12, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radiusMd, backgroundColor: theme.bg },
  cardWall: { width: 88, height: 88 },
  id: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, color: theme.fg, fontVariant: ['tabular-nums'] },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 'auto' },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  verifiedText: { fontSize: 12, fontWeight: '600', color: colors.verified500 },
  version: { fontSize: 12, color: theme.fgMuted },
})
