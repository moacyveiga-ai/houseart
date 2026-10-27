// Conversa com galeria (handoff "HouseArt App Colecionador" › Conversa com galeria):
// back · avatar · name · "<tipo> · verificado pela HouseArt", the artwork strip,
// the bubbles (system lines centred; theirs on paper, mine on ink), the quick
// replies, the guard band with the server's refusal, and the composer.
// GET /api/messages/[id]?after= every 5 s while open; POST sends { body }. The camera button sends a
// photo (POST …/photos, multipart; the server re-encodes it and keeps it in the private vault).
import { useCallback, useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { api, apiUpload, ApiError } from '@/api/client'
import type { ConversationRow, MessageRow } from '@/api/types'
import { colors, theme } from '@/theme'
import { Avatar, Chip, Display, ErrorState, Icon, IconButton, Loading, TopBar, Wall } from '@/ui/kit'
import { avatarTint, bubbleTime } from '@/ui/format'
import { VaultImage } from '@/ui/vault-image'
import { photoPart } from './artist/artist-core'

/** The quick replies of the prototype for the buyer's side (the collector). */
const QUICK_REPLIES = ['Ainda disponível?', 'Posso ver ao vivo?', 'Como fica o frete?', 'Tem o condition report?']
const POLL_MS = 5000

function merge(current: MessageRow[], incoming: MessageRow[]): MessageRow[] {
  const seen = new Set(current.map((m) => m.id))
  const fresh = incoming.filter((m) => !seen.has(m.id))
  return fresh.length ? [...current, ...fresh].sort((a, b) => a.id - b.id) : current
}

export function ConversationScreen({ id }: { id: number }) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [header, setHeader] = useState<ConversationRow | null>(null)
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const loadedRef = useRef(false)
  const [input, setInput] = useState('')
  const [guard, setGuard] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const scroll = useRef<ScrollView>(null)
  const lastId = messages.length ? messages[messages.length - 1]!.id : 0

  const load = useCallback(async (after: number) => {
    try {
      const r = await api<{ header: ConversationRow; messages: MessageRow[] }>(`/api/messages/${id}${after ? `?after=${after}` : ''}`)
      setHeader(r.header)
      setMessages((cur) => merge(cur, r.messages))
      setError(null)
    } catch (e) { if (!loadedRef.current) setError((e as Error).message) } finally { loadedRef.current = true; setLoaded(true) }
  }, [id])

  useEffect(() => { void load(0) }, [load])
  useEffect(() => {
    const t = setInterval(() => { void load(lastId) }, POLL_MS)
    return () => clearInterval(t)
  }, [load, lastId])
  useEffect(() => { scroll.current?.scrollToEnd({ animated: true }) }, [messages.length])

  async function send(text: string) {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    try {
      const r = await api<{ ok: boolean; message: MessageRow }>(`/api/messages/${id}`, { body: { body } })
      setMessages((cur) => merge(cur, [r.message]))
      setInput('')
      setGuard(null)
    } catch (e) {
      // The server's refusal (contact filter, empty, too long) is the band of the prototype.
      setGuard(e instanceof ApiError ? e.message : 'Não foi possível enviar agora.')
    } finally { setSending(false) }
  }

  async function sendPhoto() {
    if (sending) return
    let result: ImagePicker.ImagePickerResult
    try { result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85, exif: false }) } catch { setGuard('Não foi possível abrir a galeria.'); return }
    if (result.canceled || !result.assets[0]) return
    setSending(true)
    try {
      const r = await apiUpload<{ ok: boolean; message: MessageRow }>(`/api/messages/${id}/photos`, {}, photoPart(result.assets[0], 'foto'))
      setMessages((cur) => merge(cur, [r.message]))
      setGuard(null)
    } catch (e) {
      setGuard(e instanceof ApiError ? e.message : 'Não foi possível enviar a foto.')
    } finally { setSending(false) }
  }

  if (!loaded) return <View style={[styles.fill, { paddingTop: insets.top }]}><TopBar /><Loading /></View>
  if (!header) return <View style={[styles.fill, { paddingTop: insets.top }]}><TopBar /><ErrorState message={error ?? 'Conversa não encontrada.'} onRetry={() => void load(0)} /></View>
  const tint = avatarTint(header.other.name)

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.fill, { paddingTop: insets.top }]}>
      <View style={styles.head}>
        <View style={styles.headRow}>
          <IconButton name="arrow-back" label="Voltar" onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/messages'))} />
          <Avatar initials={header.other.initials} bg={tint.bg} fg={tint.fg} size={32} uri={header.other.avatarUrl} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{header.other.name}</Text>
            <Text style={styles.type}>{header.other.sub} · verificado pela HouseArt</Text>
          </View>
        </View>
        {header.artworkPublicId ? (
          <Pressable accessibilityRole="button" onPress={() => router.push(`/artwork/${header.artworkPublicId}`)} style={styles.strip}>
            <Wall uri={header.artworkCoverUrl} padding={4} style={styles.stripWall} />
            <View style={{ flex: 1 }}><Display italic size={13} line={18}>{header.artworkTitle ?? ''}</Display><Text style={styles.stripSub}>Ver obra</Text></View>
            <Icon name="chevron-right" size={20} color={theme.fgMuted} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView ref={scroll} style={styles.thread} contentContainerStyle={styles.threadBody} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}>
        {messages.map((m) => m.kind === 'IMAGE' && m.imageUrl ? (
          <View key={m.id} style={m.mine ? styles.photoMine : styles.photoTheirs}>
            <VaultImage url={m.imageUrl} style={styles.photo} label={m.mine ? 'Foto que você enviou' : 'Foto recebida'} />
            <Text style={styles.theirsTime}>{bubbleTime(m.at)}</Text>
          </View>
        ) : m.kind !== 'TEXT' ? (
          <Text key={m.id} style={styles.sys}>{m.body}</Text>
        ) : m.mine ? (
          <View key={m.id} style={styles.mine}><Text style={styles.mineText}>{m.body}</Text><Text style={styles.mineTime}>{bubbleTime(m.at)}</Text></View>
        ) : (
          <View key={m.id} style={styles.theirs}><Text style={styles.theirsText}>{m.body}</Text><Text style={styles.theirsTime}>{bubbleTime(m.at)}</Text></View>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quick} style={{ flexGrow: 0 }}>
        {QUICK_REPLIES.map((t) => <Chip key={t} label={t} onPress={() => void send(t)} />)}
      </ScrollView>
      {guard ? <View style={styles.guard}><Icon name="shield" size={17} color={theme.error} /><Text style={styles.guardText}>{guard}</Text></View> : null}
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 8) + 8 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Enviar foto" onPress={() => void sendPhoto()} disabled={sending} style={[styles.cam, sending && { opacity: 0.5 }]}><Icon name="photo-camera" size={20} /></Pressable>
        <TextInput value={input} onChangeText={(t) => { setInput(t); setGuard(null) }} placeholder="Mensagem" placeholderTextColor={theme.fgMuted} style={styles.input} multiline={false} returnKeyType="send" onSubmitEditing={() => void send(input)} blurOnSubmit={false} />
        <Pressable accessibilityRole="button" accessibilityLabel="Enviar" onPress={() => void send(input)} disabled={sending} style={[styles.send, sending && { opacity: 0.5 }]}><Icon name="send" size={20} color={colors.paper50} /></Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: theme.surface },
  head: { backgroundColor: theme.bg, borderBottomWidth: 1, borderBottomColor: theme.border },
  headRow: { height: 52, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 6 },
  name: { fontSize: 15, fontWeight: '600', color: theme.fg },
  type: { fontSize: 11, lineHeight: 14, color: theme.fgMuted },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: theme.border },
  stripWall: { width: 40, height: 40 },
  stripSub: { fontSize: 12, color: theme.fgMuted },
  thread: { flex: 1 },
  threadBody: { paddingVertical: 14, paddingHorizontal: 16, gap: 8 },
  sys: { alignSelf: 'center', maxWidth: '90%', paddingVertical: 4, paddingHorizontal: 10, borderRadius: theme.radiusFull, backgroundColor: theme.border, fontSize: 11, lineHeight: 15, fontWeight: '600', color: theme.fgBody, textAlign: 'center', overflow: 'hidden' },
  theirs: { alignSelf: 'flex-start', maxWidth: '80%', paddingVertical: 8, paddingHorizontal: 12, borderTopLeftRadius: 14, borderTopRightRadius: 14, borderBottomRightRadius: 14, borderBottomLeftRadius: 4, backgroundColor: theme.bg, borderWidth: 1, borderColor: theme.border, gap: 2 },
  theirsText: { fontSize: 14, lineHeight: 20, color: theme.fg },
  theirsTime: { fontSize: 10, color: theme.fgMuted },
  mine: { alignSelf: 'flex-end', maxWidth: '80%', paddingVertical: 8, paddingHorizontal: 12, borderTopLeftRadius: 14, borderTopRightRadius: 14, borderBottomRightRadius: 4, borderBottomLeftRadius: 14, backgroundColor: theme.fg, gap: 2 },
  mineText: { fontSize: 14, lineHeight: 20, color: colors.paper50 },
  mineTime: { fontSize: 10, color: theme.fgDisabled, textAlign: 'right' },
  quick: { gap: 6, paddingHorizontal: 16, paddingBottom: 8 },
  guard: { marginHorizontal: 16, marginBottom: 8, padding: 10, paddingHorizontal: 12, borderRadius: theme.radiusMd, backgroundColor: colors.alert100, flexDirection: 'row', gap: 8 },
  guardText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600', color: theme.fg },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 8, paddingHorizontal: 12, backgroundColor: theme.bg, borderTopWidth: 1, borderTopColor: theme.border },
  input: { flex: 1, height: 44, borderRadius: theme.radiusFull, borderWidth: 1, borderColor: theme.fgDisabled, paddingHorizontal: 14, fontSize: 14, color: theme.fg, backgroundColor: theme.bg },
  cam: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  photoMine: { alignSelf: 'flex-end', maxWidth: '75%', gap: 2, alignItems: 'flex-end' },
  photoTheirs: { alignSelf: 'flex-start', maxWidth: '75%', gap: 2 },
  photo: { width: 220, height: 220, borderRadius: 14, backgroundColor: theme.border },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.fg, alignItems: 'center', justifyContent: 'center' },
})
