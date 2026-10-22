// Comentários (handoff "HouseArt App Colecionador" › sheet `coment`): the rows
// (initials · name · "autor" · when · text · Responder · curtir), "Seja a
// primeira pessoa a comentar.", the contact band, the composer "Adicione um
// comentário" + Publicar. GET /api/public/community/comments; POST
// /api/community/comments; likes by /api/community/reactions (COMMENT LIKE).
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { api } from '@/api/client'
import type { CommentRow, FeedItem } from '@/api/types'
import { useSession } from '@/auth/session'
import { colors, theme } from '@/theme'
import { BottomSheet } from '@/ui/forms'
import { Avatar, Icon, Loading } from '@/ui/kit'
import { avatarTint, initialsOf } from '@/ui/format'
import { CONTACT_LINE, hasContact } from './community-core'

export function CommentsSheet({ item, onClose, onCount }: { item: FeedItem | null; onClose: () => void; onCount: (n: number) => void }) {
  const { me } = useSession()
  const [rows, setRows] = useState<CommentRow[] | null>(null)
  const [text, setText] = useState('')
  const [blocked, setBlocked] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const target = item?.kind === 'NEWS' ? 'NEWS' : 'POST'

  useEffect(() => {
    if (!item) { setRows(null); setText(''); setBlocked(null); return }
    api<{ items: CommentRow[] }>(`/api/public/community/comments?target=${target}&targetId=${item.id}`).then((r) => setRows(r.items)).catch(() => setRows([]))
  }, [item, target])

  async function publish() {
    const body = text.trim()
    if (!item || !body || busy) return
    if (hasContact(body)) { setBlocked(CONTACT_LINE); return }
    setBusy(true); setBlocked(null)
    try {
      await api('/api/community/comments', { body: { target, targetId: item.id, body } })
      const r = await api<{ items: CommentRow[] }>(`/api/public/community/comments?target=${target}&targetId=${item.id}`)
      setRows(r.items); onCount(r.items.length); setText('')
    } catch (e) { setBlocked((e as Error).message) } finally { setBusy(false) }
  }
  async function like(c: CommentRow) {
    setRows((rs) => (rs ? rs.map((x) => (x.id === c.id ? { ...x, liked: !x.liked, likes: x.likes + (x.liked ? -1 : 1) } : x)) : rs))
    try { const r = await api<{ on: boolean; count: number }>('/api/community/reactions', { body: { target: 'COMMENT', targetId: c.id, kind: 'LIKE' } }); setRows((rs) => (rs ? rs.map((x) => (x.id === c.id ? { ...x, liked: r.on, likes: r.count } : x)) : rs)) }
    catch { setRows((rs) => (rs ? rs.map((x) => (x.id === c.id ? c : x)) : rs)) }
  }

  return (
    <BottomSheet open={!!item} title="Comentários" onClose={onClose} height="72%" footer={
      <View style={{ gap: 8 }}>
        {blocked ? <Text style={styles.band}>{blocked}</Text> : null}
        <View style={styles.composer}>
          <Avatar initials={initialsOf(me?.name ?? '?')} bg={colors.sand100} fg={theme.fg} size={30} />
          <TextInput value={text} onChangeText={(v) => { setText(v); setBlocked(null) }} placeholder="Adicione um comentário" placeholderTextColor={theme.fgMuted} style={styles.input} maxLength={500} onSubmitEditing={() => void publish()} returnKeyType="send" />
          <Pressable accessibilityRole="button" disabled={!text.trim() || busy} onPress={() => void publish()}><Text style={[styles.publish, (!text.trim() || busy) && { color: theme.fgDisabled }]}>Publicar</Text></Pressable>
        </View>
      </View>
    }>
      {rows === null ? <Loading /> : rows.length === 0 ? <Text style={styles.empty}>Seja a primeira pessoa a comentar.</Text> : rows.map((c) => {
        const tint = avatarTint(c.author.name)
        const isAuthor = !!item?.author.memberId && c.author.memberId === item.author.memberId
        return (
          <View key={c.id} style={styles.row}>
            <Avatar initials={c.author.initials} bg={tint.bg} fg={tint.fg} size={32} />
            <View style={{ flex: 1, gap: 2 }}>
              <View style={styles.nameRow}><Text style={styles.name}>{c.mine ? 'Você' : c.author.name}</Text>{isAuthor ? <Text style={styles.autor}>autor</Text> : null}<Text style={styles.when}>{c.when}</Text></View>
              <Text style={styles.body}>{c.body}</Text>
              <Pressable accessibilityRole="button" onPress={() => setText(`@${c.author.name.split(' ')[0]} `)}><Text style={styles.reply}>Responder</Text></Pressable>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Curtir comentário" onPress={() => void like(c)} style={styles.like}><Icon name={c.liked ? 'favorite' : 'favorite-border'} size={18} color={c.liked ? theme.error : theme.fgMuted} />{c.likes ? <Text style={styles.when}>{c.likes}</Text> : null}</Pressable>
          </View>
        )
      })}
    </BottomSheet>
  )
}

const styles = StyleSheet.create({
  empty: { fontSize: 14, color: theme.fgMuted, paddingVertical: 24, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 13, fontWeight: '600', color: theme.fg },
  autor: { fontSize: 10, fontWeight: '600', color: theme.fg, backgroundColor: colors.sand100, paddingHorizontal: 5, paddingVertical: 1, borderRadius: theme.radiusSm, overflow: 'hidden' },
  when: { fontSize: 11, color: theme.fgMuted },
  body: { fontSize: 14, lineHeight: 19, color: theme.fgBody },
  reply: { fontSize: 12, fontWeight: '600', color: theme.fgMuted, paddingTop: 2 },
  like: { alignItems: 'center', gap: 2, paddingTop: 4 },
  band: { fontSize: 12, lineHeight: 17, color: theme.error, backgroundColor: colors.alert100, padding: 8, borderRadius: theme.radiusSm },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, height: 40, borderRadius: theme.radiusFull, backgroundColor: theme.surface, paddingHorizontal: 14, fontSize: 14, color: theme.fg },
  publish: { fontSize: 14, fontWeight: '600', color: theme.fg },
})
