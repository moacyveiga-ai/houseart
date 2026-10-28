// Avisos (handoff "HouseArt App Artista" › Avisos): the title, the
// "Avisos no celular" switch (Expo push), "Marcar todos como lidos", and the
// rows — round icon per kind (green for what was issued, sand while
// unread), title, sub and "quando". Tapping marks it read and opens the
// aviso's page in the WebView (or the native screen when there is one).
// Data: GET /api/notifications, POST /api/notifications[/id/read].
import { useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useApi, useReloadOnFocus } from '@/api/hooks'
import { markAllRead, markRead, type NotificationRow, type NotificationsList } from '@/api/artist'
import { usePushToggle } from '@/push/usePushToggle'
import { theme } from '@/theme'
import { Display, ErrorState, Icon, Loading } from '@/ui/kit'
import { noticeIcon, noticeTone, whenShort } from './artist/artist-core'

/** The aviso's link inside the app: native screens first, the site for the rest. */
function openHref(router: ReturnType<typeof useRouter>, href: string) {
  const m = /^\/certification\/link\/(\d+)/.exec(href)
  if (m) { router.push({ pathname: '/certification/link/[artworkId]', params: { artworkId: m[1]! } }); return }
  const c = /^\/messages\/(\d+)/.exec(href)
  if (c) { router.push({ pathname: '/messages/[id]', params: { id: c[1]! } }); return }
  if (href === '/messages') { router.navigate('/messages' as never); return }
  if (href.startsWith('/certification')) { router.navigate('/certification' as never); return }
  if (/^\/[^/]/.test(href)) router.push({ pathname: '/web', params: { path: href, title: 'HouseArt' } })
}

export function NotificationsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { data, error, loading, reload } = useApi<NotificationsList>('/api/notifications')
  useReloadOnFocus(reload)
  const push = usePushToggle()
  const [readIds, setReadIds] = useState<ReadonlySet<number>>(new Set())
  const [allRead, setAllRead] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const isRead = (n: NotificationRow) => allRead || !!n.readAt || readIds.has(n.id)
  const unread = (data?.items ?? []).filter((n) => !isRead(n)).length

  async function tap(n: NotificationRow) {
    if (!isRead(n)) {
      setReadIds((s) => new Set([...s, n.id]))
      markRead(n.id).catch((e: Error) => setActionError(e.message))
    }
    if (n.href) openHref(router, n.href)
  }

  async function readAll() {
    setActionError(null)
    try { await markAllRead(); setAllRead(true); void reload().then(() => setAllRead(false)) } catch (e) { setActionError((e as Error).message) }
  }

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.body} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void reload()} tintColor={theme.accent} />}>
        <View style={styles.head}>
          <Display size={28} line={36}>Avisos</Display>
          {unread > 0 ? <Pressable accessibilityRole="button" onPress={() => void readAll()} hitSlop={8}><Text style={styles.readAll}>Marcar todos como lidos</Text></Pressable> : null}
        </View>

        <View style={styles.push}>
          <Icon name="notifications-active" size={22} />
          <View style={{ flex: 1 }}>
            <Text style={styles.pushTitle}>Avisos no celular</Text>
            <Text style={styles.pushSub}>{push.ready ? 'Ofertas, mensagens e certificados por notificação.' : 'Em breve.'}</Text>
          </View>
          <Switch value={push.on} onValueChange={(v) => void push.toggle(v)} disabled={push.busy || !push.ready} trackColor={{ true: theme.accent, false: theme.border }} accessibilityLabel="Avisos no celular" />
        </View>
        {actionError ? <Text style={styles.err} accessibilityRole="alert">{actionError}</Text> : null}

        {loading && !data ? <Loading /> : error && !data ? <ErrorState message={error} onRetry={reload} /> : (data?.items.length ?? 0) === 0 ? (
          <Text style={styles.empty}>Nenhum aviso por enquanto.</Text>
        ) : data!.items.map((n) => {
          const read = isRead(n)
          const tone = noticeTone({ kind: n.kind, readAt: read ? (n.readAt ?? 'read') : null })
          return (
            <Pressable key={n.id} accessibilityRole="button" accessibilityLabel={`${n.title}${read ? '' : ', não lido'}`} onPress={() => void tap(n)} style={styles.row}>
              <View style={[styles.icon, { backgroundColor: tone.bg }]}><Icon name={noticeIcon(n.kind)} size={20} color={tone.fg} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.title, !read && styles.titleUnread]} numberOfLines={2}>{n.title}</Text>
                {n.body ? <Text style={styles.sub} numberOfLines={2}>{n.body}</Text> : null}
              </View>
              <Text style={styles.when}>{whenShort(n.createdAt)}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  body: { paddingTop: 16, paddingHorizontal: 20, paddingBottom: 32 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 },
  readAll: { fontSize: 13, fontWeight: '600', color: theme.fg, textDecorationLine: 'underline' },
  push: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, marginBottom: 8, borderRadius: theme.radiusMd, backgroundColor: theme.surface },
  pushTitle: { fontSize: 14, fontWeight: '600', color: theme.fg },
  pushSub: { fontSize: 12, color: theme.fgMuted },
  err: { fontSize: 13, color: theme.error, marginBottom: 8 },
  empty: { paddingVertical: 24, fontSize: 14, color: theme.fgMuted },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 14, color: theme.fg },
  titleUnread: { fontWeight: '600' },
  sub: { fontSize: 12, lineHeight: 16, color: theme.fgMuted },
  when: { fontSize: 12, color: theme.fgMuted },
})
