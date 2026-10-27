// Comunidade (handoff "HouseArt App Colecionador" › Comunidade): the title with
// "Criar post", the tabs Para você · Seguindo · Eventos (· Notícias · Salvos),
// the composer bar "Mostre uma obra da sua coleção…", the feed of posts
// (foto/texto com obra marcada, notícia, enquete, evento) with curtir ·
// comentar · compartilhar · salvar, Seguir, Eu vou, votar. The comments sheet
// and the composer are their own pieces. GET /api/public/community/feed.
import { useCallback, useEffect, useState } from 'react'
import { FlatList, Linking, Pressable, RefreshControl, Share, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api } from '@/api/client'
import type { FeedItem } from '@/api/types'
import { useSession } from '@/auth/session'
import { API_URL } from '@/config'
import { colors, theme } from '@/theme'
import { Avatar, Display, ErrorState, Icon, IconButton, Loading, Toast, Wall } from '@/ui/kit'
import { absUrl, avatarTint, initialsOf } from '@/ui/format'
import { COMMUNITY_TABS, applyVote, authorLineOf, filterTab, goingLabel, personTagOf, reactionTargetOf, votesLabel, type CommunityTab } from './community-core'
import { CommentsSheet } from './CommentsSheet'
import { Composer } from './Composer'

export function CommunityScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { me } = useSession()
  const [tab, setTab] = useState<CommunityTab>('foryou')
  const [items, setItems] = useState<FeedItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [comments, setComments] = useState<FeedItem | null>(null)
  const [composing, setComposing] = useState(false)
  const [toast, setToast] = useState('')
  const clearToast = useCallback(() => setToast(''), [])
  const apiTab = COMMUNITY_TABS.find((t) => t.key === tab)!.api

  const load = useCallback(async () => {
    setLoading(true)
    try { const r = await api<{ items: FeedItem[] }>(`/api/public/community/feed?tab=${apiTab}`); setItems(r.items); setError(null) }
    catch (e) { setError((e as Error).message) } finally { setLoading(false) }
  }, [apiTab])
  useEffect(() => { void load() }, [load])
  useFocusEffect(useCallback(() => { if (items) void load() }, [load])) // eslint-disable-line react-hooks/exhaustive-deps -- refresh on focus, not on every item change

  const patch = (key: string, p: Partial<FeedItem>) => setItems((list) => (list ? list.map((i) => (i.key === key ? { ...i, ...p } : i)) : list))

  async function react(item: FeedItem, kind: 'LIKE' | 'SAVE' | 'RSVP') {
    const flag = kind === 'LIKE' ? 'liked' : kind === 'SAVE' ? 'saved' : 'iAmGoing'
    const before = !!item[flag]
    const count = kind === 'LIKE' ? 'likes' : kind === 'RSVP' ? 'going' : null
    patch(item.key, { [flag]: !before, ...(count ? { [count]: (item[count] ?? 0) + (before ? -1 : 1) } : {}) })
    try {
      const r = await api<{ ok: boolean; on: boolean; count: number }>('/api/community/reactions', { body: { target: reactionTargetOf(item), targetId: item.id, kind } })
      patch(item.key, { [flag]: r.on, ...(count ? { [count]: r.count } : {}) })
      if (kind === 'SAVE') setToast(r.on ? 'Post salvo' : 'Post removido dos salvos')
      if (kind === 'RSVP' && r.on) setToast('Adicionado à sua agenda')
    } catch (e) { patch(item.key, { [flag]: before, ...(count ? { [count]: item[count] ?? 0 } : {}) }); setToast((e as Error).message) }
  }
  async function follow(item: FeedItem) {
    if (!item.author.memberId) return
    try { const r = await api<{ on: boolean }>('/api/community/reactions', { body: { target: 'MEMBER', targetId: item.author.memberId, kind: 'FOLLOW' } }); setItems((list) => (list ? list.map((i) => (i.author.memberId === item.author.memberId ? { ...i, author: { ...i.author, following: r.on } } : i)) : list)); if (r.on) setToast(`Seguindo ${item.author.name}`) }
    catch (e) { setToast((e as Error).message) }
  }
  async function vote(item: FeedItem, option: number) {
    if (!item.poll) return
    const before = item.poll
    patch(item.key, { poll: applyVote(before, option) })
    try { await api(`/api/community/polls/${item.id}/vote`, { body: { option } }) } catch (e) { patch(item.key, { poll: before }); setToast((e as Error).message) }
  }
  const share = (item: FeedItem) => { const path = item.artwork?.publicId ? `/e/artwork/${item.artwork.publicId}` : item.kind === 'NEWS' && item.href ? item.href : '/community'; const url = `${API_URL}${path}`; Share.share({ message: `${item.title ?? item.body.slice(0, 80)}\n${url}`, url }).catch(() => undefined) }
  const read = (item: FeedItem) => { if (!item.href) return; if (/^https?:\/\//.test(item.href)) Linking.openURL(item.href).catch(() => undefined); else router.push({ pathname: '/web', params: { path: item.href, title: item.title ?? 'Notícia' } }) }
  const shown = filterTab(items ?? [], tab)

  return (
    <View style={[styles.fill, { paddingTop: insets.top }]}>
      <View style={styles.head}>
        <View style={styles.headRow}><Display size={28} line={36}>Comunidade</Display><IconButton name="add-box" label="Criar post" size={28} onPress={() => setComposing(true)} /></View>
        <View style={styles.tabs}>{COMMUNITY_TABS.map((t) => <Pressable key={t.key} accessibilityRole="tab" accessibilityState={{ selected: tab === t.key }} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && styles.tabOn]}><Text style={[styles.tabText, tab === t.key && { color: theme.fg }]}>{t.label}</Text></Pressable>)}</View>
      </View>
      {loading && !items ? <Loading /> : error && !items ? <ErrorState message={error} onRetry={() => void load()} /> : (
        <FlatList
          data={shown}
          keyExtractor={(i) => i.key}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={theme.accent} />}
          ListHeaderComponent={
            <Pressable accessibilityRole="button" onPress={() => setComposing(true)} style={styles.composerBar}>
              <Avatar initials={initialsOf(me?.name ?? '?')} bg={colors.sand100} fg={theme.fg} size={32} />
              <Text style={styles.composerText}>Mostre uma obra da sua coleção…</Text>
              <Icon name="add-photo-alternate" size={22} color={theme.fgMuted} />
            </Pressable>
          }
          renderItem={({ item }) => <FeedCard item={item} onOpenArtwork={() => item.artwork?.publicId && router.push(`/artwork/${item.artwork.publicId}`)} onLike={() => void react(item, 'LIKE')} onSave={() => void react(item, 'SAVE')} onGoing={() => void react(item, 'RSVP')} onFollow={() => void follow(item)} onVote={(o) => void vote(item, o)} onComment={() => setComments(item)} onShare={() => share(item)} onRead={() => read(item)} onProfile={() => item.author.profileHref && router.push({ pathname: '/web', params: { path: item.author.profileHref, title: item.author.name } })} />}
          ListEmptyComponent={<Text style={styles.empty}>{tab === 'following' ? 'Siga artistas, galerias e colecionadores para ver os posts deles aqui.' : tab === 'saved' ? 'Toque no marcador de um post para guardá-lo aqui.' : 'Nada por aqui ainda.'}</Text>}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
      <CommentsSheet item={comments} onClose={() => setComments(null)} onCount={(n) => comments && patch(comments.key, { comments: n })} />
      <Composer open={composing} onClose={() => setComposing(false)} onPosted={() => { setComposing(false); setTab('foryou'); setToast('Publicado na comunidade'); void load() }} />
      <Toast message={toast} onDone={clearToast} />
    </View>
  )
}

function FeedCard({ item, onOpenArtwork, onLike, onSave, onGoing, onFollow, onVote, onComment, onShare, onRead, onProfile }: { item: FeedItem; onOpenArtwork: () => void; onLike: () => void; onSave: () => void; onGoing: () => void; onFollow: () => void; onVote: (o: number) => void; onComment: () => void; onShare: () => void; onRead: () => void; onProfile: () => void }) {
  const tag = personTagOf(item)
  const tint = tag.official ? { bg: theme.accent, fg: theme.fg } : avatarTint(item.author.name)
  const canFollow = !tag.official && !!item.author.memberId && !item.author.following
  const voted = item.poll?.myVote !== null && item.poll?.myVote !== undefined
  return (
    <View style={styles.card}>
      <View style={styles.author}>
        {/* the author with a public page (artist, active gallery) opens it, as on the web */}
        <Pressable accessibilityRole={item.author.profileHref ? 'link' : undefined} accessibilityLabel={item.author.profileHref ? `Perfil de ${item.author.name}` : undefined} disabled={!item.author.profileHref} onPress={onProfile} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
        <Avatar initials={item.author.initials} bg={tint.bg} fg={tint.fg} size={38} uri={absUrl(item.author.avatarUrl)} />
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}><Text style={styles.name} numberOfLines={1}>{item.author.name}</Text><Text style={[styles.tag, tag.official && { backgroundColor: theme.accent }]}>{tag.label}</Text></View>
          <Text style={styles.sub} numberOfLines={1}>{authorLineOf(item)}</Text>
        </View>
        </Pressable>
        {canFollow ? <Pressable accessibilityRole="button" onPress={onFollow} style={styles.follow}><Text style={styles.followText}>Seguir</Text></Pressable> : null}
      </View>
      {item.body && item.kind !== 'NEWS' ? <Text style={styles.body}>{item.body}</Text> : null}
      {(item.kind === 'PHOTO' || item.kind === 'TEXT') && item.imageUrl ? (
        <View>
          <Wall uri={item.imageUrl} padding={28} />
          {item.artwork ? (
            <Pressable accessibilityRole="button" onPress={onOpenArtwork} style={styles.artStrip}>
              <Icon name="sell" size={18} />
              <View style={{ flex: 1 }}><Display italic size={14} line={18} numberOfLines={1}>{item.artwork.title}</Display></View>
              <Text style={styles.link}>Ver obra</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {item.kind === 'NEWS' ? (
        <Pressable accessibilityRole="button" onPress={onRead} style={styles.news}>
          {item.imageUrl ? <Wall uri={item.imageUrl} padding={0} style={styles.newsImg} square={false} /> : null}
          <Text style={styles.kicker}>{item.format ?? 'Notícia'}</Text>
          <Display semibold size={18} line={23}>{item.title}</Display>
          {item.summary ? <Text style={styles.body}>{item.summary}</Text> : null}
          <View style={styles.newsFoot}><Text style={styles.sub}>HouseArt Notícias</Text><Text style={styles.link}>Ler →</Text></View>
        </Pressable>
      ) : null}
      {item.poll ? (
        <View style={{ gap: 6 }}>
          {item.poll.options.map((o, i) => (
            <Pressable key={i} accessibilityRole="button" onPress={() => onVote(i)} style={[styles.opt, item.poll!.myVote === i && { borderColor: theme.fg }]}>
              <View style={[styles.optFill, { width: voted ? `${o.pct}%` : '0%', backgroundColor: item.poll!.myVote === i ? colors.sand100 : theme.surface }]} />
              <Text style={styles.optLabel}>{o.label}</Text>{voted ? <Text style={styles.optPct}>{o.pct}%</Text> : null}
            </Pressable>
          ))}
          <Text style={styles.sub}>{votesLabel(item.poll.total, voted)}</Text>
        </View>
      ) : null}
      {item.kind === 'EVENT' || item.kind === 'AGENDA' ? (
        <View style={styles.event}>
          <View style={styles.date}><Text style={styles.day}>{item.day}</Text><Text style={styles.month}>{item.month}</Text></View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.name}>{item.title}</Text>
            <Text style={styles.sub}>{[item.startsAt, item.venue].filter(Boolean).join(' · ')}</Text>
            <View style={styles.goingRow}>
              <Text style={styles.sub}>{goingLabel(item.going ?? 0)}</Text>
              <Pressable accessibilityRole="button" onPress={onGoing} style={[styles.going, item.iAmGoing && { backgroundColor: theme.accent, borderColor: theme.accent }]}><Text style={styles.goingText}>{item.iAmGoing ? 'Eu vou ✓' : 'Eu vou'}</Text></Pressable>
            </View>
            {item.kind === 'AGENDA' && item.href ? <Pressable accessibilityRole="link" onPress={onRead}><Text style={styles.link}>Mais informações →</Text></Pressable> : null}
          </View>
        </View>
      ) : null}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Curtir" onPress={onLike} style={styles.action}><Icon name={item.liked ? 'favorite' : 'favorite-border'} size={22} color={item.liked ? theme.error : theme.fg} /><Text style={styles.count}>{item.likes}</Text></Pressable>
        {item.canComment ? <Pressable accessibilityRole="button" accessibilityLabel="Comentar" onPress={onComment} style={styles.action}><Icon name="chat-bubble-outline" size={22} /><Text style={styles.count}>{item.comments}</Text></Pressable> : null}
        <IconButton name="send" label="Compartilhar" size={22} box={36} onPress={onShare} />
        <View style={{ flex: 1 }} />
        <IconButton name={item.saved ? 'bookmark' : 'bookmark-border'} label="Salvar" size={22} box={36} onPress={onSave} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.bg },
  head: { paddingTop: 6, paddingHorizontal: 16, gap: 4 },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tabs: { flexDirection: 'row', gap: 16 },
  tab: { height: 40, justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabOn: { borderBottomColor: theme.fg },
  tabText: { fontSize: 14, fontWeight: '600', color: theme.fgMuted },
  composerBar: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, marginBottom: 4, padding: 10, borderRadius: theme.radiusFull, backgroundColor: theme.surface },
  composerText: { flex: 1, fontSize: 14, color: theme.fgMuted },
  card: { padding: 16, gap: 10, borderBottomWidth: 1, borderBottomColor: theme.border },
  author: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 14, fontWeight: '600', color: theme.fg, flexShrink: 1 },
  tag: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', color: theme.fg, backgroundColor: theme.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: theme.radiusSm, overflow: 'hidden' },
  sub: { fontSize: 12, lineHeight: 16, color: theme.fgMuted },
  follow: { height: 30, paddingHorizontal: 12, borderRadius: theme.radiusFull, borderWidth: 1, borderColor: theme.fg, justifyContent: 'center' },
  followText: { fontSize: 12, fontWeight: '600', color: theme.fg },
  body: { fontSize: 14, lineHeight: 20, color: theme.fgBody },
  artStrip: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, backgroundColor: theme.surface },
  link: { fontSize: 13, fontWeight: '600', color: theme.fg },
  news: { gap: 6, padding: 12, borderRadius: theme.radiusMd, backgroundColor: theme.surface },
  newsImg: { height: 160, borderRadius: theme.radiusSm },
  kicker: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase', color: theme.fgMuted },
  newsFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  opt: { height: 40, borderRadius: theme.radiusMd, borderWidth: 1, borderColor: theme.border, overflow: 'hidden', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, justifyContent: 'space-between' },
  optFill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  optLabel: { fontSize: 14, color: theme.fg },
  optPct: { fontSize: 13, fontWeight: '600', color: theme.fg, fontVariant: ['tabular-nums'] },
  event: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: theme.radiusMd, borderWidth: 1, borderColor: theme.border },
  date: { width: 52, alignItems: 'center', paddingVertical: 6, borderRadius: theme.radiusSm, backgroundColor: theme.fg },
  day: { fontSize: 20, fontWeight: '600', color: theme.bg },
  month: { fontSize: 11, fontWeight: '600', color: theme.accent },
  goingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  going: { height: 30, paddingHorizontal: 12, borderRadius: theme.radiusFull, borderWidth: 1, borderColor: theme.fg, justifyContent: 'center' },
  goingText: { fontSize: 12, fontWeight: '600', color: theme.fg },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingRight: 8 },
  count: { fontSize: 13, color: theme.fg, fontVariant: ['tabular-nums'] },
  empty: { padding: 32, paddingHorizontal: 24, fontSize: 14, lineHeight: 20, color: theme.fgMuted, textAlign: 'center' },
})
